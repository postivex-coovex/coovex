import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserGithubConfig, type ActiveRepo } from '@/lib/github'

// PATCH /api/github/connect/repo — save the selected active_repo to user's github_config
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { active_repo } = await req.json() as { active_repo: ActiveRepo }
  if (!active_repo?.owner || !active_repo?.repo) {
    return NextResponse.json({ error: 'active_repo required' }, { status: 400 })
  }

  const current = await getUserGithubConfig()
  if (!current) return NextResponse.json({ error: 'GitHub not connected' }, { status: 401 })

  const updated = { ...current, active_repo }
  const { error } = await supabase
    .from('profiles')
    .update({ github_config: updated })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
