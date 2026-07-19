import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ghFetch, type GitHubConfig } from '@/lib/github'

async function getGithubConfig(supabase: Awaited<ReturnType<typeof createClient>>): Promise<GitHubConfig | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: prof } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: biz } = await supabase.from('businesses').select('integrations').eq('workspace_id', prof?.current_workspace_id ?? '').maybeSingle()
  const gh = (biz?.integrations as Record<string, unknown>)?.github
  if (!gh || !(gh as GitHubConfig).token) return null
  return gh as GitHubConfig
}

export async function GET() {
  const supabase = await createClient()
  const gh = await getGithubConfig(supabase)
  if (!gh) return NextResponse.json({ error: 'GitHub not connected' }, { status: 401 })

  const res = await ghFetch(
    'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator',
    gh.token,
  )
  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch repos' }, { status: 502 })

  const raw = await res.json() as Array<{
    id: number; name: string; full_name: string; description: string | null
    private: boolean; language: string | null; default_branch: string; updated_at: string
  }>

  return NextResponse.json({
    repos: raw.map(r => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      description: r.description,
      private: r.private,
      language: r.language,
      default_branch: r.default_branch,
      updated_at: r.updated_at,
    })),
  })
}
