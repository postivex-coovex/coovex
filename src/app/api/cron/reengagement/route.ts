import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { buildReengagementEmail, type EmailStage } from '@/lib/emails/reengagement'

// Vercel Cron: runs daily at 9 AM UTC
// Authorization: Bearer $CRON_SECRET

const STAGES: { stage: EmailStage; minHours: number; maxHours: number }[] = [
  { stage: 'day2',  minHours: 44,  maxHours: 72  },  // 2–3 days inactive
  { stage: 'day5',  minHours: 116, maxHours: 144 },  // 5–6 days inactive
  { stage: 'day14', minHours: 312, maxHours: 360 },  // 13–15 days inactive
  { stage: 'day30', minHours: 696, maxHours: 768 },  // 29–32 days inactive
]

const RESEND_KEY = () => process.env.RESEND_API_KEY
const FROM = () => `CooVex <${process.env.RESEND_FROM_EMAIL || 'agent@coovex.com'}>`

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resendKey = RESEND_KEY()
  if (!resendKey) return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })

  const supabase = createServiceClient()
  const results = { sent: 0, skipped: 0, errors: 0 }

  for (const { stage, minHours, maxHours } of STAGES) {
    const now = Date.now()
    const rangeStart = new Date(now - maxHours * 3600000).toISOString()
    const rangeEnd   = new Date(now - minHours * 3600000).toISOString()

    const { data: users } = await supabase
      .from('profiles')
      .select('id, email, name, current_workspace_id, reengagement_sent_at')
      .gte('last_seen_at', rangeStart)
      .lte('last_seen_at', rangeEnd)
      .eq('onboarding_completed', true)
      .not('email', 'is', null)
      .limit(200)

    if (!users?.length) continue

    for (const user of users) {
      const sent = (user.reengagement_sent_at as Record<string, string>) ?? {}
      if (sent[stage]) { results.skipped++; continue }

      // Gather personalization context
      let pendingSignals = 0, newLeads = 0, setupPct = 0
      let businessName = 'My Business'

      if (user.current_workspace_id) {
        const { data: biz } = await supabase
          .from('businesses').select('id, name, integrations, social_connections')
          .eq('workspace_id', user.current_workspace_id).maybeSingle()

        if (biz) {
          businessName = biz.name
          const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()

          const [
            { count: signalCount },
            { count: leadCount },
            { count: productCount },
            { count: auditCount },
            { count: postCount },
            { count: proposalCount },
          ] = await Promise.all([
            supabase.from('agent_signals').select('*', { count: 'exact', head: true }).eq('business_id', biz.id).eq('dismissed', false),
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', biz.id).gte('created_at', sevenDaysAgo),
            supabase.from('products').select('*', { count: 'exact', head: true }).eq('business_id', biz.id),
            supabase.from('audits').select('*', { count: 'exact', head: true }).eq('business_id', biz.id),
            supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', biz.id),
            supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('business_id', biz.id),
          ])

          pendingSignals = signalCount ?? 0
          newLeads = leadCount ?? 0

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ig = (biz.integrations as any) ?? {}
          const sc = (biz.social_connections as Record<string, unknown>) ?? {}
          const stepsDone = [
            true,                          // profile always done
            (auditCount ?? 0) > 0,
            (productCount ?? 0) > 0,
            Object.keys(sc).length > 0,
            !!(ig?.smtp?.host || ig?.resend_api_key),
            (postCount ?? 0) > 0,
            (proposalCount ?? 0) > 0,
          ].filter(Boolean).length
          setupPct = Math.round((stepsDone / 7) * 100)
        }
      }

      const { subject, html, text } = buildReengagementEmail({
        name: user.name ?? '',
        email: user.email,
        businessName,
        pendingSignals,
        setupPct,
        newLeads,
        stage,
      })

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: FROM(), to: [user.email], subject, html, text }),
        })

        if (res.ok) {
          await supabase.from('profiles')
            .update({ reengagement_sent_at: { ...sent, [stage]: new Date().toISOString() } })
            .eq('id', user.id)
          results.sent++
        } else {
          results.errors++
        }
      } catch { results.errors++ }
    }
  }

  return NextResponse.json({ ok: true, ...results })
}
