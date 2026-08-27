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

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const apiKey = searchParams.get('key')

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing key' }, { status: 400, headers: CORS })
  }

  const supabase = await createServiceClient()

  // Verify property
  const { data: property } = await supabase
    .from('support_properties')
    .select('id, user_id')
    .eq('api_key', apiKey)
    .single()

  if (!property) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 401, headers: CORS })
  }

  // Parse body — supports Postmark, Mailgun, SendGrid, generic JSON
  let from = '', subject = '', body = ''
  const ct = req.headers.get('content-type') || ''

  if (ct.includes('application/json')) {
    const json = await req.json()
    // Postmark: From, TextBody, Subject
    // Mailgun:  From, stripped-text, subject
    // SendGrid: from, text, subject
    from    = json.From    || json.from    || json.sender       || ''
    subject = json.Subject || json.subject || ''
    body    = json.TextBody || json['stripped-text'] || json.text || json.plain || ''
  } else if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
    const fd = await req.formData()
    from    = String(fd.get('From')    || fd.get('from')    || fd.get('sender') || '')
    subject = String(fd.get('Subject') || fd.get('subject') || '')
    body    = String(fd.get('TextBody') || fd.get('stripped-text') || fd.get('body-plain') || fd.get('text') || '')
  }

  if (!body.trim() && !from) {
    return NextResponse.json({ error: 'No content' }, { status: 400, headers: CORS })
  }

  // Extract sender email
  const emailMatch = from.match(/<(.+?)>/) || from.match(/(\S+@\S+)/)
  const senderEmail = (emailMatch ? emailMatch[1] : from).toLowerCase().trim()

  // Clean body — strip quoted reply (lines starting with ">")
  const cleanBody = body
    .split('\n')
    .filter(line => !line.trim().startsWith('>') && !line.trim().startsWith('On '))
    .join('\n')
    .trim()

  if (!cleanBody) {
    return NextResponse.json({ ok: true, skipped: 'empty after strip' }, { headers: CORS })
  }

  // Find conversation — match by customer email + property, most recent open/pending
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

  // If no existing conversation, create a new one
  if (!conversationId) {
    const { data: newConv } = await supabase
      .from('support_conversations')
      .insert({
        property_id: property.id,
        user_id:     property.user_id,
        customer_email: senderEmail || null,
        subject:     subject || 'Email reply',
        source:      'email',
        status:      'open',
        is_read:     false,
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (!newConv) {
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500, headers: CORS })
    }
    conversationId = newConv.id
  }

  // Insert message
  await supabase.from('support_messages').insert({
    conversation_id: conversationId,
    property_id:     property.id,
    sender_type:     'customer',
    sender_email:    senderEmail || null,
    content:         cleanBody,
    source:          'email',
  })

  // Update conversation last_message_at + mark unread
  await supabase
    .from('support_conversations')
    .update({ last_message_at: new Date().toISOString(), is_read: false, status: 'open' })
    .eq('id', conversationId)

  return NextResponse.json({ ok: true, conversation_id: conversationId }, { headers: CORS })
}
