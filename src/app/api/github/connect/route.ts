import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ghFetch } from '@/lib/github'

async function getGitHubUser(token: string) {
  const res = await ghFetch('https://api.github.com/user', token)
  if (!res.ok) return null
  return res.json() as Promise<{ login: string; avatar_url: string }>
}

// POST /api/github/connect — verify PAT and save to user's profile
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const ghUser = await getGitHubUser(token)
  if (!ghUser) return NextResponse.json({ error: 'Invalid GitHub token — check scopes (repo, read:user)' }, { status: 400 })

  const { error } = await supabase
    .from('profiles')
    .update({ github_config: { token, username: ghUser.login, avatar_url: ghUser.avatar_url } })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, username: ghUser.login, avatar_url: ghUser.avatar_url })
}

// DELETE /api/github/connect — disconnect GitHub for this user
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('profiles')
    .update({ github_config: null })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
