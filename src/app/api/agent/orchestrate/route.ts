import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runOrchestration } from '@/lib/agent/orchestration'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const result = await runOrchestration(profile.current_workspace_id)
  return NextResponse.json({ ok: true, ...result })
}
