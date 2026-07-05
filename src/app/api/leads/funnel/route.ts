import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const STAGE_ORDER = ['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost'] as const
const CLOSE_RATE: Record<string, number> = { new: 0.05, contacted: 0.12, qualified: 0.28, proposal_sent: 0.52, won: 1.0, lost: 0.0 }
const AVG_DEAL = 2500

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  const empty = STAGE_ORDER.map(s => ({ stage: s, count: 0, conversion_rate: Math.round(CLOSE_RATE[s] * 100), weighted_value: 0 }))

  if (!business) {
    return NextResponse.json({ stages: empty, total_leads: 0, won_leads: 0, overall_win_rate: 0, pipeline_value: 0, empty: true })
  }

  const { data: leads } = await supabase
    .from('leads')
    .select('stage, deal_value')
    .eq('business_id', business.id)

  if (!leads || leads.length === 0) {
    return NextResponse.json({ stages: empty, total_leads: 0, won_leads: 0, overall_win_rate: 0, pipeline_value: 0, empty: true })
  }

  const countByStage: Record<string, number> = {}
  const valueByStage: Record<string, number> = {}
  for (const l of leads) {
    countByStage[l.stage] = (countByStage[l.stage] ?? 0) + 1
    const val = (l.deal_value as number | null) ?? AVG_DEAL
    valueByStage[l.stage] = (valueByStage[l.stage] ?? 0) + val
  }

  const stages = STAGE_ORDER.map(s => ({
    stage: s,
    count: countByStage[s] ?? 0,
    conversion_rate: Math.round(CLOSE_RATE[s] * 100),
    weighted_value: Math.round((valueByStage[s] ?? 0) * CLOSE_RATE[s]),
  }))

  const totalLeads = leads.length
  const wonLeads = countByStage['won'] ?? 0
  const activePipeline = stages
    .filter(s => s.stage !== 'won' && s.stage !== 'lost')
    .reduce((sum, s) => sum + s.weighted_value, 0)

  return NextResponse.json({
    stages,
    total_leads: totalLeads,
    won_leads: wonLeads,
    overall_win_rate: totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0,
    pipeline_value: activePipeline,
    empty: false,
  })
}
