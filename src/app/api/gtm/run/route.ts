import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/credits'
import { searchReddit, scoreLeadQuality } from '@/lib/reddit-client'

export const maxDuration = 120

const anthropic = new Anthropic()

export async function POST() {
  const encoder = new TextEncoder()
  const sseHeaders = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  } as const

  const sseError = (msg: string, code?: number) =>
    new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', msg, code })}\n\n`))
          c.close()
        },
      }),
      { headers: sseHeaders }
    )

  const supabase = await createClient()
  const service = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return sseError('Unauthorized', 401)

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  if (!profile?.current_workspace_id) return sseError('No workspace found')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, website_url, industry, description, target_customer')
    .eq('workspace_id', profile.current_workspace_id)
    .maybeSingle()
  if (!business) return sseError('No business found')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const biz = business as any

  // Prerequisite: must have run website audit first
  const { data: latestAudit } = await supabase
    .from('audits')
    .select('id, score, report_json, created_at')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latestAudit) return sseError('Website Audit required first', 428)

  const { ok, balance } = await deductCredits(
    profile.current_workspace_id,
    'gtm_autopilot',
    'GTM Autopilot run',
  )
  if (!ok) return sseError('Insufficient credits', 402)

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))

      try {
        const now = new Date()
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

        // ── Step 1: Website Audit ──────────────────────────────────────────────
        send({ type: 'step', id: 'audit', status: 'running', label: 'Reading website audit results' })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const auditReport = latestAudit.report_json as any
        const auditOverall = latestAudit.score ?? 0
        const auditGeo = auditReport?.geo?.geo_score ?? null
        const auditSeo = auditReport?.scores?.seo ?? null
        const auditAgeDays = Math.floor(
          (now.getTime() - new Date(latestAudit.created_at).getTime()) / 86400000,
        )
        const auditIssues: string[] = (auditReport?.issues ?? [])
          .filter((i: { severity: string }) => i.severity === 'critical')
          .slice(0, 2)
          .map((i: { title: string }) => i.title)

        send({
          type: 'step', id: 'audit', status: 'done',
          data: { overall: auditOverall, geo: auditGeo, seo: auditSeo, age_days: auditAgeDays, critical_issues: auditIssues },
        })

        // ── Step 2: Lead Pipeline & ICP ────────────────────────────────────────
        send({ type: 'step', id: 'icp', status: 'running', label: 'Analyzing lead pipeline & building ICP' })

        const [
          { count: totalLeads },
          { count: newLeads },
          { count: hotLeads },
          { data: topLeads },
        ] = await Promise.all([
          supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
          supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', sevenDaysAgo),
          supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id).gte('score', 70),
          supabase.from('leads').select('industry, score, status, company_name')
            .eq('business_id', business.id).gte('score', 60)
            .order('score', { ascending: false }).limit(5),
        ])

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const topIndustries = [...new Set((topLeads ?? []).map((l: any) => l.industry).filter(Boolean))] as string[]

        send({
          type: 'step', id: 'icp', status: 'done',
          data: { total: totalLeads ?? 0, new: newLeads ?? 0, hot: hotLeads ?? 0, top_industries: topIndustries },
        })

        // ── Step 3: Lead Discovery via Reddit ─────────────────────────────────
        send({ type: 'step', id: 'leads', status: 'running', label: 'Searching Reddit for lead opportunities via Leads Engine' })

        let discoveredCount = 0
        const keyword = (biz.industry || biz.name || 'b2b saas') as string

        try {
          const posts = await searchReddit(keyword, 20)
          discoveredCount = posts.filter(p => scoreLeadQuality(p) >= 40).length
        } catch {
          // Non-fatal — Reddit may be unreachable
        }

        send({
          type: 'step', id: 'leads', status: 'done',
          data: { discovered: discoveredCount, keyword },
        })

        // ── Step 4: GEO & Gemini AI Visibility ────────────────────────────────
        send({ type: 'step', id: 'geo', status: 'running', label: 'Checking GEO gaps & Gemini AI search visibility' })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let geoIntel: any = null
        let contentGapsCount = 0
        let highImpactGaps = 0
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let geminiVisibility: { visibility_rate: number; checks: any[] } | null = null
        let geoEntityScore: number | null = null

        const { data: geoMem } = await service
          .from('agent_memory')
          .select('value_text, updated_at')
          .eq('business_id', business.id)
          .eq('key', 'geo_intelligence')
          .maybeSingle()

        if (geoMem?.value_text) {
          try {
            geoIntel = JSON.parse(geoMem.value_text)
            contentGapsCount = geoIntel.content_gaps?.length ?? 0
            highImpactGaps = (geoIntel.content_gaps ?? []).filter((g: { impact: string }) => g.impact === 'high').length
            geminiVisibility = geoIntel.actual_ai_visibility ?? null
            geoEntityScore = geoIntel.entity_score ?? null
          } catch {}
        }

        send({
          type: 'step', id: 'geo', status: 'done',
          data: {
            content_gaps: contentGapsCount,
            high_impact: highImpactGaps,
            ai_visibility_rate: geminiVisibility?.visibility_rate ?? null,
            gemini_checks: geminiVisibility?.checks?.length ?? 0,
            entity_score: geoEntityScore,
            stale: !geoMem,
          },
        })

        // ── Step 5: AI Action Plan ─────────────────────────────────────────────
        send({ type: 'step', id: 'ai', status: 'running', label: 'Generating GTM action plan with AI' })

        const [
          { count: draftCount },
          { count: scheduledCount },
          { count: compCount },
          { data: latestComp },
        ] = await Promise.all([
          supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', business.id).eq('status', 'draft'),
          supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', business.id).eq('status', 'scheduled'),
          supabase.from('competitors').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
          supabase.from('competitors').select('name').eq('business_id', business.id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        ])

        const geoGapList = geoIntel?.content_gaps
          ?.slice(0, 3)
          .map((g: { suggestion?: string; type: string }) => g.suggestion || g.type)
          .join(' · ') ?? 'none identified yet'

        const visLine = geminiVisibility?.visibility_rate != null
          ? `Gemini AI search visibility: ${geminiVisibility.visibility_rate}% (found in ${geminiVisibility.checks.filter(c => c.found).length}/${geminiVisibility.checks.length} searches)`
          : 'GEO Intelligence not yet run — user should run GEO Optimizer for Gemini visibility check'

        const aiResponse = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 700,
          messages: [{
            role: 'user',
            content: `You are a GTM strategist. Given this real business data, write 3 specific, concrete GTM actions for this week. Reference real numbers, name specific content pieces or actions. Be direct — no filler.

Business: ${biz.name || 'Unknown'} | Industry: ${biz.industry || 'N/A'} | Website: ${biz.website_url || 'N/A'}
Website Audit: ${auditOverall}/100 overall · GEO ${auditGeo ?? 'N/A'}/100 · SEO ${auditSeo ?? 'N/A'}/100${auditIssues.length ? ' · Critical: ' + auditIssues.join(', ') : ''}
Lead Pipeline: ${totalLeads ?? 0} total · ${newLeads ?? 0} new this week · ${hotLeads ?? 0} hot (≥70 score)
Reddit lead opportunities found: ${discoveredCount} (keyword: "${keyword}")
Top lead industries: ${topIndustries.length ? topIndustries.join(', ') : 'not enough data yet'}
Content: ${draftCount ?? 0} drafts · ${scheduledCount ?? 0} scheduled
Competitors tracked: ${compCount ?? 0}${latestComp ? ` (latest: ${latestComp.name})` : ''}
GEO content gaps: ${contentGapsCount} · ${highImpactGaps} high-impact (top: ${geoGapList})
${visLine}

Return EXACTLY this JSON (no markdown):
{"actions":[{"title":"...","detail":"...","priority":"high"|"medium","link":"/leads"|"/content"|"/competitors"|"/content/ideas"|"/audit"|"/trends"},{"title":"...","detail":"...","priority":"high"|"medium","link":"..."},{"title":"...","detail":"...","priority":"high"|"medium","link":"..."}],"summary":"2-sentence GTM health summary with specific numbers"}`,
          }],
        })

        let gtmActions: { title: string; detail: string; priority: 'high' | 'medium'; link: string }[] = []
        let gtmSummary = ''
        try {
          const text = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text.trim() : '{}'
          const parsed = JSON.parse(text)
          gtmActions = parsed.actions ?? []
          gtmSummary = parsed.summary ?? ''
        } catch {}

        send({ type: 'step', id: 'ai', status: 'done', data: { actions: gtmActions, summary: gtmSummary } })

        // ── Step 6: Save & Inbox ───────────────────────────────────────────────
        send({ type: 'step', id: 'inbox', status: 'running', label: 'Saving results to Agent Inbox' })

        const inboxBody = [
          `🔍 Audit: ${auditOverall}/100 overall · GEO ${auditGeo ?? 'N/A'}/100${auditAgeDays > 7 ? ' (⚠️ audit is ' + auditAgeDays + ' days old)' : ''}`,
          `👥 ${hotLeads ?? 0} hot leads · ${newLeads ?? 0} new this week · ${discoveredCount} Reddit opportunities found`,
          geminiVisibility?.visibility_rate != null
            ? `🧠 Gemini AI visibility: ${geminiVisibility.visibility_rate}% · ${highImpactGaps} high-impact GEO gaps`
            : '🧠 GEO not analyzed yet — run GEO Optimizer to check Gemini visibility',
          `✍️ ${draftCount ?? 0} content drafts · ${scheduledCount ?? 0} scheduled`,
        ].join('\n')

        await service.from('agent_signals').insert({
          business_id: business.id,
          type: 'insight',
          title: '🚀 GTM Autopilot Complete',
          body: inboxBody,
          action_label: 'View GTM Dashboard',
          action_url: '/gtm-agent',
        })

        const runRecord = {
          ran_at: now.toISOString(),
          audit_score: auditOverall,
          audit_geo_score: auditGeo,
          audit_age_days: auditAgeDays,
          total_leads: totalLeads ?? 0,
          new_leads: newLeads ?? 0,
          hot_leads: hotLeads ?? 0,
          discovered_leads: discoveredCount,
          draft_posts: draftCount ?? 0,
          scheduled_posts: scheduledCount ?? 0,
          competitors: compCount ?? 0,
          content_gaps: contentGapsCount,
          high_impact_gaps: highImpactGaps,
          ai_visibility_rate: geminiVisibility?.visibility_rate ?? null,
          actions: gtmActions,
          summary: gtmSummary,
        }

        await service.from('agent_memory').upsert(
          {
            business_id: business.id,
            key: 'gtm_last_run',
            value_text: JSON.stringify(runRecord),
            updated_at: now.toISOString(),
          },
          { onConflict: 'business_id,key' },
        )

        send({ type: 'done', result: runRecord, balance })
      } catch (e) {
        send({ type: 'error', msg: e instanceof Error ? e.message : 'GTM run failed' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: sseHeaders })
}

export async function GET() {
  const supabase = await createClient()
  const service = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ lastRun: null })

  const { data: mem } = await service
    .from('agent_memory').select('value_text')
    .eq('business_id', business.id).eq('key', 'gtm_last_run').maybeSingle()

  const lastRun = mem?.value_text ? JSON.parse(mem.value_text) : null
  return NextResponse.json({ lastRun })
}
