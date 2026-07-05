import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendDailyBriefEmail } from '@/lib/email'
import Anthropic from '@anthropic-ai/sdk'

// Vercel Cron — runs every day at 6:00 AM UTC
// vercel.json: { "path": "/api/cron/daily-brief", "schedule": "0 6 * * *" }

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  // Get all businesses with their owner profiles
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, industry, health_score, workspace_id, website_intel')
    .limit(500)

  if (!businesses?.length) return NextResponse.json({ ok: true, processed: 0 })

  const client = new Anthropic()
  const isMockAI = !process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key'

  let processed = 0

  for (const biz of businesses) {
    try {
      // Get today's stats
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const iso = todayStart.toISOString()

      const [{ data: todaySignals }, { data: todayLeads }, { data: todayReviews }, { data: latestAudit }] = await Promise.all([
        supabase.from('agent_signals').select('id').eq('business_id', biz.id).gte('created_at', iso),
        supabase.from('leads').select('id').eq('business_id', biz.id).gte('created_at', iso),
        supabase.from('reviews').select('id').eq('business_id', biz.id).gte('created_at', iso),
        supabase.from('audits').select('id, score, report_json').eq('business_id', biz.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])

      const stats = {
        signals: todaySignals?.length ?? 0,
        leads: todayLeads?.length ?? 0,
        reviews: todayReviews?.length ?? 0,
        healthScore: biz.health_score ?? 0,
      }

      // Generate brief summary
      let summary = `Your business health score is ${stats.healthScore}/100. ${stats.signals} signals, ${stats.leads} new leads, ${stats.reviews} new reviews today.`

      if (!isMockAI) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const intel = (biz as any).website_intel as Record<string, unknown> | null
          const intelCtx = intel
            ? `Services: ${(intel.services as string[] | undefined)?.slice(0, 3).join(', ') || '—'}. Target: ${intel.target_market || '—'}. USP: ${intel.unique_value_proposition || '—'}.`
            : ''
          const msg = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 150,
            messages: [{
              role: 'user',
              content: `Write a 2-sentence morning business brief for "${biz.name}" (${biz.industry}). ${intelCtx} Stats: health ${stats.healthScore}/100, ${stats.signals} signals, ${stats.leads} new leads, ${stats.reviews} reviews today. Reference their actual services/market if known. Be encouraging and action-oriented. No markdown.`,
            }],
          })
          summary = msg.content[0].type === 'text' ? msg.content[0].text : summary
        } catch { /* use default summary */ }
      }

      // ── Audit score check ──────────────────────────────────────────
      type AuditTask = { title: string; priority: string }
      const auditReport = latestAudit?.report_json as Record<string, unknown> | null
      const geo = auditReport?.geo as Record<string, unknown> | null
      const scores = auditReport?.scores as Record<string, number> | null
      const geoScore: number = (geo?.geo_score as number) ?? 100
      const perfScore: number = scores?.performance ?? 100
      const geoLow  = geoScore < 65
      const perfLow = perfScore < 70
      const pendingTasks: AuditTask[] = (geoLow || perfLow)
        ? ((geo?.ai_tasks as AuditTask[] | null) ?? []).slice(0, 5)
        : []

      // Create Agent Inbox signals for each pending audit task (deduplicated by title)
      if (pendingTasks.length > 0) {
        const { data: existingSignals } = await supabase
          .from('agent_signals')
          .select('title')
          .eq('business_id', biz.id)
          .eq('dismissed', false)
          .like('title', '[Audit]%')

        const existingTitles = new Set((existingSignals ?? []).map((s: { title: string }) => s.title))

        const newSignals = pendingTasks
          .filter(t => !existingTitles.has(`[Audit] ${t.title}`))
          .map(t => ({
            business_id: biz.id,
            type: t.priority === 'critical' ? 'urgent' : 'warning',
            title: `[Audit] ${t.title}`,
            body: `Your website ${geoLow ? `GEO Score is ${geoScore}/100` : `Performance is ${perfScore}/100`}. Fix this to improve AI discoverability. Go to Audit → AI/GEO → Fix with AI.`,
            action_type: 'open_url',
            action_url: '/audit',
            dismissed: false,
          }))

        if (newSignals.length > 0) {
          await supabase.from('agent_signals').insert(newSignals)
        }
      }

      // ── Blog pending task check + 3-day red escalation ────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const websiteIntel = (biz as any).website_intel as Record<string, unknown> | null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blogIntel = websiteIntel?.blog as Record<string, any> | null
      const blogExists = blogIntel?.exists === true

      // Fetch existing undismissed blog signals with their age
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString()
      const { data: blogSignals } = await supabase
        .from('agent_signals')
        .select('id, title, body, type, created_at')
        .eq('business_id', biz.id)
        .eq('dismissed', false)
        .like('title', '[Blog]%')
        .order('created_at', { ascending: true })

      const pendingBlogTasks: { title: string; body: string; daysOld: number }[] = []

      for (const sig of blogSignals ?? []) {
        const daysOld = Math.floor((Date.now() - new Date(sig.created_at).getTime()) / 86400000)
        pendingBlogTasks.push({ title: sig.title, body: sig.body, daysOld })

        // Escalate to urgent (red) after 3 days if still not dismissed
        if (daysOld >= 3 && sig.type !== 'urgent') {
          await supabase
            .from('agent_signals')
            .update({ type: 'urgent' })
            .eq('id', sig.id)
        }
      }

      // If no blog AND no existing pending signal → re-detect from website_intel
      if (!blogExists && (blogSignals ?? []).length === 0 && websiteIntel) {
        // Only create if audit has been run (website_intel exists)
        await supabase.from('agent_signals').insert({
          business_id: biz.id,
          type: 'opportunity',
          title: '[Blog] Add a blog page to your website',
          body: 'No blog page detected on your website. Businesses with blogs get 67% more leads and rank significantly higher in AI search (ChatGPT, Perplexity, Google SGE). Use Content Generator to create your first post.',
          action_type: 'open_url',
          action_label: 'Open Content Generator',
          dismissed: false,
        })
        pendingBlogTasks.push({
          title: '[Blog] Add a blog page to your website',
          body: 'No blog detected. Create one and publish via Content Generator.',
          daysOld: 0,
        })
      }

      // Store brief as agent signal
      await supabase.from('agent_signals').insert({
        business_id: biz.id,
        type: 'insight',
        title: `Morning Brief — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`,
        body: summary,
        action_type: 'none',
        dismissed: false,
      }).then(() => null)

      // Send email brief to workspace owner if email configured
      if (process.env.RESEND_API_KEY) {
        const { data: members } = await supabase
          .from('workspace_members')
          .select('user_id, role')
          .eq('workspace_id', biz.workspace_id)
          .eq('role', 'owner')
          .limit(1)

        if (members?.[0]) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, name')
            .eq('id', members[0].user_id)
            .single()

          if (profile?.email) {
            await sendDailyBriefEmail(profile.email, profile.name ?? 'there', {
              summary,
              signals: stats.signals,
              leads: stats.leads,
              healthScore: stats.healthScore,
              auditTasks: pendingTasks,
              geoScore: geoLow ? geoScore : undefined,
              perfScore: perfLow ? perfScore : undefined,
              pendingBlogTasks: pendingBlogTasks.length > 0 ? pendingBlogTasks : undefined,
            })
          }
        }
      }

      processed++
    } catch (err) {
      console.error(`[cron/daily-brief] error for biz ${biz.id}:`, err)
    }
  }

  return NextResponse.json({ ok: true, processed })
}
