import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAiReply } from '@/lib/support/ai-reply'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: conv } = await supabase
    .from('support_conversations')
    .select(`*, support_properties(name, domain)`)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: messages } = await supabase
    .from('support_messages')
    .select('sender_type, sender_name, content, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(20)

  try {
    const reply = await generateAiReply({
      propertyName: conv.support_properties?.name ?? 'Support',
      propertyDomain: conv.support_properties?.domain ?? null,
      customerName: conv.customer_name,
      customerEmail: conv.customer_email,
      subject: conv.subject,
      messages: messages ?? [],
    })
    return NextResponse.json({ reply })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
