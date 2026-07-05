import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runOrchestration } from '@/lib/orchestration/engine'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_workspace_id, agent_config_json')
    .eq('id', user.id)
    .single()

  if (!profile?.current_workspace_id) {
    return NextResponse.json({ error: 'No workspace' }, { status: 400 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('workspace_id', profile.current_workspace_id)
    .maybeSingle()

  if (!business) {
    return NextResponse.json({ error: 'No business found' }, { status: 404 })
  }

  const agentConfig  = (profile.agent_config_json ?? {}) as Record<string, unknown>
  const orchConfig   = (agentConfig.orchestration ?? {}) as Record<string, { enabled: boolean } | undefined>

  const result = await runOrchestration({
    workspaceId: profile.current_workspace_id,
    businessId:  business.id,
    rulesConfig: orchConfig,
  })

  return NextResponse.json({ ok: true, ...result })
}

// GET — returns last 10 runs for the workspace (dashboard status check)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single()

  const { data: runs } = await supabase
    .from('orchestration_runs')
    .select('id, rule_name, event_type, signals_created, chain_id, status, created_at')
    .eq('workspace_id', profile?.current_workspace_id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ runs: runs ?? [] })
}
