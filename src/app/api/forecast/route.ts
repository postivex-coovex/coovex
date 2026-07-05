import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const STAGE_PROB: Record<string, number> = {
  new: 0.05, contacted: 0.12, qualified: 0.28,
  proposal: 0.52, negotiation: 0.72, won: 1.0, lost: 0.0,
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, name, industry').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ forecast: null })

  // ── Fetch real data ──────────────────────────────────────────────────────────
  const [
    { data: leads },
    { data: deals },
    { data: wonDeals },
  ] = await Promise.all([
    supabase.from('leads').select('id, stage, score, created_at, updated_at, name, company').eq('business_id', business.id),
    supabase.from('deals').select('id, lead_id, value, currency, close_date, probability, status').eq('business_id', business.id).eq('status', 'open'),
    supabase.from('deals').select('id, value, currency, close_date, status').eq('business_id', business.id).eq('status', 'won').order('close_date', { ascending: false }).limit(24),
  ])

  const allLeads = leads ?? []
  const openDeals = deals ?? []
  const closedWon = wonDeals ?? []

  // ── Pipeline metrics ─────────────────────────────────────────────────────────
  const wonLeads  = allLeads.filter(l => l.stage === 'won')
  const lostLeads = allLeads.filter(l => l.stage === 'lost')
  const openLeads = allLeads.filter(l => !['won', 'lost'].includes(l.stage))
  const totalClosed = wonLeads.length + lostLeads.length
  const winRate = totalClosed > 0 ? wonLeads.length / totalClosed : 0.25

  // Real avg close time from won leads (created_at → updated_at when won)
  const closeTimes = wonLeads
    .map(l => (new Date(l.updated_at).getTime() - new Date(l.created_at).getTime()) / 86400000)
    .filter(d => d > 0 && d < 365)
  const avgCloseDays = closeTimes.length > 0
    ? Math.round(closeTimes.reduce((a, b) => a + b, 0) / closeTimes.length)
    : 21

  // Pipeline value — use deals.value if exists, else estimate from lead stage
  let pipelineValue = 0
  let weightedValue = 0
  let avgDealSize = 0

  if (openDeals.length > 0) {
    pipelineValue = openDeals.reduce((s, d) => s + Number(d.value), 0)
    weightedValue = openDeals.reduce((s, d) => s + Number(d.value) * (d.probability / 100), 0)
    avgDealSize   = pipelineValue / openDeals.length
  } else if (closedWon.length > 0) {
    // Estimate from historical won deal sizes
    avgDealSize   = closedWon.reduce((s, d) => s + Number(d.value), 0) / closedWon.length
    pipelineValue = openLeads.reduce((s, l) => s + avgDealSize, 0)
    weightedValue = openLeads.reduce((s, l) => s + avgDealSize * (STAGE_PROB[l.stage] ?? 0.1), 0)
  } else {
    // Pure stage-based estimate
    avgDealSize   = 1500
    pipelineValue = openLeads.length * avgDealSize
    weightedValue = openLeads.reduce((s, l) => s + avgDealSize * (STAGE_PROB[l.stage] ?? 0.1), 0)
  }

  const hasRealDealData = openDeals.length > 0 || closedWon.length > 0

  // ── Historical revenue by month (last 6 months) ───────────────────────────
  const now = new Date()
  const historical: { month: string; revenue: number; label: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - i)
    const yr  = d.getFullYear()
    const mo  = d.getMonth()
    const key = `${yr}-${String(mo + 1).padStart(2, '0')}`
    const rev = closedWon
      .filter(d => d.close_date && d.close_date.startsWith(key))
      .reduce((s, d) => s + Number(d.value), 0)
    historical.push({
      month: key,
      revenue: rev,
      label: d.toLocaleString('en-US', { month: 'short' }),
    })
  }

  // ── 6-month projection ─────────────────────────────────────────────────────
  const lastMonthRev = historical[historical.length - 1]?.revenue ?? 0
  const avgHistorical = historical.filter(h => h.revenue > 0).length > 0
    ? historical.reduce((s, h) => s + h.revenue, 0) / historical.filter(h => h.revenue > 0).length
    : 0

  const baseMonthly = avgHistorical > 0 ? avgHistorical : weightedValue / 3
  const growthRate  = 0.08

  const projMonths: string[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(now)
    d.setMonth(d.getMonth() + i + 1)
    projMonths.push(d.toLocaleString('en-US', { month: 'short' }))
  }

  const conservative = projMonths.map((_, i) => Math.round(baseMonthly * 0.65 * Math.pow(1 + growthRate * 0.5, i)))
  const realistic    = projMonths.map((_, i) => Math.round(baseMonthly * Math.pow(1 + growthRate, i)))
  const optimistic   = projMonths.map((_, i) => Math.round(baseMonthly * 1.4 * Math.pow(1 + growthRate * 1.5, i)))

  // ── Deals closing this month ───────────────────────────────────────────────
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const closingThisMonth = openDeals
    .filter(d => d.close_date?.startsWith(thisMonth))
    .sort((a, b) => Number(b.value) - Number(a.value))

  // Join with leads for names
  const leadMap = new Map(allLeads.map(l => [l.id, l]))
  const closingWithNames = closingThisMonth.map(d => ({
    ...d,
    lead: leadMap.get(d.lead_id),
  }))

  // ── Pipeline by stage ─────────────────────────────────────────────────────
  const stageBreakdown = ['new','contacted','qualified','proposal','negotiation'].map(stage => {
    const stageLeads = openLeads.filter(l => l.stage === stage)
    const stageDeals = openDeals.filter(d => stageLeads.some(l => l.id === d.lead_id))
    const value = stageDeals.length > 0
      ? stageDeals.reduce((s, d) => s + Number(d.value), 0)
      : stageLeads.length * avgDealSize
    return {
      stage,
      count: stageLeads.length,
      value: Math.round(value),
      prob: STAGE_PROB[stage],
    }
  }).filter(s => s.count > 0)

  // ── Stale deals (14+ days no movement) ────────────────────────────────────
  const day14 = new Date(now.getTime() - 14 * 86400000).toISOString()
  const staleLeads = openLeads.filter(
    l => ['qualified','proposal','negotiation'].includes(l.stage) && l.updated_at < day14
  )

  // ── AI insight ─────────────────────────────────────────────────────────────
  let insight = ''
  let actions: string[] = []

  try {
    const client = new Anthropic()
    const stageCounts = Object.fromEntries(
      ['new','contacted','qualified','proposal','negotiation'].map(s => [s, allLeads.filter(l => l.stage === s).length])
    )
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      messages: [{
        role: 'user',
        content: `Sales pipeline for ${business.name}:
- Stage counts: ${JSON.stringify(stageCounts)}
- Win rate: ${Math.round(winRate * 100)}%
- Weighted pipeline: $${Math.round(weightedValue).toLocaleString()}
- Avg close time: ${avgCloseDays} days
- Stale deals (14+ days): ${staleLeads.length}
- Deals closing this month: ${closingThisMonth.length}
- Historical data available: ${hasRealDealData}

Give exactly:
1. One sentence insight about pipeline health (be specific with numbers)
2. Three specific action items to improve revenue this month (short bullets)

Format as JSON: {"insight":"...","actions":["...","...","..."]}`,
      }],
    })
    if (msg.content[0].type === 'text') {
      const parsed = JSON.parse(msg.content[0].text.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
      insight = parsed.insight ?? ''
      actions = parsed.actions ?? []
    }
  } catch {
    insight = `You have ${openLeads.length} open leads with $${Math.round(weightedValue).toLocaleString()} weighted pipeline value. Win rate is ${Math.round(winRate * 100)}%.`
    actions = [
      staleLeads.length > 0 ? `Follow up on ${staleLeads.length} stalled deal${staleLeads.length > 1 ? 's' : ''}` : 'Move qualified leads to proposal stage',
      'Schedule demos with high-score leads',
      'Send proposals to negotiation-stage leads',
    ]
  }

  return NextResponse.json({
    forecast: {
      months: projMonths,
      conservative,
      realistic,
      optimistic,
      historical,
      pipeline_value:    Math.round(pipelineValue),
      weighted_value:    Math.round(weightedValue),
      avg_deal_size:     Math.round(avgDealSize),
      avg_close_days:    avgCloseDays,
      win_rate:          Math.round(winRate * 100) / 100,
      stage_breakdown:   stageBreakdown,
      stale_count:       staleLeads.length,
      closing_this_month: closingWithNames.slice(0, 5),
      has_real_data:     hasRealDealData,
      insight,
      actions,
    },
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }
  if (!business) return NextResponse.json({ alerts: [] })

  const now = new Date()
  const day14 = new Date(now.getTime() - 14 * 86400000).toISOString()
  const day7  = new Date(now.getTime() -  7 * 86400000).toISOString()

  const [{ data: stale14 }, { data: noActivity }] = await Promise.all([
    supabase.from('leads').select('id, name, stage').eq('business_id', business.id)
      .in('stage', ['qualified', 'proposal', 'negotiation']).lt('updated_at', day14).limit(10),
    supabase.from('leads').select('id, name').eq('business_id', business.id)
      .eq('stage', 'contacted').lt('updated_at', day7).limit(10),
  ])

  const signals = []
  if ((stale14 ?? []).length > 0) {
    await supabase.from('agent_signals').insert({
      business_id: business.id, type: 'warning',
      title: `${stale14!.length} deal${stale14!.length > 1 ? 's' : ''} stalled 14+ days`,
      body: `Leads stuck: ${stale14!.slice(0, 3).map(l => l.name).join(', ')}${stale14!.length > 3 ? ` +${stale14!.length - 3} more` : ''}. Move them forward or mark lost.`,
      action_type: 'view_report', dismissed: false,
    })
    signals.push({ type: 'stale_deals', count: stale14!.length })
  }
  if ((noActivity ?? []).length > 0) {
    await supabase.from('agent_signals').insert({
      business_id: business.id, type: 'info',
      title: `${noActivity!.length} lead${noActivity!.length > 1 ? 's' : ''} need follow-up`,
      body: `No activity in 7+ days: ${noActivity!.slice(0, 3).map(l => l.name).join(', ')}. Schedule a call or send a check-in.`,
      action_type: 'view_lead', dismissed: false,
    })
    signals.push({ type: 'no_activity', count: noActivity!.length })
  }
  return NextResponse.json({ alerts: signals, ok: true })
}
