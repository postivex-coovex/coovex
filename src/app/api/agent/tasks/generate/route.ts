import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

// IDs that indicate a "weak" fallback — AI should replace these
const WEAK_IDS = new Set(['audit-refresh', 'gtm-inbox', 'content-create'])

interface AiSlot {
  source: 'audit' | 'gtm' | 'content'
  hint: string           // what kind of task to generate
  url: string            // action link
}

interface AiTask {
  title: string
  description: string
  tool: string       // CooVex tool name shown on the button
  url: string        // CooVex page URL
}

async function fillWeakSlotsWithAi(
  slots: AiSlot[],
  bizContext: string,
  doneRecently: string[],
): Promise<Record<string, AiTask>> {
  if (slots.length === 0) return {}

  const slotList = slots.map(s => `- ${s.source.toUpperCase()}: ${s.hint}`).join('\n')
  const doneList = doneRecently.length > 0
    ? doneRecently.map(t => `  • ${t}`).join('\n')
    : '  (none yet)'

  const COOVEX_TOOLS = `
CooVex tools available (pick the right one per task):
- Website Audit (/audit) — run/view SEO + GEO health scan, see critical issues
- GEO Optimizer (/geo) — check Gemini/ChatGPT AI visibility, find content gaps
- Leads (/leads) — view pipeline, change lead stages, hot leads list
- GTM Autopilot (/gtm-agent) — one-click: find leads + check AI visibility + action plan
- Competitors (/competitors) — monitor rival websites, pricing, new content
- Content (/content) — create/publish blog posts, LinkedIn posts, newsletters
- GEO Content Ideas (/content/ideas) — AI-suggested topics to boost AI search visibility
- Campaigns (/campaigns) — write and send outreach email campaigns
- Reviews (/reviews) — view unanswered reviews, AI-write responses
- Goals (/goals) — set and track business targets
- Products (/products) — add/update your products/services
- AI Coach (/chat) — ask anything about your business strategy
- Agent Inbox (/agent/inbox) — view all AI signals, opportunities, warnings`

  const prompt = `You are a sharp AI business agent. Generate specific, actionable daily tasks for a business owner that can be completed using CooVex tools.

BUSINESS DATA:
${bizContext}

COOVEX TOOLS:
${COOVEX_TOOLS}

ALREADY COMPLETED RECENTLY (do NOT repeat or paraphrase these):
${doneList}

SLOTS TO FILL (one task per slot):
${slotList}

Rules:
- Each task must be completable IN CooVex — pick the exact tool + URL
- Must reference REAL numbers or facts from the business data above
- Completable in under 30 minutes using CooVex
- Zero generic advice ("improve your marketing", "grow your audience", etc.)
- Must be a NEW action the user hasn't done recently
- Be specific: name leads, mention exact scores, reference actual topics

Return ONLY valid JSON (no markdown):
{
  ${slots.map(s => `"${s.source}": { "title": "...", "description": "...", "tool": "CooVex ToolName", "url": "/correct-path" }`).join(',\n  ')}
}`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as Record<string, AiTask>
  } catch {}

  return {}
}

