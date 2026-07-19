import { NextRequest, NextResponse } from 'next/server'
import { getUserGithubConfig, ghFetch } from '@/lib/github'

export async function GET(req: NextRequest) {
  const gh = await getUserGithubConfig()
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
