import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Recalculate business health score from real data:
// - Website audit score    (25%)
// - Avg review rating      (25%)
// - Content activity       (25%)
// - Lead win rate          (25%)
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, health_score').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  // 1. Website audit score
  const { data: lastAudit } = await supabase
    .from('audits')
    .select('score')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const auditScore = lastAudit?.score ?? 50

  // 2. Review rating (avg star / 5 * 100)
  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating')
    .eq('business_id', business.id)
  const avgRating = reviews && reviews.length > 0
    ? reviews.reduce((s: number, r: { rating: number }) => s + (r.rating || 0), 0) / reviews.length
    : 0
  const reviewScore = reviews && reviews.length > 0 ? Math.round((avgRating / 5) * 100) : 50

  // 3. Content activity (posts in last 30 days, 12+ = 100)
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString()
  const { count: recentPosts } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', business.id)
    .gte('created_at', since30)
  const contentScore = Math.min(100, Math.round(((recentPosts ?? 0) / 12) * 100))

  // 4. Lead win rate (won / (won + lost), new leads excluded)
  const { data: leads } = await supabase
    .from('leads')
    .select('stage')
    .eq('business_id', business.id)
    .in('stage', ['won', 'lost'])
  const wonCount  = (leads || []).filter((l: { stage: string }) => l.stage === 'won').length
  const lostCount = (leads || []).filter((l: { stage: string }) => l.stage === 'lost').length
  const total = wonCount + lostCount
  const leadScore = total > 0 ? Math.round((wonCount / total) * 100) : 50

  const newScore = Math.round((auditScore + reviewScore + contentScore + leadScore) / 4)

  await supabase.from('businesses')
    .update({ health_score: newScore })
    .eq('id', business.id)
    .then(() => null)

  return NextResponse.json({
    ok: true,
    score: newScore,
    breakdown: {
      audit:   { score: auditScore,   label: 'Website Audit',     weight: '25%' },
      reviews: { score: reviewScore,  label: 'Review Rating',     weight: '25%', rating: avgRating.toFixed(1) },
      content: { score: contentScore, label: 'Content Activity',  weight: '25%', posts: recentPosts ?? 0 },
      leads:   { score: leadScore,    label: 'Lead Win Rate',     weight: '25%', won: wonCount, lost: lostCount },
    },
  })
}