export async function POST() {
  const supabase = await createClient()
  const service  = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = await supabase
    .from('businesses').select('id, name, industry, health_score, description, target_customer')
    .eq('workspace_id', profile?.current_workspace_id ?? '').maybeSingle()
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const today = new Date().toISOString().split('T')[0]

  // Return existing tasks if already generated today
  const { data: existing } = await supabase
    .from('daily_tasks').select('*').eq('business_id', business.id).eq('date', today).maybeSingle()
  if (existing && (existing.tasks_json as unknown[]).length > 0) {
    return NextResponse.json({ tasks: existing })
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  // ── Fetch real data in parallel ──────────────────────────────────────────────
  const [
    { data: latestAudit },
    { data: pendingSignals },
    { data: draftPosts },
    { data: hotLeads },
    { data: gtmMem },
    { data: geoMem },
    { data: recentDone },
  ] = await Promise.all([
    supabase.from('audits')
      .select('score, report_json, created_at')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('agent_signals')
      .select('id, type, title, body, action_data_json')
      .eq('business_id', business.id).eq('dismissed', false)
      .in('type', ['task', 'opportunity', 'warning'])
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('posts')
      .select('id, title, type, platform')
      .eq('business_id', business.id).in('status', ['draft', 'scheduled'])
      .order('created_at', { ascending: false }).limit(3),
    supabase.from('leads')
      .select('name, company, score, status')
      .eq('business_id', business.id).gte('score', 70)
      .order('score', { ascending: false }).limit(5),
    service.from('agent_memory')
      .select('value_text, updated_at')
      .eq('business_id', business.id).eq('key', 'gtm_last_run').maybeSingle(),
    service.from('agent_memory')
      .select('value_text')
      .eq('business_id', business.id).eq('key', 'geo_intelligence').maybeSingle(),
    supabase.from('daily_tasks')
      .select('tasks_json')
      .eq('business_id', business.id)
      .gte('date', sevenDaysAgo)
      .order('date', { ascending: false }).limit(7),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const auditReport = latestAudit?.report_json as any
  const criticalIssues: Array<{ title: string }> = (auditReport?.issues ?? [])
    .filter((i: { severity: string }) => i.severity === 'critical').slice(0, 2)
  const auditAgeDays = latestAudit?.created_at
    ? Math.floor((Date.now() - new Date(latestAudit.created_at).getTime()) / 86400000)
    : 0

  const gtmLastRunAt = gtmMem?.updated_at ? new Date(gtmMem.updated_at) : null
  const gtmDaysAgo = gtmLastRunAt
    ? Math.floor((Date.now() - gtmLastRunAt.getTime()) / 86400000)
    : null

  let geoGaps: string[] = []
  if (geoMem?.value_text) {
    try {
      const geo = JSON.parse(geoMem.value_text)
      geoGaps = (geo.content_gaps ?? [])
        .filter((g: { impact: string }) => g.impact === 'high').slice(0, 3)
        .map((g: { suggestion?: string; type: string }) => g.suggestion || g.type)
    } catch {}
  }

  // Collect titles of all completed tasks in the last 7 days (to avoid AI repeating them)
  const doneRecently: string[] = (recentDone ?? []).flatMap(r => {
    const arr = r.tasks_json as Array<{ title: string; completed: boolean }>
    return arr.filter(t => t.completed).map(t => t.title)
  })

  // ── Build 3 tasks deterministically ─────────────────────────────────────────

  // TASK 1 — AUDIT
  let task1: Record<string, unknown>
  if (!latestAudit) {
    task1 = {
      id: 'audit-run', source: 'audit', priority: 'critical',
      title: 'Run your Website Audit',
      description: 'AI scans your site for SEO, GEO, and performance issues. 30 seconds · 10 credits.',
      action_type: 'link', action_data: { url: '/audit' }, completed: false,
    }
  } else if (criticalIssues.length > 0) {
    task1 = {
      id: 'audit-fix', source: 'audit', priority: 'high',
      title: `Fix: ${criticalIssues[0].title}`,
      description: criticalIssues.length > 1
        ? `+${criticalIssues.length - 1} more critical issue${criticalIssues.length > 2 ? 's' : ''} in your audit`
        : 'This critical issue is hurting your health score',
      action_type: 'link', action_data: { url: '/audit' }, completed: false,
    }
  } else if (auditAgeDays > 14) {
    task1 = {
      id: 'audit-stale', source: 'audit', priority: 'medium',
      title: `Re-run your audit — it's ${auditAgeDays} days old`,
      description: `Your last audit score was ${latestAudit.score}/100. A fresh scan may reveal new improvements.`,
      action_type: 'link', action_data: { url: '/audit' }, completed: false,
    }
  } else {
    // Weak slot — AI will replace
    task1 = {
      id: 'audit-refresh', source: 'audit', priority: 'medium',
      title: `Audit score ${latestAudit.score}/100 — check recommendations`,
      description: '',
      action_type: 'link', action_data: { url: '/audit' }, completed: false,
    }
  }

  // TASK 2 — GTM / AGENT
  let task2: Record<string, unknown>
  const topSignal = pendingSignals?.[0]
  if (topSignal) {
    const signalUrl = (topSignal.action_data_json as Record<string, string> | null)?.url ?? '/agent/inbox'
    task2 = {
      id: `signal-${topSignal.id}`, source: 'gtm', priority: 'high',
      title: topSignal.title,
      description: topSignal.body?.slice(0, 120) ?? '',
      action_type: 'link', action_data: { url: signalUrl }, completed: false,
    }
  } else if (gtmDaysAgo === null || gtmDaysAgo > 7) {
    task2 = {
      id: 'gtm-run', source: 'gtm', priority: 'high',
      title: gtmDaysAgo === null
        ? 'Run GTM Autopilot — find leads + check Gemini AI visibility'
        : `Run GTM Autopilot — ${gtmDaysAgo} days since last run`,
      description: 'One click: AI finds leads, checks Gemini visibility, generates 3 action items. 30 credits.',
      action_type: 'link', action_data: { url: '/gtm-agent' }, completed: false,
    }
  } else if (hotLeads && hotLeads.length > 0) {
    const lead = hotLeads[0]
    task2 = {
      id: `lead-followup-${lead.name}`, source: 'gtm', priority: 'high',
      title: `Follow up with ${lead.name ?? lead.company} — score ${lead.score}, still in '${lead.status}'`,
      description: `${hotLeads.length} hot lead${hotLeads.length > 1 ? 's' : ''} waiting. A quick message today can move the needle.`,
      action_type: 'link', action_data: { url: '/leads' }, completed: false,
    }
  } else {
    // Weak slot — AI will replace
    task2 = {
      id: 'gtm-inbox', source: 'gtm', priority: 'medium',
      title: 'Review Agent Inbox for new opportunities',
      description: '',
      action_type: 'link', action_data: { url: '/agent/inbox' }, completed: false,
    }
  }

  // TASK 3 — CONTENT
  let task3: Record<string, unknown>
  const topDraft = draftPosts?.[0]
  if (topDraft) {
    const platform = topDraft.platform ?? topDraft.type ?? 'Blog'
    const displayPlatform = String(platform).charAt(0).toUpperCase() + String(platform).slice(1)
    task3 = {
      id: `publish-${topDraft.id}`, source: 'content', priority: 'medium',
      title: `Publish "${(topDraft.title ?? 'your draft').slice(0, 50)}" to ${displayPlatform}`,
      description: draftPosts!.length > 1
        ? `${draftPosts!.length} drafts ready. Publish one today to stay consistent.`
        : 'Your draft is ready — publish it today.',
      action_type: 'link', action_data: { url: '/content' }, completed: false,
    }
  } else if (geoGaps.length > 0) {
    task3 = {
      id: 'content-geo', source: 'content', priority: 'medium',
      title: `Write: ${geoGaps[0]}`,
      description: 'High GEO impact topic — publishing this will boost your Gemini AI visibility.',
      action_type: 'link', action_data: { url: '/content/ideas' }, completed: false,
    }
  } else {
    // Weak slot — AI will replace
    task3 = {
      id: 'content-create', source: 'content', priority: 'low',
      title: 'Create one piece of content today',
      description: '',
      action_type: 'link', action_data: { url: '/content' }, completed: false,
    }
  }

  // ── Replace weak slots with AI-generated specific tasks ─────────────────────
  const weakSlots: AiSlot[] = []
  if (WEAK_IDS.has(String(task1.id))) {
    weakSlots.push({
      source: 'audit',
      hint: `Generate a specific SEO/GEO/website improvement task. Audit score: ${latestAudit?.score}/100, age: ${auditAgeDays} days`,
      url: '/audit',
    })
  }
  if (WEAK_IDS.has(String(task2.id))) {
    weakSlots.push({
      source: 'gtm',
      hint: `Generate a specific GTM/lead/outreach task. Hot leads: ${hotLeads?.length ?? 0}. GTM ran ${gtmDaysAgo ?? 'never'} days ago`,
      url: '/leads',
    })
  }
  if (WEAK_IDS.has(String(task3.id))) {
    weakSlots.push({
      source: 'content',
      hint: `Generate a specific content creation task. GEO gaps: ${geoGaps.join(', ') || 'none'}. Industry: ${business.industry}`,
      url: '/content',
    })
  }

  if (weakSlots.length > 0) {
    // Build compact business context for AI
    const bizContext = [
      `Business: ${business.name} (${business.industry ?? 'unknown industry'})`,
      business.description ? `Description: ${business.description}` : '',
      business.target_customer ? `Target customer: ${business.target_customer}` : '',
      `Health score: ${business.health_score ?? 'N/A'}/100`,
      latestAudit ? `Last audit: ${latestAudit.score}/100, ${auditAgeDays} days ago${criticalIssues.length > 0 ? `, critical issues: ${criticalIssues.map(i => i.title).join('; ')}` : ''}` : 'Audit: not run yet',
      hotLeads?.length ? `Hot leads (score ≥70): ${hotLeads.map(l => `${l.name ?? l.company} (${l.score}, ${l.status})`).join(', ')}` : 'Hot leads: none',
      geoGaps.length ? `High-impact GEO topics: ${geoGaps.join(', ')}` : '',
      gtmDaysAgo !== null ? `GTM last run: ${gtmDaysAgo} days ago` : 'GTM: never run',
    ].filter(Boolean).join('\n')

    const aiResults = await fillWeakSlotsWithAi(weakSlots, bizContext, doneRecently)

    const VALID_PATHS = new Set([
      '/audit', '/geo', '/leads', '/gtm-agent', '/competitors', '/content',
      '/content/ideas', '/content/generator', '/content/needs', '/content/calendar',
      '/campaigns', '/reviews', '/goals', '/products', '/chat', '/agent/inbox',
      '/proposals', '/tools/marketing-plan', '/integrations', '/settings',
      '/geo/ai-visibility', '/geo/topics', '/geo/content', '/geo/dev',
      '/leads/finder', '/execution-roadmap',
    ])

    for (const slot of weakSlots) {
      const ai = aiResults[slot.source]
      if (!ai?.title) continue
      // Sanitize: only use ai.url if it's a known single valid path, else fall back to slot.url
      const aiUrl = typeof ai.url === 'string' && VALID_PATHS.has(ai.url) ? ai.url : slot.url
      const resolvedUrl = aiUrl
      const base = { source: slot.source, priority: 'medium', action_type: 'link', action_data: { url: resolvedUrl, tool: typeof ai.tool === 'string' ? ai.tool : 'CooVex' }, completed: false }
      if (slot.source === 'audit')   task1 = { ...base, id: `ai-audit-${today}`,   title: ai.title, description: ai.description }
      if (slot.source === 'gtm')     task2 = { ...base, id: `ai-gtm-${today}`,     title: ai.title, description: ai.description }
      if (slot.source === 'content') task3 = { ...base, id: `ai-content-${today}`, title: ai.title, description: ai.description }
    }
  }

  const tasks = [task1, task2, task3]

  const { data: row, error } = await supabase
    .from('daily_tasks')
    .upsert({
      business_id: business.id,
      date: today,
      tasks_json: tasks,
      total_count: 3,
      completed_count: 0,
    }, { onConflict: 'business_id,date' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tasks: row })
}
