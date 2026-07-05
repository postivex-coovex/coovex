import { createServiceClient } from '@/lib/supabase/server'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BusinessEvent {
  id: string
  workspace_id: string
  event_type: string
  entity_type: string | null
  entity_id: string | null
  event_data_json: Record<string, unknown>
  created_at: string
}

interface ActionResult {
  type: string
  status: 'ok' | 'skipped' | 'error'
  detail?: string
}

interface BuiltinRule {
  id: string
  name: string
  eventTypes: string[]           // which event types this rule handles
  confidence: number
  execute: (
    event: BusinessEvent,
    businessId: string,
    workspaceId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx: Record<string, any>
  ) => Promise<ActionResult[]>
}

// ── Built-in rules ────────────────────────────────────────────────────────────

async function createSignal(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  businessId: string,
  signal: {
    type: 'urgent' | 'warning' | 'opportunity' | 'insight' | 'done'
    title: string
    body: string
    action_label?: string
    action_type?: string
    action_data_json?: Record<string, unknown>
  }
): Promise<ActionResult> {
  // Deduplicate: skip if same title exists in last 24h
  const since = new Date(Date.now() - 86400000).toISOString()
  const { count } = await supabase
    .from('agent_signals')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('title', signal.title)
    .gte('created_at', since)

  if ((count ?? 0) > 0) return { type: 'create_signal', status: 'skipped', detail: 'duplicate in 24h' }

  const { error } = await supabase.from('agent_signals').insert({
    business_id: businessId,
    type: signal.type,
    title: signal.title,
    body: signal.body,
    action_label: signal.action_label ?? null,
    action_type: signal.action_type ?? 'none',
    action_data_json: signal.action_data_json ?? null,
    dismissed: false,
  })

  return error
    ? { type: 'create_signal', status: 'error', detail: error.message }
    : { type: 'create_signal', status: 'ok', detail: signal.title }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeStr(v: unknown, fallback = '—'): string {
  return typeof v === 'string' ? v : fallback
}
function safeNum(v: unknown, fallback = 0): number {
  return typeof v === 'number' ? v : fallback
}

const BUILTIN_RULES: BuiltinRule[] = [
  // ── Lead: high score ────────────────────────────────────────────────────────
  {
    id: 'lead.hot_detected',
    name: 'Hot Lead Detected',
    eventTypes: ['lead.score_high'],
    confidence: 90,
    async execute(event, businessId) {
      const supabase = await createServiceClient()
      const name  = safeStr(event.event_data_json.name, 'A lead')
      const score = safeNum(event.event_data_json.score)
      const stage = safeStr(event.event_data_json.stage, 'pipeline')
      const leadId = safeStr(event.entity_id ?? '')
      return [await createSignal(supabase, businessId, {
        type: 'opportunity',
        title: `${name} — score hit ${score}, ready to close`,
        body: `${name} is at ${stage} stage with a high intent score of ${score}. Follow up now while interest is at its peak.`,
        action_label: 'View lead',
        action_type: 'view_lead',
        action_data_json: leadId ? { lead_id: leadId } : undefined,
      })]
    },
  },

  // ── Lead: score dropped ─────────────────────────────────────────────────────
  {
    id: 'lead.score_drop',
    name: 'Lead Score Dropped',
    eventTypes: ['lead.score_drop'],
    confidence: 80,
    async execute(event, businessId) {
      const supabase = await createServiceClient()
      const name    = safeStr(event.event_data_json.name, 'A lead')
      const oldScore = safeNum(event.event_data_json.old_score)
      const newScore = safeNum(event.event_data_json.new_score)
      const leadId   = safeStr(event.entity_id ?? '')
      return [await createSignal(supabase, businessId, {
        type: 'warning',
        title: `${name} — engagement dropped (${oldScore} → ${newScore})`,
        body: `${name}'s lead score dropped significantly. They may be evaluating competitors. A personalized re-engagement now could recover this opportunity.`,
        action_label: 'View lead',
        action_type: 'view_lead',
        action_data_json: leadId ? { lead_id: leadId } : undefined,
      })]
    },
  },

  // ── Lead: stuck in stage ────────────────────────────────────────────────────
  {
    id: 'lead.stuck',
    name: 'Leads Going Cold',
    eventTypes: ['lead.stuck'],
    confidence: 75,
    async execute(event, businessId) {
      const supabase = await createServiceClient()
      const count = safeNum(event.event_data_json.count, 1)
      const days  = safeNum(event.event_data_json.days, 7)
      const value = safeNum(event.event_data_json.pipeline_value)
      return [await createSignal(supabase, businessId, {
        type: 'warning',
        title: `${count} lead${count > 1 ? 's' : ''} stuck for ${days}+ days — going cold`,
        body: `${count} lead${count > 1 ? 's are' : ' is'} stalled with no activity for ${days}+ days. Pipeline at risk: $${value.toLocaleString()}. A quick follow-up could revive them.`,
        action_label: 'View leads',
        action_type: 'view_lead',
      })]
    },
  },

  // ── Review: negative ────────────────────────────────────────────────────────
  {
    id: 'review.negative',
    name: 'Negative Review Alert',
    eventTypes: ['review.negative_new'],
    confidence: 95,
    async execute(event, businessId) {
      const supabase = await createServiceClient()
      const platform = safeStr(event.event_data_json.platform, 'a review platform')
      const rating   = safeNum(event.event_data_json.rating, 1)
      const count    = safeNum(event.event_data_json.count, 1)
      return [await createSignal(supabase, businessId, {
        type: 'urgent',
        title: `${count} negative review${count > 1 ? 's' : ''} on ${platform} need response`,
        body: `A ${rating}★ review on ${platform} is unanswered. Businesses that respond within 24h see 33% more trust conversions. Respond now to control the narrative.`,
        action_label: 'Respond now',
        action_type: 'respond_review',
      })]
    },
  },

  // ── Audit: completed ────────────────────────────────────────────────────────
  {
    id: 'audit.completed',
    name: 'Audit Completed',
    eventTypes: ['audit.completed'],
    confidence: 100,
    async execute(event, businessId) {
      const supabase = await createServiceClient()
      const score  = safeNum(event.event_data_json.score)
      const grade  = safeStr(event.event_data_json.grade, '—')
      const issues = safeNum(event.event_data_json.critical_issues)
      const type   = score < 50 ? 'warning' : score < 75 ? 'insight' : 'done'
      const title  = score < 50
        ? `Audit complete — score ${score}/100 needs urgent attention`
        : score < 75
          ? `Audit complete — score ${score}/100 (${issues} critical issues)`
          : `Audit complete — strong score ${score}/100 (Grade ${grade})`
      return [await createSignal(supabase, businessId, {
        type,
        title,
        body: score < 50
          ? `Your site scored ${score}/100 with ${issues} critical issue${issues !== 1 ? 's' : ''}. Fixing these can significantly improve leads and conversions.`
          : `Your website audit is done. Grade ${grade} — ${issues > 0 ? `${issues} critical issues found` : 'no critical issues'}. Review the full report to find optimization opportunities.`,
        action_label: 'View report',
        action_type: 'view_report',
      })]
    },
  },

  // ── Goal: behind target ─────────────────────────────────────────────────────
  {
    id: 'goal.behind_target',
    name: 'Goal Behind Target',
    eventTypes: ['goal.behind_target'],
    confidence: 80,
    async execute(event, businessId) {
      const supabase = await createServiceClient()
      const name    = safeStr(event.event_data_json.goal_name, 'A goal')
      const pct     = safeNum(event.event_data_json.completion_pct)
      const daysLeft = safeNum(event.event_data_json.days_remaining)
      return [await createSignal(supabase, businessId, {
        type: 'warning',
        title: `Goal "${name}" is ${pct}% complete — ${daysLeft}d left`,
        body: `You are behind on "${name}". With ${daysLeft} days remaining and ${pct}% done, you need to accelerate to hit the target. Review your action plan.`,
        action_label: 'View goals',
        action_type: 'open_url',
        action_data_json: { url: '/goals' },
      })]
    },
  },

  // ── Competitor: new insight ──────────────────────────────────────────────────
  {
    id: 'competitor.new_insight',
    name: 'Competitor Intelligence',
    eventTypes: ['competitor.new_insight', 'competitor.price_threat'],
    confidence: 70,
    async execute(event, businessId) {
      const supabase = await createServiceClient()
      const competitor = safeStr(event.event_data_json.competitor_name, 'A competitor')
      const insight    = safeStr(event.event_data_json.insight, 'has a new update')
      return [await createSignal(supabase, businessId, {
        type: 'insight',
        title: `${competitor} — new intelligence available`,
        body: `${competitor} ${insight}. Stay ahead by reviewing the competitive analysis and adjusting your positioning.`,
        action_label: 'View competitors',
        action_type: 'open_url',
        action_data_json: { url: '/competitors' },
      })]
    },
  },

  // ── Content: drafts pending ──────────────────────────────────────────────────
  {
    id: 'content.drafts_ready',
    name: 'Content Drafts Ready',
    eventTypes: ['content.drafts_ready'],
    confidence: 85,
    async execute(event, businessId) {
      const supabase = await createServiceClient()
      const count = safeNum(event.event_data_json.count, 1)
      return [await createSignal(supabase, businessId, {
        type: 'insight',
        title: `${count} content draft${count > 1 ? 's' : ''} ready to publish`,
        body: `Your AI agent has prepared ${count} post${count > 1 ? 's' : ''} for you. Review and publish to maintain your content schedule and audience engagement.`,
        action_label: 'Review drafts',
        action_type: 'approve_post',
      })]
    },
  },

  // ── Health score: declined ────────────────────────────────────────────────
  {
    id: 'health.score_decline',
    name: 'Health Score Declined',
    eventTypes: ['health.score_decline'],
    confidence: 80,
    async execute(event, businessId) {
      const supabase = await createServiceClient()
      const old = safeNum(event.event_data_json.old_score)
      const curr = safeNum(event.event_data_json.new_score)
      const drop = old - curr
      return [await createSignal(supabase, businessId, {
        type: 'warning',
        title: `Business health score dropped ${drop} points (${old} → ${curr})`,
        body: `Your overall health score declined, which may affect AI recommendations and lead conversion. Check your audit, reviews, and activity levels.`,
        action_label: 'View dashboard',
        action_type: 'open_url',
        action_data_json: { url: '/dashboard' },
      })]
    },
  },
]

// ── Core orchestration runner ─────────────────────────────────────────────────

export async function runOrchestration(workspaceId: string) {
  const supabase = await createServiceClient()

  // Get business for this workspace
  const { data: business } = await supabase
    .from('businesses').select('id').eq('workspace_id', workspaceId).maybeSingle()
  if (!business) return { processed: 0, signals: 0 }

  // Fetch unprocessed events (last 48h, max 50)
  const since = new Date(Date.now() - 48 * 3600000).toISOString()
  const { data: events } = await supabase
    .from('business_events')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('processed', false)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(50)

  if (!events || events.length === 0) return { processed: 0, signals: 0 }

  // Read memory context for rules to use
  const { data: memRow } = await supabase
    .from('agent_memory')
    .select('value_text')
    .eq('business_id', business.id)
    .eq('key', 'business_context')
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ctx: Record<string, any> = {}
  try { if (memRow?.value_text) ctx = JSON.parse(memRow.value_text) } catch { /* skip */ }

  let totalSignals = 0
  let totalProcessed = 0

  for (const event of events as BusinessEvent[]) {
    // Find matching built-in rules
    const matchingRules = BUILTIN_RULES.filter(r => r.eventTypes.includes(event.event_type))

    // Find matching user-defined rules
    const { data: userRules } = await supabase
      .from('orchestration_rules')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('enabled', true)
      .eq('trigger_type', event.event_type)

    const allRuleIds = [
      ...matchingRules.map(r => ({ id: r.id, name: r.name, isBuiltin: true })),
      ...(userRules ?? []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name, isBuiltin: false })),
    ]

    if (allRuleIds.length === 0) {
      // No rule matched — just mark as processed
      await supabase.from('business_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', event.id)
      totalProcessed++
      continue
    }

    const chainId = `${event.event_type}:${event.id}`

    // Execute built-in rules
    for (const rule of matchingRules) {
      const actions = await rule.execute(event, business.id, workspaceId, ctx)
      const signalsCreated = actions.filter(a => a.type === 'create_signal' && a.status === 'ok').length
      totalSignals += signalsCreated

      await supabase.from('orchestration_runs').insert({
        workspace_id: workspaceId,
        rule_id: rule.id,
        rule_name: rule.name,
        triggered_by: event.entity_type && event.entity_id
          ? `${event.entity_type}:${event.entity_id}`
          : event.event_type,
        event_type: event.event_type,
        event_data_json: event.event_data_json,
        actions_executed_json: actions,
        chain_id: chainId,
        status: actions.every(a => a.status !== 'error') ? 'completed' : 'partial',
        signals_created: signalsCreated,
      })
    }

    // Mark event as processed
    await supabase.from('business_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', event.id)

    totalProcessed++
  }

  return { processed: totalProcessed, signals: totalSignals }
}

// ── Event emitter ─────────────────────────────────────────────────────────────

export async function emitEvent(
  workspaceId: string,
  eventType: string,
  entityType: string | null,
  entityId: string | null,
  data: Record<string, unknown> = {}
) {
  const supabase = await createServiceClient()
  const { error } = await supabase.from('business_events').insert({
    workspace_id: workspaceId,
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    event_data_json: data,
    processed: false,
  })
  return !error
}
