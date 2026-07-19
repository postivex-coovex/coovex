import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const gh = await getGithubConfig(supabase)
  if (!gh) return NextResponse.json({ error: 'GitHub not connected' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const owner = searchParams.get('owner')
  const repo = searchParams.get('repo')
  const branch = searchParams.get('branch') ?? 'main'

  if (!owner || !repo) return NextResponse.json({ error: 'owner and repo required' }, { status: 400 })

  const res = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    gh.token,
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    return NextResponse.json({ error: err.message ?? 'Failed to fetch tree' }, { status: res.status })
  }

  const data = await res.json() as {
    tree: Array<{ path: string; type: string; size?: number; sha: string }>
    truncated: boolean
  }

  return NextResponse.json({
    tree: (data.tree ?? [])
      .filter(f => f.type === 'blob')
      .map(f => ({ path: f.path, size: f.size ?? 0, sha: f.sha })),
    truncated: data.truncated ?? false,
  })
}
