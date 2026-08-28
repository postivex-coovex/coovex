import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// Extract conv_id from To address (reply+UUID@...) OR subject ([ref:UUID])
function extractConvId(toField: string, subject?: string): string | null {
  const toMatch = toField.match(/reply\+([0-9a-f-]{36})/i)
  if (toMatch) return toMatch[1]
  if (subject) {
    const subMatch = subject.match(/\[ref:([0-9a-f-]{36})\]/i)
    if (subMatch) return subMatch[1]
  }
  return null
}

// Extract plain email address from "Name <email>" or bare email
function extractEmail(field: string): string {
  const m = field.match(/<([^>]+)>/) || field.match(/([^\s,]+@[^\s,]+)/)
  return m ? m[1].toLowerCase().trim() : field.toLowerCase().trim()
}

// Strip quoted reply lines (lines starting with > or "On ... wrote:")
function stripQuotes(text: string): string {
  return text
    .split('\n')
    .filter(line => !line.trim().startsWith('>') && !/^On .+ wrote:/.test(line.trim()))
    .join('\n')
    .trim()
}

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient()

  // Parse body — Postmark sends JSON, Mailgun/SendGrid send multipart form-data
  let toField = '', fromField = '', subject = '', body = ''
  const ct = req.headers.get('content-type') || ''

  if (ct.includes('application/json')) {
    const json = await req.json()
    toField   = json.OriginalRecipient || json.To || json.to || ''
    fromField = json.From || json.from || json.sender || ''
    subject   = json.Subject || json.subject || ''
    body      = json.TextBody || json['stripped-text'] || json.text || json.plain || ''
  } else {
    const fd = await req.formData()
    toField   = String(fd.get('To') || fd.get('to') || fd.get('recipient') || '')
    fromField = String(fd.get('From') || fd.get('from') || fd.get('sender') || '')
    subject   = String(fd.get('Subject') || fd.get('subject') || '')
    body      = String(fd.get('TextBody') || fd.get('stripped-text') || fd.get('body-plain') || fd.get('text') || '')
  }

  const cleanBody = stripQuotes(body)
  if (!cleanBody) return NextResponse.json({ ok: true, skipped: 'empty' }, { headers: CORS })

  const senderEmail = extractEmail(fromField)

  // ── Strategy 1: conv ID in To address OR subject [ref:UUID] ────────
  const convId = extractConvId(toField, subject)
  if (convId) {
    const { data: conv } = await supabase
      .from('support_conversations')
      .select('id, property_id')
      .eq('id', convId)
      .single()

    if (conv) {
      await supabase.from('support_messages').insert({
        conversation_id: conv.id,
        property_id:     conv.property_id,
        sender_type:     'customer',
        sender_email:    senderEmail || null,
        content:         cleanBody,
        source:          'email',
      })
      await supabase.from('support_conversations')
        .update({ last_message_at: new Date().toISOString(), is_read: false, status: 'open' })
        .eq('id', conv.id)

      // Trigger AI agent if enabled
      const { data: prop } = await supabase
        .from('support_properties')
        .select('ai_enabled, ai_auto_reply')
        .eq('id', conv.property_id)
        .single()
      if (prop?.ai_enabled && prop?.ai_auto_reply) {
        // Fire-and-forget — email replies get agent triggered server-side
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.coovex.com'}/api/support/agent/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation_id: conv.id }),
        }).catch(() => {})
      }

      return NextResponse.json({ ok: true, conversation_id: conv.id }, { headers: CORS })
    }
  }

  // ── Strategy 2: match by API key + sender email (legacy/direct setup) ─
  const { searchParams } = req.nextUrl
  const apiKey = searchParams.get('key')

  if (!apiKey) {
    return NextResponse.json({ error: 'Could not match conversation' }, { status: 400, headers: CORS })
  }

  const { data: property } = await supabase
    .from('support_properties')
    .select('id, user_id')
    .eq('api_key', apiKey)
    .single()

  if (!property) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 401, headers: CORS })
  }

  let conversationId: string | null = null

  if (senderEmail) {
    const { data: conv } = await supabase
      .from('support_conversations')
      .select('id')
      .eq('property_id', property.id)
      .eq('customer_email', senderEmail)
      .in('status', ['open', 'pending'])
      .order('last_message_at', { ascending: false })
      .limit(1)
      .single()

    if (conv) conversationId = conv.id
  }

  if (!conversationId) {
    const { data: newConv } = await supabase
      .from('support_conversations')
      .insert({
        property_id:    property.id,
        user_id:        property.user_id,
        customer_email: senderEmail || null,
        subject:        subject || 'Email reply',
        source:         'email',
        status:         'open',
        is_read:        false,
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (!newConv) return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500, headers: CORS })
    conversationId = newConv.id
  }

  await supabase.from('support_messages').insert({
    conversation_id: conversationId,
    property_id:     property.id,
    sender_type:     'customer',
    sender_email:    senderEmail || null,
    content:         cleanBody,
    source:          'email',
  })

  await supabase.from('support_conversations')
    .update({ last_message_at: new Date().toISOString(), is_read: false, status: 'open' })
    .eq('id', conversationId!)

  return NextResponse.json({ ok: true, conversation_id: conversationId }, { headers: CORS })
}
