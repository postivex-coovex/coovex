import { NextResponse } from 'next/server'
import { getUserGithubConfig } from '@/lib/github'

// GET /api/github/me — return the current user's GitHub config (no token exposed)
export async function GET() {
  const gh = await getUserGithubConfig()
  if (!gh) return NextResponse.json({ config: null })

  return NextResponse.json({
    config: {
      username: gh.username,
      avatar_url: gh.avatar_url,
      active_repo: gh.active_repo ?? null,
    },
  })
}
