import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const LABELS: Record<string, string> = {
  website_form:  'Website Form',
  website:       'Website',
  linkedin:      'LinkedIn',
  facebook:      'Facebook',
  instagram:     'Instagram',
  google_ads:    'Google Ads',
  referral:      'Referral',
  cold_outreach: 'Cold Outreach',
  email:         'Email',
  manual:        'Manual / Direct',
  crm_import:    'CRM Import',
  event:         'Event / Conference',
  zapier:        'Zapier / Automation',
  other:         'Other',
  unknown:       'Unknown',
}

const FUNNEL_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won']

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const period = req.nextUrl.searchParams.get('period') ?? 'all'

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ sources: [], funnel: [], total_leads: 0, total_won: 0, total_pipeline: 0, total_won_revenue: 0, has_real_data: false })

  // Date filter
  let since: string | null = null
  if (period === '30d')  since = new Date(Date.now() - 30  * 86400000).toISOString()
  if (period === '90d')  since = new Date(Date.now() - 90  * 86400000).toISOString()
  if (period === '12m')  since = new Date(Date.now() - 365 * 86400000).toISOString()

  let leadsQ = supabase.from('leads').select('id, source, stage, score, created_at').eq('business_id', business.id)
  if (since) leadsQ = leadsQ.gte('created_at', since)
  const { data: leads } = await leadsQ

  const allLeads = leads ?? []
  if (allLeads.length === 0) {
    return NextResponse.json({ sources: [], funnel: [], total_leads: 0, total_won: 0, total_pipeline: 0, total_won_revenue: 0, has_real_data: false })
  }

  // Fetch all deals for these leads
  const leadIds = allLeads.map(l => l.id)
  const { data: deals } = await supabase
    .from('deals')
    .select('lead_id, value, status, probability')
    .in('lead_id', leadIds)

  const dealsByLead = new Map<string, { value: number; status: string; probability: number }[]>()
  for (const d of deals ?? []) {
    if (!dealsByLead.has(d.lead_id)) dealsByLead.set(d.lead_id, [])
    dealsByLead.get(d.lead_id)!.push({ value: Number(d.value), status: d.status, probability: d.probability })
  }

  const hasRealDeals = (deals ?? []).length > 0

  // Group by source
  const grouped: Record<string, {
    leads: number; won: number; lost: number; active: number
    scores: number[]; pipeline: number; won_revenue: number; weighted: number
    avg_deal_size: number; deal_count: number
  }> = {}

  for (const lead of allLeads) {
    const src = lead.source || 'unknown'
    if (!grouped[src]) grouped[src] = { leads: 0, won: 0, lost: 0, active: 0, scores: [], pipeline: 0, won_revenue: 0, weighted: 0, avg_deal_size: 0, deal_count: 0 }
    const g = grouped[src]
    g.leads++
    if (lead.stage === 'won')  g.won++
    else if (lead.stage === 'lost') g.lost++
    else g.active++
    if (lead.score) g.scores.push(lead.score)

    const leadDeals = dealsByLead.get(lead.id) ?? []
    for (const d of leadDeals) {
      g.deal_count++
      if (d.status === 'won') {
        g.won_revenue += d.value
      } else if (d.status === 'open') {
        g.pipeline  += d.value
        g.weighted  += d.value * (d.probability / 100)
      }
    }
  }

  const sources = Object.entries(grouped).map(([source, g]) => {
    const avg_score    = g.scores.length > 0 ? Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length) : 0
    const closed_total = g.won + g.lost
    const win_rate     = closed_total > 0 ? Math.round((g.won / closed_total) * 100) : 0
    // Pipeline = real deal values if available, else rough estimate
    const pipeline     = hasRealDeals ? g.pipeline : g.active * (avg_score * 30)
    const weighted     = hasRealDeals ? g.weighted : pipeline * 0.3
    const avg_deal     = g.deal_count > 0 ? Math.round((g.won_revenue + g.pipeline) / g.deal_count) : 0
    return {
      source,
      label:       LABELS[source] ?? source,
      leads:       g.leads,
      won:         g.won,
      lost:        g.lost,
      active:      g.active,
      win_rate,
      avg_score,
      pipeline,
      weighted,
      won_revenue: g.won_revenue,
      avg_deal_size: avg_deal,
    }
  }).sort((a, b) => b.won_revenue - a.won_revenue || b.pipeline - a.pipeline)

  // Top source by win rate (min 3 leads)
  const qualified = sources.filter(s => s.leads >= 3)
  const top_source = qualified.length > 0
    ? qualified.sort((a, b) => b.win_rate - a.win_rate)[0].source
    : sources[0]?.source ?? 'unknown'

  // Real funnel from actual stage counts
  const stageCounts: Record<string, number> = {}
  for (const l of allLeads) { stageCounts[l.stage] = (stageCounts[l.stage] ?? 0) + 1 }
  const funnel = FUNNEL_STAGES.map(stage => ({
    stage,
    label: stage === 'new' ? 'New' : stage === 'contacted' ? 'Contacted' : stage === 'qualified' ? 'Qualified'
      : stage === 'proposal' ? 'Proposal' : stage === 'negotiation' ? 'Negotiation' : 'Won',
    count: stageCounts[stage] ?? 0,
  }))

  const total_leads      = allLeads.length
  const total_won        = allLeads.filter(l => l.stage === 'won').length
  const total_pipeline   = sources.reduce((s, x) => s + x.pipeline, 0)
  const total_won_revenue = sources.reduce((s, x) => s + x.won_revenue, 0)
  const total_weighted   = sources.reduce((s, x) => s + x.weighted, 0)

  return NextResponse.json({
    sources,
    funnel,
    top_source,
    total_leads,
    total_won,
    total_pipeline,
    total_won_revenue,
    total_weighted,
    has_real_data: hasRealDeals,
    period,
  })
}
