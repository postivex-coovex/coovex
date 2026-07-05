import { createServiceClient } from '@/lib/supabase/server'

/**
 * Reads ALL relevant business data from DB — current state + full history —
 * and writes a comprehensive context to agent_memory (key: 'business_context').
 * Uses service client to bypass RLS.
 */
// maxAgeMs: skip sync if memory is fresher than this. Pass 0 to force.
export async function syncBusinessMemory(businessId: string, workspaceId: string, maxAgeMs = 5 * 60 * 1000) {
  const supabase = await createServiceClient()

  if (maxAgeMs > 0) {
    const { data: fresh } = await supabase
      .from('agent_memory')
      .select('updated_at')
      .eq('business_id', businessId)
      .eq('key', 'business_context')
      .maybeSingle()
    if (fresh?.updated_at && Date.now() - new Date(fresh.updated_at).getTime() < maxAgeMs) {
      return null // recently synced — skip
    }
  }

  const now = new Date()
  const sevenDaysAgo  = new Date(now.getTime() - 7  * 86400000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString()

  // ── Phase 1: all queries in parallel ────────────────────────────────────────
  const [
    { data: business },
    { data: allAudits },
    { data: allLeads },
    { data: hotLeads },
    { data: allReviews },
    { data: recentPosts },
    { count: draftsCount },
    { data: integrations },
    { data: products },
    { data: openDeals },
    { data: campaigns },
    { data: allDailyTasks },
    { data: competitors },
    { data: agentSignals },
    { data: orchRuns },
    { data: chatSessions },
    { data: goals },
    { data: proposals },
  ] = await Promise.all([
    // Business
    supabase.from('businesses')
      .select('name, industry, health_score, website_url, website_intel, description, target_customer, country, size')
      .eq('id', businessId).single(),

    // All audits for full score history
    supabase.from('audits')
      .select('id, score, created_at, report_json')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false }).limit(20),

    // All leads — current snapshot
    supabase.from('leads')
      .select('id, name, company, stage, score, source, created_at, job_title, email, phone')
      .eq('business_id', businessId),

    // Hot leads (score ≥ 70, active)
    supabase.from('leads')
      .select('id, name, score, stage, company, job_title')
      .eq('business_id', businessId)
      .gte('score', 70)
      .not('stage', 'in', '("won","lost")')
      .order('score', { ascending: false }).limit(10),

    // All reviews
    supabase.from('reviews')
      .select('rating, status, platform, review_text, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false }).limit(50),

    // Recent posts (90 days for trend)
    supabase.from('posts')
      .select('status, channel, title, created_at')
      .eq('business_id', businessId)
      .gte('created_at', ninetyDaysAgo)
      .order('created_at', { ascending: false }),

    // Draft count
    supabase.from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId).eq('status', 'draft'),

    // Integrations
    supabase.from('integrations')
      .select('type, status, created_at')
      .eq('business_id', businessId),

    // Products
    supabase.from('products')
      .select('id, name, type, status, price, currency, tagline')
      .eq('business_id', businessId),

    // Open deals
    supabase.from('deals')
      .select('value, status, name, created_at')
      .eq('business_id', businessId).eq('status', 'open'),

    // Email campaigns (90 days)
    supabase.from('email_campaigns')
      .select('name, status, open_rate, click_rate, created_at')
      .eq('business_id', businessId)
      .gte('created_at', ninetyDaysAgo)
      .order('created_at', { ascending: false }),

    // Daily tasks — 90 days for behavior pattern
    supabase.from('daily_tasks')
      .select('tasks_json, completed_count, total_count, date')
      .eq('business_id', businessId)
      .gte('date', ninetyDaysAgo.split('T')[0])
      .order('date', { ascending: false }),

    // Competitors
    supabase.from('competitors')
      .select('name, website, notes')
      .eq('business_id', businessId).limit(10),

    // Agent signals — last 90 days (all, including dismissed)
    supabase.from('agent_signals')
      .select('type, title, body, dismissed, created_at')
      .eq('business_id', businessId)
      .gte('created_at', ninetyDaysAgo)
      .order('created_at', { ascending: false }).limit(50),

    // Orchestration runs — what the AI agent did
    supabase.from('orchestration_runs')
      .select('rule_name, event_type, signals_created, status, created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', ninetyDaysAgo)
      .order('created_at', { ascending: false }).limit(50),

    // Chat sessions — what user asked the AI (last 10 sessions)
    supabase.from('chat_sessions')
      .select('messages_json, created_at, updated_at')
      .eq('business_id', businessId)
      .order('updated_at', { ascending: false }).limit(10),

    // Goals
    supabase.from('goals')
      .select('title, target_value, current_value, unit, deadline, status, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false }).limit(20),

    // Recent proposals
    supabase.from('proposals')
      .select('title, status, total_amount, created_at, sent_at, viewed_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false }).limit(20),
  ])

  // ── Phase 2: lead activities (need lead IDs from phase 1) ─────────────────
  const leadIds = (allLeads ?? []).map(l => l.id).filter(Boolean)
  const { data: leadActivities } = leadIds.length > 0
    ? await supabase.from('lead_activities')
        .select('lead_id, activity_type, data_json, created_at')
        .in('lead_id', leadIds)
        .gte('created_at', ninetyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: [] }

  // ── Compute: Leads ────────────────────────────────────────────────────────
  const leadsByStage: Record<string, number> = {}
  const leadsBySource: Record<string, number> = {}
  let newLeads7d = 0, newLeads30d = 0
  for (const l of allLeads ?? []) {
    leadsByStage[l.stage] = (leadsByStage[l.stage] ?? 0) + 1
    if (l.source) leadsBySource[l.source] = (leadsBySource[l.source] ?? 0) + 1
    if (l.created_at >= sevenDaysAgo)  newLeads7d++
    if (l.created_at >= thirtyDaysAgo) newLeads30d++
  }

  // Lead activity summary per lead
  const activityByLead: Record<string, string[]> = {}
  for (const a of leadActivities ?? []) {
    if (!activityByLead[a.lead_id]) activityByLead[a.lead_id] = []
    activityByLead[a.lead_id].push(`${a.activity_type} on ${a.created_at.split('T')[0]}`)
  }

  // Lead activity type counts (last 90d)
  const activityTypeCounts: Record<string, number> = {}
  for (const a of leadActivities ?? []) {
    activityTypeCounts[a.activity_type] = (activityTypeCounts[a.activity_type] ?? 0) + 1
  }

  // ── Compute: Reviews ──────────────────────────────────────────────────────
  let totalRating = 0, ratingCount = 0, negativeUnanswered = 0
  const reviewsByPlatform: Record<string, number> = {}
  for (const r of allReviews ?? []) {
    if (r.rating) { totalRating += r.rating; ratingCount++ }
    if (r.status === 'new' && r.rating <= 3) negativeUnanswered++
    if (r.platform) reviewsByPlatform[r.platform] = (reviewsByPlatform[r.platform] ?? 0) + 1
  }
  const avgRating = ratingCount > 0 ? Math.round((totalRating / ratingCount) * 10) / 10 : null
  const unansweredCount = (allReviews ?? []).filter(r => r.status === 'new').length

  // ── Compute: Tasks / behavior ─────────────────────────────────────────────
  let totalTaskCount = 0, completedTaskCount = 0
  const tasksByWeek: Record<string, { completed: number; total: number }> = {}
  for (const dt of allDailyTasks ?? []) {
    totalTaskCount  += dt.total_count ?? 0
    completedTaskCount += dt.completed_count ?? 0
    // Group by week (YYYY-WW)
    const d = new Date(dt.date)
    const weekKey = `${d.getFullYear()}-W${String(Math.ceil((d.getDate()) / 7)).padStart(2, '0')}`
    if (!tasksByWeek[weekKey]) tasksByWeek[weekKey] = { completed: 0, total: 0 }
    tasksByWeek[weekKey].completed += dt.completed_count ?? 0
    tasksByWeek[weekKey].total     += dt.total_count ?? 0
  }
  const recentTasks7d = (allDailyTasks ?? []).filter(t => t.date >= sevenDaysAgo.split('T')[0])
  const recentTotal7d = recentTasks7d.reduce((s, t) => s + (t.total_count ?? 0), 0)
  const recentDone7d  = recentTasks7d.reduce((s, t) => s + (t.completed_count ?? 0), 0)

  // ── Compute: Audit history ────────────────────────────────────────────────
  const latestAuditRow = allAudits?.[0]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const auditReport = latestAuditRow?.report_json as Record<string, any> | null
  const criticalIssues = (auditReport?.issues as Array<{ title: string; severity: string }> | null)
    ?.filter(i => i.severity === 'critical').slice(0, 5).map(i => i.title) ?? []
  const auditScoreHistory = (allAudits ?? []).map(a => ({
    score: a.score,
    date: a.created_at.split('T')[0],
  }))
  // Trend: is score improving?
  const auditTrend = auditScoreHistory.length >= 2
    ? auditScoreHistory[0].score - auditScoreHistory[1].score
    : null

  // ── Compute: Pipeline ─────────────────────────────────────────────────────
  const pipelineValue = (openDeals ?? []).reduce((s, d) => s + (Number(d.value) || 0), 0)

  // ── Compute: Content ──────────────────────────────────────────────────────
  const publishedPosts = (recentPosts ?? []).filter(p => p.status === 'published')
  const publishedChannels = [...new Set(publishedPosts.map(p => p.channel))]
  const published30d = publishedPosts.filter(p => p.created_at >= thirtyDaysAgo).length

  // ── Compute: Agent signals history ────────────────────────────────────────
  const signalsByType: Record<string, number> = {}
  const recentUndismissedSignals = (agentSignals ?? []).filter(s => !s.dismissed).slice(0, 10)
  for (const s of agentSignals ?? []) {
    signalsByType[s.type] = (signalsByType[s.type] ?? 0) + 1
  }

  // ── Compute: Orchestration history ────────────────────────────────────────
  const ruleRunCounts: Record<string, number> = {}
  for (const r of orchRuns ?? []) {
    ruleRunCounts[r.rule_name] = (ruleRunCounts[r.rule_name] ?? 0) + 1
  }

  // ── Compute: Chat history ─────────────────────────────────────────────────
  const chatHistory = (chatSessions ?? []).map(session => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages = (session.messages_json as any[]) ?? []
    const userMessages = messages
      .filter((m: { role: string }) => m.role === 'user')
      .slice(-3)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => String(m.content ?? '').slice(0, 200))
    return {
      date: session.updated_at?.split('T')[0] ?? session.created_at?.split('T')[0],
      message_count: messages.length,
      recent_user_queries: userMessages,
    }
  })

  // ── Compute: Goals ────────────────────────────────────────────────────────
  const activeGoals = (goals ?? []).filter(g => g.status !== 'completed' && g.status !== 'cancelled')
  const completedGoals = (goals ?? []).filter(g => g.status === 'completed').length

  // ── Compute: Proposals ───────────────────────────────────────────────────
  const sentProposals = (proposals ?? []).filter(p => p.sent_at)
  const viewedProposals = (proposals ?? []).filter(p => p.viewed_at)

  // ── Build full context ────────────────────────────────────────────────────
  const context = {
    synced_at: now.toISOString(),

    // ── Current state ──
    business: {
      name: business?.name,
      industry: business?.industry,
      health_score: business?.health_score,
      website_url: business?.website_url,
      description: business?.description,
      target_customer: business?.target_customer,
      country: business?.country,
      size: business?.size,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      website_intel: (business as any)?.website_intel ?? null,
    },

    audit: latestAuditRow ? {
      latest_score: latestAuditRow.score,
      latest_date: latestAuditRow.created_at,
      grade: auditReport?.grade ?? null,
      summary: auditReport?.summary ?? null,
      critical_issues: criticalIssues,
      wins: (auditReport?.wins as string[] | null)?.slice(0, 5) ?? [],
      score_history: auditScoreHistory,        // full trend
      score_trend: auditTrend,                 // +/- vs previous
      total_audits_run: (allAudits ?? []).length,
    } : null,

    leads: {
      total: (allLeads ?? []).length,
      new_7d: newLeads7d,
      new_30d: newLeads30d,
      hot_count: (hotLeads ?? []).length,
      hot_leads: (hotLeads ?? []).map(l => ({
        name: l.name, company: l.company, score: l.score,
        stage: l.stage, job_title: l.job_title,
        recent_activity: activityByLead[l.id]?.slice(0, 3) ?? [],
      })),
      by_stage: leadsByStage,
      by_source: leadsBySource,
      // Full lead list for AI reference
      all: (allLeads ?? []).map(l => ({
        name: l.name, company: l.company, stage: l.stage,
        score: l.score, source: l.source,
        created: l.created_at.split('T')[0],
      })),
    },

    lead_activity_history: {
      total_actions_90d: (leadActivities ?? []).length,
      by_type: activityTypeCounts,
      recent: (leadActivities ?? []).slice(0, 20).map(a => {
        const lead = (allLeads ?? []).find(l => l.id === a.lead_id)
        return {
          lead_name: lead?.name ?? 'Unknown',
          action: a.activity_type,
          date: a.created_at.split('T')[0],
        }
      }),
    },

    reviews: {
      total: (allReviews ?? []).length,
      avg_rating: avgRating,
      unanswered: unansweredCount,
      negative_unanswered: negativeUnanswered,
      by_platform: reviewsByPlatform,
      recent_negative: (allReviews ?? [])
        .filter(r => r.rating <= 3 && r.status === 'new')
        .slice(0, 5)
        .map(r => ({ platform: r.platform, rating: r.rating, snippet: r.review_text?.slice(0, 150) ?? '' })),
    },

    content: {
      published_30d: published30d,
      published_90d: publishedPosts.length,
      drafts_pending: draftsCount ?? 0,
      channels_active: publishedChannels,
      recent_titles: publishedPosts.slice(0, 5).map(p => ({ title: p.title, channel: p.channel, date: p.created_at.split('T')[0] })),
    },

    integrations: {
      connected: (integrations ?? []).filter(i => i.status === 'connected').map(i => i.type),
      disconnected: (integrations ?? []).filter(i => i.status !== 'connected').map(i => i.type),
      connected_since: (integrations ?? []).filter(i => i.status === 'connected').map(i => ({
        type: i.type, since: i.created_at?.split('T')[0],
      })),
    },

    products: {
      total: (products ?? []).length,
      active: (products ?? []).filter(p => p.status === 'active').map(p => ({
        name: p.name, type: p.type, tagline: p.tagline,
        price: p.price ? `${p.currency} ${p.price}` : null,
      })),
    },

    pipeline: {
      open_deals: (openDeals ?? []).length,
      total_value: pipelineValue,
      deals: (openDeals ?? []).map(d => ({ name: d.name, value: d.value, created: d.created_at?.split('T')[0] })),
    },

    campaigns: {
      total_90d: (campaigns ?? []).length,
      total_30d: (campaigns ?? []).filter(c => c.created_at >= thirtyDaysAgo).length,
      recent: (campaigns ?? []).slice(0, 5).map(c => ({
        name: c.name, status: c.status, open_rate: c.open_rate, click_rate: c.click_rate,
      })),
    },

    goals: {
      active: activeGoals.map(g => ({
        title: g.title,
        progress_pct: g.target_value > 0 ? Math.round((g.current_value / g.target_value) * 100) : 0,
        current: g.current_value,
        target: g.target_value,
        unit: g.unit,
        deadline: g.deadline,
        status: g.status,
      })),
      completed_total: completedGoals,
    },

    proposals: {
      total: (proposals ?? []).length,
      sent: sentProposals.length,
      viewed: viewedProposals.length,
      recent: (proposals ?? []).slice(0, 5).map(p => ({
        title: p.title, status: p.status,
        amount: p.total_amount,
        sent: p.sent_at?.split('T')[0] ?? null,
        viewed: p.viewed_at?.split('T')[0] ?? null,
      })),
    },

    competitors: (competitors ?? []).map(c => ({ name: c.name, website: c.website, notes: c.notes })),

    // ── Task behavior (how active is the user) ──
    tasks: {
      completion_rate_7d: recentTotal7d > 0 ? Math.round((recentDone7d / recentTotal7d) * 100) : null,
      completion_rate_90d: totalTaskCount > 0 ? Math.round((completedTaskCount / totalTaskCount) * 100) : null,
      completed_7d: recentDone7d,
      total_7d: recentTotal7d,
      weekly_trend: Object.entries(tasksByWeek).slice(0, 8).map(([week, data]) => ({
        week, rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      })),
      today: (allDailyTasks ?? [])[0] ?? null,
    },

    // ── AI agent history ──
    agent_history: {
      signals_90d: (agentSignals ?? []).length,
      signals_by_type: signalsByType,
      pending_signals: recentUndismissedSignals.map(s => ({ type: s.type, title: s.title, date: s.created_at.split('T')[0] })),
      actions_taken_90d: (orchRuns ?? []).length,
      rules_triggered: ruleRunCounts,
      recent_actions: (orchRuns ?? []).slice(0, 10).map(r => ({
        rule: r.rule_name, event: r.event_type,
        signals_created: r.signals_created,
        date: r.created_at.split('T')[0],
      })),
    },

    // ── User ↔ AI conversation history ──
    chat_history: {
      total_sessions: (chatSessions ?? []).length,
      sessions: chatHistory,
    },
  }

  const valueText = JSON.stringify(context)
  const nowStr = now.toISOString()

  const { data: existing } = await supabase
    .from('agent_memory')
    .select('id')
    .eq('business_id', businessId)
    .eq('key', 'business_context')
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('agent_memory')
      .update({ value_text: valueText, updated_at: nowStr })
      .eq('business_id', businessId)
      .eq('key', 'business_context')
    if (error) throw new Error(`agent_memory update: ${error.message} (code: ${error.code})`)
  } else {
    const { error } = await supabase
      .from('agent_memory')
      .insert({ business_id: businessId, key: 'business_context', value_text: valueText, updated_at: nowStr })
    if (error) throw new Error(`agent_memory insert: ${error.message} (code: ${error.code})`)
  }

  return context
}

/**
 * Read the cached business context from agent_memory.
 * Returns null if not yet synced.
 */
export async function readBusinessContext(businessId: string) {
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from('agent_memory')
    .select('value_text, updated_at')
    .eq('business_id', businessId)
    .eq('key', 'business_context')
    .maybeSingle()

  if (!data?.value_text) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse(data.value_text) as Record<string, any>
  } catch {
    return null
  }
}
