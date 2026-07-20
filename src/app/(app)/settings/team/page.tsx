import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { TeamClient } from './team-client'

export const metadata: Metadata = { title: 'Team — CooVex' }

export default async function TeamSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id, name').eq('id', user.id).single()
  if (!profile?.current_workspace_id) redirect('/dashboard')

  const service = createServiceClient()
  const { data: callerMem } = await service
    .from('workspace_members').select('role')
    .eq('workspace_id', profile.current_workspace_id).eq('user_id', user.id).maybeSingle()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Team</h1>
        <p className="text-slate-400 text-sm mt-1">
          Invite members, set their feature access, and track activity & credit usage.
        </p>
      </div>
      <TeamClient
        callerUserId={user.id}
        callerRole={(callerMem?.role as string) ?? 'member'}
        appUrl={process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.coovex.com'}
      />
    </div>
  )
}
