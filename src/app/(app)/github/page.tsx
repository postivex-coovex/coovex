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

  const { data: profile } = await supabase
    .from('profiles')
    .select('github_config')
    .eq('id', user.id)
    .single()

  const gh = (profile as Record<string, unknown> | null)?.github_config as GitHubConfig | undefined

  return <GithubClient initialConfig={gh ?? null} />
}
