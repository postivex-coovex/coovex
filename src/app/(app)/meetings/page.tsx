import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MeetingsClient } from '@/components/meetings/meetings-client'

export const metadata = { title: 'Meeting Calendar' }

export default async function MeetingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <MeetingsClient />
}
