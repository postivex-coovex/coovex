import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const today = new Date().toISOString().slice(0, 10)

  const [leadsRes, wonLeadsRes, reviewsRes, signalsRes, dealsRes] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('stage', 'won'),
    supabase.from('reviews').select('rating').eq('business_id', business.id),
    supabase.from('agent_signals').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('deals').select('value, status, probability').eq('business_id', business.id),
  ])

  const totalLeads    = leadsRes.count ?? 0
  const wonLeads      = wonLeadsRes.count ?? 0
  const reviews       = reviewsRes.data ?? []
  const avgRating     = reviews.length > 0
    ? reviews.reduce((s: number, r: { rating: number }) => s + (r.rating || 0), 0) / reviews.length
    : 0
  const totalSignals  = signalsRes.count ?? 0
  const deals         = dealsRes.data ?? []
  const openDeals     = deals.filter(d => d.status === 'open')
  const wonDealsArr   = deals.filter(d => d.status === 'won')
  const pipelineValue = openDeals.reduce((s, d) => s + Number(d.value), 0)
  const wonRevenue    = wonDealsArr.reduce((s, d) => s + Number(d.value), 0)
  const closedCount   = wonLeads + deals.filter(d => d.status === 'lost').length
  const winRate       = closedCount > 0 ? Math.round((wonLeads / closedCount) * 100) : 0

  const snapshot = {
    business_id:      business.id,
    date:             today,
    total_leads:      totalLeads,
    won_leads:        wonLeads,
    avg_review_rating: Math.round(avgRating * 10) / 10,
    total_reviews:    reviews.length,
    total_signals:    totalSignals,
  }

  await supabase.from('business_metrics').upsert(snapshot, { onConflict: 'business_id,date' }).then(() => null)

  return NextResponse.json({
    ok: true,
    snapshot,
    live: { pipeline_value: pipelineValue, won_revenue: wonRevenue, win_rate: winRate },
  })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ snapshots: [], live: null })

  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: snapshots }, dealsRes, wonLeadsRes, totalLeadsRes, signalsRes] = await Promise.all([
    supabase.from('business_metrics')
      .select('date, total_leads, won_leads, avg_review_rating, total_reviews, total_signals')
      .eq('business_id', business.id)
      .gte('date', since)
      .order('date', { ascending: true }),
    supabase.from('deals').select('value, status').eq('business_id', business.id),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('stage', 'won'),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('agent_signals').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
  ])

  const deals         = dealsRes.data ?? []
  const openDeals     = deals.filter(d => d.status === 'open')
  const wonDealsArr   = deals.filter(d => d.status === 'won')
  const pipelineValue = openDeals.reduce((s, d) => s + Number(d.value), 0)
  const wonRevenue    = wonDealsArr.reduce((s, d) => s + Number(d.value), 0)
  const wonCount      = wonLeadsRes.count ?? 0
  const totalCount    = totalLeadsRes.count ?? 0
  const lostCount     = deals.filter(d => d.status === 'lost').length
  const closedCount   = wonCount + lostCount
  const winRate       = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0

  const live = {
    pipeline_value: pipelineValue,
    won_revenue: wonRevenue,
    win_rate: winRate,
    total_leads: totalCount,
    total_signals: signalsRes.count ?? 0,
    has_today: (snapshots ?? []).some(s => s.date === today),
  }

  if (!snapshots || snapshots.length === 0) {
    return NextResponse.json({ snapshots: [], live, mock: false })
  }

  return NextResponse.json({ snapshots, live })
}
