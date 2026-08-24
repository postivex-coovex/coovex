// Public endpoint — receives messages from embedded widgets
// Auth: property api_key (no user session required)
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { notifyOwnerNewMessage } from '@/lib/support/notify'

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient()
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { key, name, email, message, subject, url, session_id } = body

  if (!key)     return NextResponse.json({ error: 'Property key required' }, { status: 400 })
  if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  // Verify property key
  const { data: property, error: propErr } = await supabase
    .from('support_properties')
    .select('id, user_id, name, auto_reply_enabled, auto_reply_message, from_email, from_name, domain')
    .eq('api_key', key)
    .single()

  if (propErr || !property) {
    return NextResponse.json({ error: 'Invalid property key' }, { status: 403 })
  }

  // Look up existing conversation by session_id OR find open one for this email+property
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
        customer_name: name || null,
        subject: subject || (message.slice(0, 60)) || 'New message',
        source: 'widget',
        widget_session_id: session_id || null,
        metadata: { url: url || null },
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (convErr || !conv) {
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }
    conversationId = conv.id
  }

  // Insert message
  const { error: msgErr } = await supabase
    .from('support_messages')
    .insert({
      conversation_id: conversationId,
      property_id: property.id,
      sender_type: 'customer',
      sender_name: name || null,
      sender_email: email || null,
      content: message,
      source: 'widget',
    })

  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 })

  // Update conversation last_message_at and mark unread
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
      customerName: name || null,
      customerEmail: email || null,
      subject: subject || null,
      preview: message,
      source: 'widget',
    }).catch(() => {})
  }

  return NextResponse.json({
    conversation_id: conversationId,
    auto_reply: property.auto_reply_enabled ? property.auto_reply_message : null,
  })
}
