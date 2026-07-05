import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Vercel Cron — runs every day at 2:00 AM UTC
// Recalculates health score for all businesses + checks cold leads

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const { data: businesses } = await supabase.from('businesses').select('id, name, health_score').limit(500)

  if (!businesses?.length) return NextResponse.json({ ok: true, processed: 0 })

  let processed = 0
  let coldLeadSignals = 0
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()

  for (const biz of businesses) {
    try {
      // ── 1. Recalculate health score ──────────────────────────────────────
      const [
        { data: audits },
        { data: reviews },
        { data: posts },
        { data: leads },
      ] = await Promise.all([
        supabase.from('audits').select('score').eq('business_id', biz.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('reviews').select('rating').eq('business_id', biz.id),
        supabase.from('posts').select('status, created_at').eq('business_id', biz.id).gte('created_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()),
        supabase.from('leads').select('stage').eq('business_id', biz.id),
      ])

      const auditScore = audits?.[0]?.score ?? 0
      const avgRating = reviews?.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
      const reviewScore = (avgRating / 5) * 100
      const contentScore = Math.min(100, (posts?.length ?? 0) / 12 * 100)
      const wonLeads = (leads ?? []).filter(l => l.stage === 'won').length
      const lostLeads = (leads ?? []).filter(l => l.stage === 'lost').length
      const resolvedLeads = wonLeads + lostLeads
      const leadScore = resolvedLeads > 0 ? (wonLeads / resolvedLeads) * 100 : 0
      const healthScore = Math.round(auditScore * 0.25 + reviewScore * 0.25 + contentScore * 0.25 + leadScore * 0.25)

      await supabase.from('businesses').update({ health_score: healthScore }).eq('id', biz.id).then(() => null)

      // ── 2. Cold lead alerts ──────────────────────────────────────────────
      const { data: coldLeads } = await supabase
        .from('leads')
        .select('id, name, company')
        .eq('business_id', biz.id)
        .not('stage', 'in', '("won","lost")')
        .lt('updated_at', cutoff)
        .limit(5)

      if (coldLeads && coldLeads.length > 0) {
        await supabase.from('agent_signals').insert({
          business_id: biz.id,
          title: `${coldLeads.length} lead${coldLeads.length > 1 ? 's' : ''} need re-engagement`,
          description: `${coldLeads.map(l => l.name + (l.company ? ` @ ${l.company}` : '')).slice(0, 3).join(', ')}${coldLeads.length > 3 ? ` and ${coldLeads.length - 3} more` : ''} have had no activity for 30+ days.`,
          signal_type: 'warning',
          priority: 'medium',
          status: 'active',
        }).then(() => null)
        coldLeadSignals++
      }

      processed++
    } catch (err) {
      console.error(`[cron/health-check] error for biz ${biz.id}:`, err)
    }
  }

  return NextResponse.json({ ok: true, processed, coldLeadSignals })
}
