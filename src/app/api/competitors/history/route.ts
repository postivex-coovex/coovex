import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, health_score').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ snapshots: [], bizSnapshots: [] })

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [{ data: snapshots }, { data: bizSnapshots }] = await Promise.all([
    supabase.from('competitor_snapshots')
      .select('competitor_id, intelligence_score, recorded_date')
      .eq('business_id', business.id)
      .gte('recorded_date', since)
      .order('recorded_date'),
    supabase.from('business_snapshots')
      .select('health_score, recorded_date')
      .eq('business_id', business.id)
      .gte('recorded_date', since)
      .order('recorded_date'),
  ])

  return NextResponse.json({
    snapshots:        snapshots    ?? [],
    bizSnapshots:     bizSnapshots ?? [],
    currentHealthScore: business.health_score,
  })
}
