import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { buildWeeklyDigestEmail } from '@/lib/emails/weekly-digest'

// Vercel Cron: every Monday at 8 AM UTC
// Authorization: Bearer $CRON_SECRET

const RESEND_KEY = () => process.env.RESEND_API_KEY
const FROM = () => `CooVex <${process.env.RESEND_FROM_EMAIL || 'agent@coovex.com'}>`

function weekLabel(): string {
  const now = new Date()
  const start = new Date(now); start.setDate(now.getDate() - 7)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(now)}`
}

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resendKey = RESEND_KEY()
  if (!resendKey) return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })

  const supabase = createServiceClient()
  const results = { sent: 0, skipped: 0, errors: 0 }
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const lastWeekKey  = `digest_${new Date().toISOString().slice(0, 10)}` // e.g. digest_2026-06-30

  // Send to all active users (seen in last 30 days, onboarding done)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data: users } = await supabase
    .from('profiles')
    .select('id, email, name, current_workspace_id, reengagement_sent_at')
    .gte('last_seen_at', thirtyDaysAgo)
    .eq('onboarding_completed', true)
    .not('email', 'is', null)
    .limit(500)

  if (!users?.length) return NextResponse.json({ ok: true, sent: 0 })

  for (const user of users) {
    const sent = (user.reengagement_sent_at as Record<string, string>) ?? {}
    if (sent[lastWeekKey]) { results.skipped++; continue }
    if (!user.current_workspace_id) { results.skipped++; continue }

    const { data: biz } = await supabase
      .from('businesses').select('id, name, health_score')
      .eq('workspace_id', user.current_workspace_id).maybeSingle()
    if (!biz) { results.skipped++; continue }

    const [
      { count: newLeads },
      { count: signals },
      { count: postsCreated },
      { count: reviewsNew },
      { count: proposalsSent },
      { data: deals },
      { data: topSignalRow },
    ] = await Promise.all([
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', biz.id).gte('created_at', sevenDaysAgo),
      supabase.from('agent_signals').select('*', { count: 'exact', head: true }).eq('business_id', biz.id).gte('created_at', sevenDaysAgo),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', biz.id).gte('created_at', sevenDaysAgo),
      supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', biz.id).eq('status', 'new').gte('created_at', sevenDaysAgo),
      supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('business_id', biz.id).gte('created_at', sevenDaysAgo),
      supabase.from('deals').select('value').eq('business_id', biz.id).eq('stage', 'open'),
      supabase.from('agent_signals').select('title').eq('business_id', biz.id).eq('dismissed', false)
        .in('type', ['opportunity', 'urgent']).order('created_at', { ascending: false }).limit(1),
    ])

    const pipelineValue = (deals ?? []).reduce((s, d) => s + (Number(d.value) || 0), 0)

    const { subject, html, text } = buildWeeklyDigestEmail({
      name: user.name ?? '',
      businessName: biz.name,
      weekOf: weekLabel(),
      stats: {
        newLeads:      newLeads ?? 0,
        signals:       signals ?? 0,
        postsCreated:  postsCreated ?? 0,
        reviewsNew:    reviewsNew ?? 0,
        proposalsSent: proposalsSent ?? 0,
        dealsOpen:     (deals ?? []).length,
        pipelineValue,
      },
      topSignal: topSignalRow?.[0]?.title,
      healthScore: biz.health_score ?? 0,
    })

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM(), to: [user.email], subject, html, text }),
      })

      if (res.ok) {
        await supabase.from('profiles')
          .update({ reengagement_sent_at: { ...sent, [lastWeekKey]: new Date().toISOString() } })
          .eq('id', user.id)
        results.sent++
      } else {
        results.errors++
      }
    } catch { results.errors++ }
  }

  return NextResponse.json({ ok: true, ...results })
}
