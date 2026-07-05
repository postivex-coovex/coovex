import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, name, industry, health_score').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ benchmark: null, mock: true })

  const [
    { data: competitors },
    { data: reviews },
    { data: leads },
    { data: posts },
  ] = await Promise.all([
    supabase.from('competitors')
      .select('id, name, website, intelligence_score, google_rating, google_review_count, threat_level, pricing_tier, market_type, crawl_status')
      .eq('business_id', business.id)
      .limit(20),
    supabase.from('reviews').select('rating').eq('business_id', business.id),
    supabase.from('leads').select('stage').eq('business_id', business.id),
    supabase.from('posts').select('status').eq('business_id', business.id),
  ])

  // ── Your real data ──────────────────────────────────────────────────────────
  const myAvgRating    = reviews && reviews.length > 0
    ? parseFloat((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1))
    : 0
  const myReviewCount  = reviews?.length ?? 0
  const myWonLeads     = (leads ?? []).filter(l => l.stage === 'won').length
  const myLeadTotal    = (leads ?? []).length
  const myWinRate      = myLeadTotal > 0 ? Math.round((myWonLeads / myLeadTotal) * 100) : 0
  const myPublishedPosts = (posts ?? []).filter(p => p.status === 'published').length
  const myHealthScore  = business.health_score ?? 0

  const myEntry = {
    id: 'self',
    name: business.name,
    is_self: true,
    data_source: 'real' as const,
    avg_rating: myAvgRating,
    review_count: myReviewCount,
    win_rate: myWinRate,
    content_score: Math.min(100, myPublishedPosts * 5),
    health_score: myHealthScore,
    intelligence_score: myHealthScore,
    threat_level: null as string | null,
    pricing_tier: null as string | null,
    market_type: null as string | null,
    presence_score: Math.round((myAvgRating / 5) * 40 + Math.min(30, myPublishedPosts * 2) + (myHealthScore * 0.3)),
  }

  // ── Competitor data from DB (AI-estimated at discover time) ─────────────────
  const competitorEntries = (competitors ?? []).map(c => {
    const rating         = c.google_rating ?? 0
    const reviews_count  = c.google_review_count ?? 0
    const intel          = c.intelligence_score ?? 0
    // presence = weighted combo of rating + review count + intelligence score
    const presence = Math.round(
      (rating / 5) * 30 +
      Math.min(20, (reviews_count / 200) * 20) +
      intel * 0.5
    )
    return {
      id: c.id,
      name: c.name,
      website: c.website,
      is_self: false,
      data_source: 'ai_estimated' as const,
      avg_rating: rating,
      review_count: reviews_count,
      win_rate: 0,
      content_score: 0,
      health_score: intel,
      intelligence_score: intel,
      threat_level: c.threat_level,
      pricing_tier: c.pricing_tier,
      market_type: c.market_type,
      crawl_status: c.crawl_status,
      presence_score: presence,
    }
  })

  // No competitors yet → return empty (not mock names)
  if (competitorEntries.length === 0) {
    return NextResponse.json({ benchmark: { self: myEntry, competitors: [] }, mock: false })
  }

  return NextResponse.json({ benchmark: { self: myEntry, competitors: competitorEntries }, mock: false })
}
