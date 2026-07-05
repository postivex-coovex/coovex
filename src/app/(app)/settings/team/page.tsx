import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TeamClient from './team-client'

export const metadata: Metadata = { title: 'Team — Settings — CooVex' }

export default async function TeamSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id, name').eq('id', user.id).single()
  if (!profile?.current_workspace_id) redirect('/settings')

  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role, joined_at')
    .eq('workspace_id', profile.current_workspace_id)

  // Fetch profiles for each member
  const memberIds = (members || []).map(m => m.user_id)
  const { data: profiles } = memberIds.length > 0
    ? await supabase.from('profiles').select('id, name, email').in('id', memberIds)
    : { data: [] }

  const enriched = (members || []).map(m => ({
    ...m,
    profile: (profiles || []).find(p => p.id === m.user_id) || null,
  }))

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/settings" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">← Settings</Link>
        <h1 className="text-2xl font-bold text-white mt-2">Team Members</h1>
        <p className="text-slate-400 text-sm mt-0.5">Manage who has access to this workspace</p>
      </div>
      <TeamClient members={enriched} currentUserId={user.id} workspaceId={profile.current_workspace_id} />
    </div>
  )
}
