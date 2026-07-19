import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GithubClient from './github-client'
import type { GitHubConfig } from '@/lib/github'

export const metadata: Metadata = { title: 'GitHub Coding — CooVex' }

export default async function GithubPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: prof } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: biz } = await supabase
    .from('businesses')
    .select('integrations')
    .eq('workspace_id', prof?.current_workspace_id ?? '')
    .maybeSingle()

  const gh = (biz?.integrations as Record<string, unknown>)?.github as GitHubConfig | undefined

  return <GithubClient initialConfig={gh ?? null} />
}
