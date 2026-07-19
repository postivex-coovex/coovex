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

// GET /api/github/file?owner=...&repo=...&path=...&branch=...
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const gh = await getGithubConfig(supabase)
  if (!gh) return NextResponse.json({ error: 'GitHub not connected' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const owner = searchParams.get('owner')
  const repo = searchParams.get('repo')
  const path = searchParams.get('path')
  const branch = searchParams.get('branch') ?? 'main'

  if (!owner || !repo || !path) return NextResponse.json({ error: 'owner, repo, path required' }, { status: 400 })

  const res = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,
    gh.token,
  )
  if (!res.ok) return NextResponse.json({ error: 'File not found' }, { status: res.status })

  const data = await res.json() as { content?: string; sha: string; size: number }
  if (!data.content) return NextResponse.json({ error: 'Not a file' }, { status: 400 })

  // GitHub returns base64-encoded content
  const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')

  return NextResponse.json({ content, sha: data.sha, size: data.size })
}
