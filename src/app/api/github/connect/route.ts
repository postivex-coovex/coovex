import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ghFetch } from '@/lib/github'

async function getGitHubUser(token: string) {
  const res = await ghFetch('https://api.github.com/user', token)
  if (!res.ok) return null
  return res.json() as Promise<{ login: string; avatar_url: string }>
}

async function getBiz(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: prof } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: biz } = await supabase.from('businesses').select('id, integrations').eq('workspace_id', prof?.current_workspace_id ?? '').maybeSingle()
  return biz ?? null
}

// POST /api/github/connect — save a Personal Access Token
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const ghUser = await getGitHubUser(token)
  if (!ghUser) return NextResponse.json({ error: 'Invalid GitHub token — check scopes (repo, read:user)' }, { status: 400 })

  const biz = await getBiz(supabase)
  if (!biz) return NextResponse.json({ error: 'No business found' }, { status: 400 })

  const existing = (biz.integrations as Record<string, unknown>) ?? {}
  const updated = {
    ...existing,
    github: { token, username: ghUser.login, avatar_url: ghUser.avatar_url },
  }
  const { error } = await supabase.from('businesses').update({ integrations: updated } as Record<string, unknown>).eq('id', biz.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, username: ghUser.login, avatar_url: ghUser.avatar_url })
}

// DELETE /api/github/connect — disconnect GitHub
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const biz = await getBiz(supabase)
  if (!biz) return NextResponse.json({ error: 'No business found' }, { status: 400 })

  const existing = (biz.integrations as Record<string, unknown>) ?? {}
  const { github: _, ...rest } = existing
  const { error } = await supabase.from('businesses').update({ integrations: rest } as Record<string, unknown>).eq('id', biz.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
