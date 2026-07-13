import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/credits'

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

        // ── Background: search presence + platform detection (runs alongside Steps 2–5) ──
        const searchUrl = process.env.SEARCH_SERVICE_URL
        const bizWebsite = biz.website_url?.startsWith('http') ? biz.website_url : biz.website_url ? `https://${biz.website_url}` : ''
        const bizNameClean = (biz.name ?? '').replace(/['"]/g, '').trim()

        const bgSearchPresence = (async () => {
          if (!bizWebsite) return null
          try {
            const [homeRes, robotsRes] = await Promise.all([
              fetch(bizWebsite, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CooVex/1.0)' } }).catch(() => null),
              fetch(`${bizWebsite}/robots.txt`, { signal: AbortSignal.timeout(5000) }).catch(() => null),
            ])
            if (!homeRes?.ok) return null
            const html = await homeRes.text()
            const robots = robotsRes?.ok ? await robotsRes.text() : ''
            const ga4Match = html.match(/['"`]G-[A-Z0-9]{4,12}['"`]/)
            const gscMatch = html.match(/name=["']google-site-verification["'][^>]*content=["']([^"']+)["']/i) ?? html.match(/content=["']([^"']+)["'][^>]*name=["']google-site-verification["']/i)
            const bingMatch = html.match(/name=["']msvalidate\.01["'][^>]*content=["']([^"']+)["']/i) ?? html.match(/content=["']([^"']+)["'][^>]*name=["']msvalidate\.01["']/i)
            return {
              ga4: !!ga4Match,
              ga4_id: ga4Match?.[0]?.replace(/['"`]/g, '') ?? null,
              gtm: /GTM-[A-Z0-9]{4,8}/.test(html),
              gsc_verified: !!gscMatch,
              gsc_verification_id: gscMatch?.[1]?.slice(0, 10) ?? null,
              bing_verified: !!bingMatch,
              bing_verification_id: bingMatch?.[1]?.slice(0, 10) ?? null,
              sitemap_in_robots: /sitemap\s*:/i.test(robots),
              indexnow_configured: /indexnow/i.test(robots),
            }
          } catch { return null }
        })()

        const DETECT_PLATFORMS = [
          { id: 'product_hunt', domain: 'producthunt.com' },
          { id: 'indie_hackers', domain: 'indiehackers.com' },
          { id: 'g2', domain: 'g2.com' },
          { id: 'capterra', domain: 'capterra.com' },
          { id: 'linkedin', domain: 'linkedin.com/company' },
          { id: 'crunchbase', domain: 'crunchbase.com' },
          { id: 'betalist', domain: 'betalist.com' },
          { id: 'hacker_news', domain: 'news.ycombinator.com' },
        ]

        const bgPlatformDetect = (async () => {
          if (!searchUrl || !bizNameClean) return {}
          const detected: Record<string, boolean> = {}
          await Promise.allSettled(
            DETECT_PLATFORMS.map(async p => {
              try {
                const u = new URL('/search', searchUrl)
                u.searchParams.set('q', `site:${p.domain} "${bizNameClean}"`)
                u.searchParams.set('format', 'json')
                u.searchParams.set('categories', 'general')
                const res = await fetch(u.toString(), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
                if (res.ok) {
                  const data = await res.json()
                  if ((data.results ?? []).length > 0) detected[p.id] = true
                }
              } catch {}
            })
          )
          return detected
        })()

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

        // ── Step 3: AI Lead Finder ────────────────────────────────────────────
        send({ type: 'step', id: 'leads', status: 'running', label: 'Running AI Lead Finder — ICP → company search → email enrichment' })

        let discoveredCount = 0
        let savedLeadsCount = 0
        let hasRealResults = false
        let icpSummary = ''
        let leadIcp: { company_types?: string[]; company_size?: string; industries?: string[]; decision_maker_titles?: string[] } | null = null

        try {
          const cookieStore = await cookies()
          const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ')
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

          const findRes = await fetch(`${appUrl}/api/leads/find`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
            body: JSON.stringify({ audit_id: latestAudit.id }),
            signal: AbortSignal.timeout(55000),
          })

          if (findRes.ok) {
            const findData = await findRes.json()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const candidates: any[] = findData.candidates ?? []
            discoveredCount = candidates.length
            hasRealResults = findData.has_real_results ?? false
            leadIcp = findData.icp ?? null
            if (leadIcp) {
              icpSummary = [
                leadIcp.company_size,
                leadIcp.industries?.slice(0, 2).join(' / '),
              ].filter(Boolean).join(' · ')
            }

            // Auto-save candidates to leads table so they appear in the pipeline
            for (const c of candidates.slice(0, 8)) {
              if (!c.company && !c.name) continue
              const website = c.website
                ? (c.website.startsWith('http') ? c.website : `https://${c.website}`)
                : null
              // Skip if already exists
              if (website) {
                const { data: existing } = await service
                  .from('leads').select('id').eq('business_id', business.id).eq('website', website).maybeSingle()
                if (existing) continue
              }
              const { error: insErr } = await service.from('leads').insert({
                business_id: business.id,
                name: c.name || c.company || 'Unknown',
                company: c.company || null,
                job_title: c.title || null,
                email: c.email || null,
                phone: c.phone || null,
                website,
                source: hasRealResults ? 'gtm_autopilot' : 'gtm_autopilot_icp',
                stage: 'new',
                score: c.fit_score ?? 60,
                notes: [c.fit_reason, !hasRealResults ? '(ICP-generated profile)' : null].filter(Boolean).join(' — ') || null,
              })
              if (!insErr) savedLeadsCount++
            }
          }
        } catch {
          // Non-fatal — lead finder may timeout on slow VPS
        }

        // Re-fetch hot leads count after auto-save
        const { count: hotLeadsAfter } = await supabase
          .from('leads').select('*', { count: 'exact', head: true })
          .eq('business_id', business.id).gte('score', 70)

        send({
          type: 'step', id: 'leads', status: 'done',
          data: { found: discoveredCount, real: hasRealResults, icp: icpSummary, saved: savedLeadsCount },
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

        const icpLine = leadIcp
          ? `ICP: ${leadIcp.company_types?.slice(0, 2).join(', ')} · ${leadIcp.company_size} · Decision makers: ${leadIcp.decision_maker_titles?.slice(0, 2).join(', ')}`
          : 'ICP: not yet determined'

        const aiResponse = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 700,
          messages: [{
            role: 'user',
            content: `You are a GTM strategist. Given this real business data, write 3 specific, concrete GTM actions for this week. Reference real numbers, name specific content pieces or actions. Be direct — no filler.

Business: ${biz.name || 'Unknown'} | Industry: ${biz.industry || 'N/A'} | Website: ${biz.website_url || 'N/A'}
Website Audit: ${auditOverall}/100 overall · GEO ${auditGeo ?? 'N/A'}/100 · SEO ${auditSeo ?? 'N/A'}/100${auditIssues.length ? ' · Critical: ' + auditIssues.join(', ') : ''}
Lead Pipeline: ${totalLeads ?? 0} total · ${newLeads ?? 0} new this week · ${hotLeadsAfter ?? hotLeads ?? 0} hot (≥70 score) · ${savedLeadsCount} just added by AI Finder${hasRealResults ? ' (real companies)' : ' (ICP-generated)'}
AI Lead Finder: ${discoveredCount} companies found (${hasRealResults ? 'real search results' : 'ICP-generated'})
${icpLine}
Top existing lead industries: ${topIndustries.length ? topIndustries.join(', ') : 'not enough data yet'}
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

        // Resolve background tasks
        const [freshSearchPresence, detectedPlatforms] = await Promise.all([bgSearchPresence, bgPlatformDetect])

        // Save fresh search presence to agent_memory
        if (freshSearchPresence) {
          await service.from('agent_memory').upsert(
            { business_id: business.id, key: 'search_presence', value_text: JSON.stringify({ ...freshSearchPresence, checked_at: now.toISOString() }), updated_at: now.toISOString() },
            { onConflict: 'business_id,key' },
          )
        }

        // Save platform presence + auto-mark detected platforms in tracker
        const detectedIds = Object.keys(detectedPlatforms)
        if (detectedIds.length > 0) {
          await service.from('agent_memory').upsert(
            { business_id: business.id, key: 'platform_presence', value_text: JSON.stringify({ detected: detectedPlatforms, checked_at: now.toISOString() }), updated_at: now.toISOString() },
            { onConflict: 'business_id,key' },
          )
          await Promise.allSettled(
            detectedIds.map(platformId =>
              service.from('launch_tracker_platforms').upsert(
                { workspace_id: profile.current_workspace_id, business_id: business.id, platform_id: platformId, status: 'live', updated_at: now.toISOString() },
                { onConflict: 'business_id,platform_id' },
              )
            )
          )
        }

        const inboxBody = [
          `🔍 Audit: ${auditOverall}/100 overall · GEO ${auditGeo ?? 'N/A'}/100${auditAgeDays > 7 ? ' (⚠️ audit is ' + auditAgeDays + ' days old)' : ''}`,
          `👥 ${hotLeadsAfter ?? hotLeads ?? 0} hot leads · ${newLeads ?? 0} new this week · ${discoveredCount} found by AI Finder (${savedLeadsCount} added to pipeline)`,
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
          action_type: 'open_url',
          action_data_json: { url: '/gtm-agent' },
        })

        const runRecord = {
          ran_at: now.toISOString(),
          audit_score: auditOverall,
          audit_geo_score: auditGeo,
          audit_age_days: auditAgeDays,
          total_leads: totalLeads ?? 0,
          new_leads: newLeads ?? 0,
          hot_leads: hotLeadsAfter ?? hotLeads ?? 0,
          discovered_leads: discoveredCount,
          discovered_real: hasRealResults,
          saved_leads: savedLeadsCount,
          icp_summary: icpSummary,
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
