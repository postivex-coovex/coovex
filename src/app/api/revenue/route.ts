import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    ? await supabase.from('businesses').select('id, name, industry, integrations').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ won_revenue: 0, pipeline_value: 0, forecast: 0, by_stage: {}, by_month: [], by_source: {}, has_real_data: false })

  const [
    { data: leads },
    { data: wonDeals },
    { data: openDeals },
    { data: integrations },
  ] = await Promise.all([
    supabase.from('leads').select('id, name, company, stage, source, created_at, crm_id').eq('business_id', business.id),
    supabase.from('deals').select('id, lead_id, value, currency, close_date, status, crm_id').eq('business_id', business.id).eq('status', 'won').order('close_date', { ascending: true }),
    supabase.from('deals').select('id, lead_id, value, currency, probability, status, crm_id').eq('business_id', business.id).eq('status', 'open'),
    supabase.from('integrations').select('type, status, connected_at, meta_json').eq('business_id', business.id).in('type', ['hubspot', 'salesforce', 'pipedrive', 'zoho', 'quickbooks', 'xero']),
  ])

  const allLeads  = leads ?? []
  const wonDealList  = wonDeals ?? []
  const openDealList = openDeals ?? []
  const leadMap = new Map(allLeads.map(l => [l.id, l]))

  // Won revenue
  const won_revenue = wonDealList.reduce((s, d) => s + Number(d.value), 0)
  const won_count   = wonDealList.length

  // Pipeline
  const pipeline_value = openDealList.reduce((s, d) => s + Number(d.value), 0)
  const forecast       = openDealList.reduce((s, d) => s + Number(d.value) * (d.probability / 100), 0)
  const active_count   = openDealList.length

  // Total leads
  const total_leads = allLeads.length

  // Won revenue by month (last 12 months)
  const monthMap: Record<string, number> = {}
  for (const d of wonDealList) {
    if (!d.close_date) continue
    const key = d.close_date.slice(0, 7)
    monthMap[key] = (monthMap[key] ?? 0) + Number(d.value)
  }
  const by_month = Object.entries(monthMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, revenue]) => ({
      month,
      revenue,
      label: new Date(month + '-01').toLocaleString('en-US', { month: 'short', year: '2-digit' }),
    }))

  // Revenue by source (join won deals → leads)
  const by_source: Record<string, number> = {}
  for (const d of wonDealList) {
    const lead = leadMap.get(d.lead_id)
    const src  = lead?.source ?? 'direct'
    by_source[src] = (by_source[src] ?? 0) + Number(d.value)
  }

  // Pipeline by stage
  const openLeads = allLeads.filter(l => !['won', 'lost'].includes(l.stage))
  const by_stage: Record<string, { count: number; value: number; weighted: number }> = {}
  for (const l of openLeads) {
    const stageDeals = openDealList.filter(d => d.lead_id === l.id)
    const val = stageDeals.length > 0
      ? stageDeals.reduce((s, d) => s + Number(d.value), 0)
      : 0
    if (!by_stage[l.stage]) by_stage[l.stage] = { count: 0, value: 0, weighted: 0 }
    by_stage[l.stage].count++
    by_stage[l.stage].value   += val
    by_stage[l.stage].weighted += val * (STAGE_PROB[l.stage] ?? 0.1)
  }

  // Recent won deals
  const recent_won = wonDealList.slice(-10).reverse().map(d => ({
    id: d.id,
    value: Number(d.value),
    currency: d.currency,
    close_date: d.close_date,
    crm_id: d.crm_id,
    lead: leadMap.get(d.lead_id) ? {
      name:    leadMap.get(d.lead_id)!.name,
      company: leadMap.get(d.lead_id)!.company,
      source:  leadMap.get(d.lead_id)!.source,
    } : null,
  }))

  // Connected CRM integrations
  const connected_integrations = (integrations ?? []).map(i => ({
    type: i.type,
    status: i.status,
    connected_at: i.connected_at,
    has_api_key: !!(i.meta_json as Record<string,unknown>)?.api_key,
    last_sync: (i.meta_json as Record<string,unknown>)?.last_sync as string | null,
    sync_count: (i.meta_json as Record<string,unknown>)?.sync_count as number | null,
  }))

  const has_real_data = wonDealList.length > 0 || openDealList.length > 0

  return NextResponse.json({
    won_revenue:    Math.round(won_revenue),
    pipeline_value: Math.round(pipeline_value),
    forecast:       Math.round(forecast),
    won_count,
    active_count,
    total_leads,
    by_month,
    by_source,
    by_stage,
    recent_won,
    connected_integrations,
    has_real_data,
  })
}
