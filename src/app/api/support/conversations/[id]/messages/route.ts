import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendReplyEmail } from '@/lib/support/smtp'
import type { SupportProperty, SupportConversation } from '@/lib/support/types'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { content, send_email = true } = body

  if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 })

  // Fetch conversation + property
  const { data: conv, error: convErr } = await supabase
    .from('support_conversations')
    .select(`*, support_properties(*)`)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (convErr || !conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  // Insert agent reply
  const { data: message, error: msgErr } = await supabase
    .from('support_messages')
    .insert({
      conversation_id: id,
      property_id: conv.property_id,
      sender_type: 'agent',
      sender_email: conv.support_properties?.from_email || null,
      sender_name: conv.support_properties?.from_name || null,
      content,
      source: 'widget',
      is_read: true,
    })
    .select()
    .single()

  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 })

  // Update conversation
  await supabase
    .from('support_conversations')
    .update({ last_message_at: new Date().toISOString(), status: 'pending' })
    .eq('id', id)

  // Send email reply if customer has email + SMTP configured + send_email flag
  let emailSent = false
  let emailError: string | null = null

  if (send_email && conv.customer_email && conv.support_properties?.smtp_host) {
    try {
      await sendReplyEmail({
        property: conv.support_properties as unknown as SupportProperty,
        conversation: conv as unknown as SupportConversation,
        replyContent: content,
      })
      emailSent = true
    } catch (e: unknown) {
      emailError = (e as Error).message
    }
  }

  return NextResponse.json({ message, emailSent, emailError })
}
