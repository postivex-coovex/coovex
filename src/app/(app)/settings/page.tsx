import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from './settings-client'

export const metadata: Metadata = { title: 'Settings — CooVex' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: workspace } = profile?.current_workspace_id
    ? await supabase.from('workspaces').select('*').eq('id', profile.current_workspace_id).single()
    : { data: null }
  const { data: business } = workspace
    ? await supabase.from('businesses').select('*').eq('workspace_id', workspace.id).maybeSingle()
    : { data: null }

  return (
    <SettingsClient
      profile={{ name: profile?.name || null, language: profile?.language || null, timezone: profile?.timezone || null }}
      business={business || null}
      workspace={workspace ? { name: workspace.name, plan: workspace.plan } : null}
      workspaceId={profile?.current_workspace_id ?? null}
      email={user.email || ''}
    />
  )
}
