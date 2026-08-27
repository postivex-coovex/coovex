import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runSupportAgent } from '@/lib/support/agent'
import type { AgentIntegration } from '@/lib/support/agent'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { conversation_id } = await req.json()
  if (!conversation_id) return NextResponse.json({ error: 'conversation_id required' }, { status: 400 })

  const supabase = await createServiceClient()

  // Load conversation + messages + property
  const { data: conv } = await supabase
    .from('support_conversations')
    .select('id, property_id, customer_name, customer_email, subject')
    .eq('id', conversation_id)
    .single()

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  const { data: property } = await supabase
    .from('support_properties')
    .select('id, name, domain, ai_enabled, ai_system_prompt, ai_integrations, smtp_host, smtp_user, smtp_password, smtp_port, smtp_secure, from_email, from_name')
    .eq('id', conv.property_id)
    .single()

  if (!property || !property.ai_enabled) {
    return NextResponse.json({ ok: false, reason: 'AI not enabled for this property' })
  }

  const { data: messages } = await supabase
    .from('support_messages')
    .select('sender_type, sender_name, content, created_at')
    .eq('conversation_id', conversation_id)
    .order('created_at', { ascending: true })
    .limit(20)

  const integrations: AgentIntegration[] = Array.isArray(property.ai_integrations)
    ? (property.ai_integrations as AgentIntegration[])
    : []

  const reply = await runSupportAgent({
    conversationId: conversation_id,
    propertyName:   property.name,
    propertyDomain: property.domain,
    systemPrompt:   property.ai_system_prompt,
    integrations,
    messages:       messages || [],
    customerName:   conv.customer_name,
    customerEmail:  conv.customer_email,
  })

  // Insert AI reply
  await supabase.from('support_messages').insert({
    conversation_id,
    property_id:  conv.property_id,
    sender_type:  'ai',
    sender_name:  'AI Agent',
    content:      reply,
    source:       'ai',
  })

  await supabase.from('support_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversation_id)

  // Send email reply if customer has email + SMTP configured
  if (conv.customer_email && property.smtp_host) {
    try {
      const { sendReplyEmail } = await import('@/lib/support/smtp')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await sendReplyEmail({
        property: property as any,
        conversation: { ...conv, email_thread_id: null } as any,
        replyContent: reply,
      })
    } catch { /* SMTP optional */ }
  }

  return NextResponse.json({ ok: true, reply })
}
