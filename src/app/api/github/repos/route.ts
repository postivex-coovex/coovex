import { NextResponse } from 'next/server'
import { getUserGithubConfig, ghFetch } from '@/lib/github'

export async function GET() {
  const gh = await getUserGithubConfig()
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
