import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()

  // All workspaces this user belongs to
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)

  if (!memberships?.length) return NextResponse.json({ clients: [] })

  const workspaceIds = memberships.map(m => m.workspace_id)
  const roleMap: Record<string, string> = {}
  for (const m of memberships) roleMap[m.workspace_id] = m.role

  // Get businesses
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, industry, health_score, website_url, workspace_id')
    .in('workspace_id', workspaceIds)

  if (!businesses?.length) return NextResponse.json({ clients: [] })

  const businessIds = businesses.map(b => b.id)

  // Aggregate metrics in parallel
  const [
    { data: leadRows },
    { data: signalRows },
  ] = await Promise.all([
    supabase.from('leads')
      .select('business_id, stage')
      .in('business_id', businessIds),
    supabase.from('agent_signals')
      .select('business_id, type')
      .in('business_id', businessIds)
      .eq('dismissed', false),
  ])

  // Build metrics per business
  const leadsMap: Record<string, number> = {}
  const wonMap:   Record<string, number> = {}
  for (const l of leadRows ?? []) {
    leadsMap[l.business_id] = (leadsMap[l.business_id] ?? 0) + 1
    if (l.stage === 'won') wonMap[l.business_id] = (wonMap[l.business_id] ?? 0) + 1
  }

  const signalsMap: Record<string, number> = {}
  const urgentMap:  Record<string, number> = {}
  for (const s of signalRows ?? []) {
    signalsMap[s.business_id] = (signalsMap[s.business_id] ?? 0) + 1
    if (s.type === 'urgent' || s.type === 'warning') {
      urgentMap[s.business_id] = (urgentMap[s.business_id] ?? 0) + 1
    }
  }

  const clients = businesses.map(b => {
    const leads   = leadsMap[b.id] ?? 0
    const won     = wonMap[b.id]   ?? 0
    const signals = signalsMap[b.id] ?? 0
    const urgent  = urgentMap[b.id]  ?? 0
    const winRate = leads > 0 ? Math.round((won / leads) * 100) : 0
    return {
      workspace_id:  b.workspace_id,
      business_id:   b.id,
      name:          b.name,
      industry:      b.industry,
      health_score:  b.health_score,
      website_url:   b.website_url,
      role:          roleMap[b.workspace_id] ?? 'viewer',
      is_current:    b.workspace_id === profile?.current_workspace_id,
      metrics: { leads, won, win_rate: winRate, signals, urgent },
    }
  })

  // Sort by health descending
  clients.sort((a, b) => b.health_score - a.health_score)

  return NextResponse.json({ clients })
}
