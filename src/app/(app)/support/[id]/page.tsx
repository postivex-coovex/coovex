import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ConversationView } from '@/components/support/conversation-view'

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: conv } = await supabase
    .from('support_conversations')
    .select('*, support_properties(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!conv) notFound()

  const { data: messages } = await supabase
    .from('support_messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  // Mark as read
  await supabase
    .from('support_conversations')
    .update({ is_read: true })
    .eq('id', id)

  await supabase
    .from('support_messages')
    .update({ is_read: true })
    .eq('conversation_id', id)
    .eq('sender_type', 'customer')

  return (
    <div className="h-[calc(100vh-64px)]">
      <ConversationView
        conversation={conv as any}
        messages={messages ?? []}
      />
    </div>
  )
}
