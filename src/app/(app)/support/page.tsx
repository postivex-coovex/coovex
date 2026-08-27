import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SupportInbox } from '@/components/support/inbox-client'

export const metadata = { title: 'Support Inbox' }

export default async function SupportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: properties } = await supabase
    .from('support_properties')
    .select('id,name,domain,widget_color')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <SupportInbox properties={properties ?? []} />
    </div>
  )
}
