// Public endpoint — receives inbound emails forwarded by email services
// Supports Postmark, Mailgun, SendGrid inbound parse webhook formats
// Configure your email service to forward to: /api/support/email-webhook?key=PROPERTY_API_KEY
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { notifyOwnerNewMessage } from '@/lib/support/notify'

interface InboundEmail {
  from: string
  fromName: string
  subject: string
  textBody: string
  htmlBody: string
  messageId: string
}

function parsePostmark(body: Record<string, unknown>): InboundEmail {
  return {
    from: String(body.From || body.from || ''),
    fromName: String(body.FromName || body.fromName || ''),
    subject: String(body.Subject || body.subject || '(No subject)'),
    textBody: String(body.TextBody || body.textBody || ''),
    htmlBody: String(body.HtmlBody || body.htmlBody || ''),
    messageId: String(body.MessageID || body.messageId || ''),
  }
}

function parseMailgun(body: Record<string, unknown>): InboundEmail {
  const from = String(body.from || body.sender || '')
  const nameMatch = from.match(/^"?([^"<]+)"?\s*</)
  return {
    from: from.replace(/.*<|>/g, '').trim() || from,
    fromName: nameMatch ? nameMatch[1].trim() : '',
    subject: String(body.subject || '(No subject)'),
    textBody: String(body['body-plain'] || body.body || ''),
    htmlBody: String(body['body-html'] || ''),
    messageId: String(body['Message-Id'] || body.messageId || ''),
  }
}

function extractEmail(str: string): string {
  const match = str.match(/<([^>]+)>/)
  return match ? match[1] : str.trim()
}

function detectAndParse(body: Record<string, unknown>): InboundEmail {
  // Postmark has 'FromFull'; Mailgun has 'body-plain'
  if ('FromFull' in body || 'TextBody' in body) return parsePostmark(body)
  if ('body-plain' in body || 'sender' in body) return parseMailgun(body)
  // Fallback — try generic fields
  return parsePostmark(body)
}

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient()
  const { searchParams } = req.nextUrl
  const key = searchParams.get('key')

  if (!key) return NextResponse.json({ error: 'Property key required' }, { status: 400 })

  const { data: property, error: propErr } = await supabase
    .from('support_properties')
    .select('id, user_id, name')
    .eq('api_key', key)
    .single()

  if (propErr || !property) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 403 })
  }

  let body: Record<string, unknown>
  const contentType = req.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    body = await req.json()
  } else {
    // multipart/form-data or application/x-www-form-urlencoded
    const formData = await req.formData()
    body = Object.fromEntries(formData.entries()) as Record<string, unknown>
  }

  const email = detectAndParse(body)
  const senderEmail = extractEmail(email.from)
  const content = email.textBody || email.htmlBody || '(No content)'

  // Find or create conversation by email thread
  let conversationId: string | null = null

  if (email.messageId) {
    const { data: existing } = await supabase
      .from('support_conversations')
      .select('id')
      .eq('property_id', property.id)
      .eq('email_thread_id', email.messageId)
      .single()
    if (existing) conversationId = existing.id
  }

  // Try matching by sender email + open status
  if (!conversationId && senderEmail) {
    const { data: existing } = await supabase
      .from('support_conversations')
      .select('id')
      .eq('property_id', property.id)
      .eq('customer_email', senderEmail)
      .eq('source', 'email')
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (existing) conversationId = existing.id
  }

  if (!conversationId) {
    const { data: conv, error: convErr } = await supabase
      .from('support_conversations')
      .insert({
        property_id: property.id,
        user_id: property.user_id,
        customer_email: senderEmail,
        customer_name: email.fromName || null,
        subject: email.subject,
        source: 'email',
        email_thread_id: email.messageId || null,
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (convErr || !conv) {
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }
    conversationId = conv.id
  }

  await supabase.from('support_messages').insert({
    conversation_id: conversationId,
    property_id: property.id,
    sender_type: 'customer',
    sender_name: email.fromName || null,
    sender_email: senderEmail,
    content,
    content_html: email.htmlBody || null,
    source: 'email',
    email_message_id: email.messageId || null,
  })

  await supabase
    .from('support_conversations')
    .update({ last_message_at: new Date().toISOString(), is_read: false, status: 'open' })
    .eq('id', conversationId)

  // Notify property owner
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', property.user_id)
    .single()
  if (ownerProfile?.email) {
    notifyOwnerNewMessage({
      ownerEmail: ownerProfile.email,
      propertyName: property.name,
      conversationId: conversationId!,
      customerName: email.fromName || null,
      customerEmail: senderEmail,
      subject: email.subject,
      preview: content,
      source: 'email',
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
