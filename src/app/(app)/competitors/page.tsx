import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CompetitorsClient from './competitors-client'

export const metadata: Metadata = { title: 'Competitor Intelligence — CooVex' }
export const dynamic = 'force-dynamic'

export default async function CompetitorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('*').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [
    { data: competitors },
    insightsResult,
    snapshotResult,
    bizSnapshotResult,
  ] = await Promise.all([
    business
      ? supabase.from('competitors').select('*').eq('business_id', business.id).order('last_scanned_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    business
      ? supabase.from('competitor_insights').select('*').eq('business_id', business.id).order('priority', { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
    business
      ? supabase.from('competitor_snapshots').select('competitor_id, intelligence_score, recorded_date').eq('business_id', business.id).gte('recorded_date', since).order('recorded_date')
      : Promise.resolve({ data: [], error: null }),
    business
      ? supabase.from('business_snapshots').select('health_score, recorded_date').eq('business_id', business.id).gte('recorded_date', since).order('recorded_date')
      : Promise.resolve({ data: [], error: null }),
  ])

  // Gracefully ignore table errors (tables may not exist yet if migration pending)
  const insights     = insightsResult?.error    ? [] : (insightsResult?.data    ?? [])
  const snapshots    = snapshotResult?.error    ? [] : (snapshotResult?.data    ?? [])
  const bizSnapshots = bizSnapshotResult?.error ? [] : (bizSnapshotResult?.data ?? [])

  // Dedup by name server-side — keep latest scanned (list is already ordered by last_scanned_at desc)
  const seen = new Set<string>()
  const dedupedCompetitors = (competitors ?? []).filter(c => {
    const key = (c.name as string).toLowerCase().trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return (
    <CompetitorsClient
      competitors={dedupedCompetitors}
      insights={insights}
      business={business ?? null}
      snapshots={snapshots ?? []}
      bizSnapshots={bizSnapshots ?? []}
    />
  )
}
