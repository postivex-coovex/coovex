// Public endpoint — receives messages from embedded widgets
// Auth: property api_key (no user session required)
import { NextRequest, NextResponse, after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { notifyOwnerNewMessage } from '@/lib/support/notify'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

interface AttachmentMeta { url: string; name: string; type: string; size: number }

async function uploadFiles(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  files: File[],
  propertyId: string,
  conversationId: string,
): Promise<AttachmentMeta[]> {
  const results: AttachmentMeta[] = []
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) continue // skip >10MB
    const ext   = file.name.split('.').pop() || 'bin'
    const slug  = Math.random().toString(36).slice(2, 8)
    const path  = `${propertyId}/${conversationId}/${Date.now()}-${slug}.${ext}`
    const buf   = Buffer.from(await file.arrayBuffer())
    const { error } = await supabase.storage
      .from('support-attachments')
      .upload(path, buf, { contentType: file.type, upsert: false })
    if (error) continue
    const { data: { publicUrl } } = supabase.storage
      .from('support-attachments')
      .getPublicUrl(path)
    results.push({ url: publicUrl, name: file.name, type: file.type, size: file.size })
  }
  return results
}

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient()

  // Parse body — JSON or multipart (when files attached)
  let key: string | undefined, name: string | undefined, email: string | undefined,
      phone: string | undefined, message: string | undefined, subject: string | undefined,
      url: string | undefined, session_id: string | undefined
  let files: File[] = []

  const ct = req.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    const json = await req.json().catch(() => ({}))
    ;({ key, name, email, phone, message, subject, url, session_id } = json)
  } else {
    const fd = await req.formData().catch(() => null)
    if (!fd) return NextResponse.json({ error: 'Invalid body' }, { status: 400, headers: CORS })
    key        = fd.get('key')        as string | undefined
    name       = fd.get('name')       as string | undefined
    email      = fd.get('email')      as string | undefined
    phone      = fd.get('phone')      as string | undefined
    message    = fd.get('message')    as string | undefined
    subject    = fd.get('subject')    as string | undefined
    url        = fd.get('url')        as string | undefined
    session_id = fd.get('session_id') as string | undefined
    files = fd.getAll('files').filter((v): v is File => v instanceof File)
  }

  if (!key) return NextResponse.json({ error: 'Property key required' }, { status: 400, headers: CORS })
  if (!message && files.length === 0) return NextResponse.json({ error: 'Message or file required' }, { status: 400, headers: CORS })

  // Verify property key
  const { data: property, error: propErr } = await supabase
    .from('support_properties')
    .select('id, user_id, name, auto_reply_enabled, auto_reply_message, from_email, from_name, domain, ai_enabled, ai_auto_reply')
    .eq('api_key', key)
    .single()

  if (propErr || !property) {
    return NextResponse.json({ error: 'Invalid property key' }, { status: 403, headers: CORS })
  }

  // Find existing conversation
  let conversationId: string | null = null

  if (session_id) {
    const { data: existing } = await supabase
      .from('support_conversations')
      .select('id')
      .eq('property_id', property.id)
      .eq('widget_session_id', session_id)
      .neq('status', 'closed')
      .single()
    if (existing) conversationId = existing.id
  }

  if (!conversationId && email) {
    const { data: existing } = await supabase
      .from('support_conversations')
      .select('id')
      .eq('property_id', property.id)
      .eq('customer_email', email)
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (existing) conversationId = existing.id
  }

  // Create conversation if new
  if (!conversationId) {
    const { data: conv, error: convErr } = await supabase
      .from('support_conversations')
      .insert({
        property_id: property.id,
        user_id: property.user_id,
        customer_email: email || null,
        customer_name:  name  || null,
        customer_phone: phone || null,
        subject: subject || (message?.slice(0, 60)) || 'New message',
        source: 'widget',
        widget_session_id: session_id || null,
        metadata: { url: url || null },
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (convErr || !conv) {
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500, headers: CORS })
    }
    conversationId = conv.id

    // Update phone on existing conversation if supplied
    if (phone && conversationId) {
      await supabase
        .from('support_conversations')
        .update({ customer_phone: phone })
        .eq('id', conversationId)
    }
  }

  // Upload attachments
  const attachments: AttachmentMeta[] = files.length
    ? await uploadFiles(supabase, files, property.id, conversationId!)
    : []

  // Insert message
  const { error: msgErr } = await supabase
    .from('support_messages')
    .insert({
      conversation_id: conversationId,
      property_id: property.id,
      sender_type: 'customer',
      sender_name:  name  || null,
      sender_email: email || null,
      content: message || (attachments.length ? `[${attachments.length} file(s)]` : ''),
      source: 'widget',
      attachments,
    })

  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500, headers: CORS })

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
  const ownerEmail = ownerProfile?.email
  if (ownerEmail) {
    notifyOwnerNewMessage({
      ownerEmail,
      propertyName: property.name,
      conversationId: conversationId!,
      customerName:  name  || null,
      customerEmail: email || null,
      subject: subject || null,
      preview: message || `[${attachments.length} attachment(s)]`,
      source: 'widget',
    }).catch(() => {})
  }

  // Trigger AI agent after response is sent
  if ((property as Record<string, unknown>).ai_enabled && (property as Record<string, unknown>).ai_auto_reply) {
    const convId = conversationId
    after(async () => {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.coovex.com'}/api/support/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: convId }),
      }).catch(() => {})
    })
  }

  return NextResponse.json({
    conversation_id: conversationId,
    auto_reply: property.auto_reply_enabled ? property.auto_reply_message : null,
  }, { headers: CORS })
}
