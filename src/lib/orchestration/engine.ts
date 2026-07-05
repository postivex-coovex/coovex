/**
 * Orchestration Engine — cross-module rule processor.
 *
 * Each built-in rule:
 *   1. Scans existing data for trigger conditions.
 *   2. Deduplicates (skips if ran for the same entity in last N hours).
 *   3. Executes an action chain (signal creation, lead updates, etc.).
 *   4. Logs an orchestration_run for audit trail.
 */

import { createServiceClient } from '@/lib/supabase/service'

// ─── types ──────────────────────────────────────────────────────────────────

export interface OrchestrationContext {
  workspaceId: string
  businessId:  string
  /** Keyed by rule id — undefined means use default (enabled: true) */
  rulesConfig: Record<string, { enabled: boolean } | undefined>
}

export interface RuleResult {
  rule:         string
  chain_id:     string
  signals:      number
  triggered_by: string
}

type SignalType     = 'urgent' | 'warning' | 'opportunity' | 'done' | 'insight'
type SignalAction   = 'approve_post' | 'respond_review' | 'view_lead' | 'view_report' | 'open_chat' | 'open_url' | 'none'

interface SignalSpec {
  business_id:      string
  type:             SignalType
  title:            string
  body:             string
  action_label?:    string
  action_type:      SignalAction
  action_data_json: Record<string, unknown>
  dismissed:        boolean
}

// ─── helpers ─────────────────────────────────────────────────────────────────

type Service = ReturnType<typeof createServiceClient>

/** Returns true if this rule already ran for `triggeredBy` within `hours` hours. */
async function alreadyRan(
  svc: Service,
  workspaceId: string,
  ruleId: string,
  triggeredBy: string,
  hours = 24,
): Promise<boolean> {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString()
  const { data } = await svc
    .from('orchestration_runs')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('rule_id', ruleId)
    .eq('triggered_by', triggeredBy)
    .gte('created_at', since)
    .limit(1)
  return (data ?? []).length > 0
}

/** Inserts agent signals with chain metadata attached to action_data_json. */
async function insertSignals(svc: Service, specs: SignalSpec[], chainId: string): Promise<void> {
  const rows = specs.map(s => ({
    ...s,
    action_data_json: {
      ...s.action_data_json,
      chain_id:     chainId,
      chain_length: specs.length,
      chain_source: 'orchestration',
    },
  }))
  await svc.from('agent_signals').insert(rows)
}

/** Logs an orchestration_run for audit trail + Activity History. */
async function logRun(
  svc: Service,
  workspaceId: string,
  ruleId: string,
  ruleName: string,
  triggeredBy: string,
  eventType: string,
  actionsExecuted: string[],
  chainId: string,
  signalCount: number,
): Promise<void> {
  await svc.from('orchestration_runs').insert({
    workspace_id:          workspaceId,
    rule_id:               ruleId,
    rule_name:             ruleName,
    triggered_by:          triggeredBy,
    event_type:            eventType,
    actions_executed_json: actionsExecuted,
    chain_id:              chainId,
    status:                'completed',
    signals_created:       signalCount,
    created_at:            new Date().toISOString(),
  })
}

function isEnabled(ctx: OrchestrationContext, ruleId: string): boolean {
  const cfg = ctx.rulesConfig[ruleId]
  return cfg === undefined ? true : cfg.enabled
}

// ─── Rule 1: Competitor Price Threat → Counter-pitch + Content suggestion ────

async function ruleCompetitorPriceThreat(ctx: OrchestrationContext): Promise<RuleResult[]> {
  if (!isEnabled(ctx, 'competitor_price_threat')) return []

  const svc   = createServiceClient()
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString()

  // Find threat-type insights about pricing created in last 24h
  const { data: rawInsights } = await svc
    .from('competitor_insights')
    .select('id, description, competitor_id')
    .eq('type', 'threat')
    .gte('created_at', since)

  if (!rawInsights?.length) return []

  // Filter to insights belonging to this business's competitors
  const { data: bizCompetitors } = await svc
    .from('competitors')
    .select('id, name, pricing_tier')
    .eq('business_id', ctx.businessId)

  const compMap = new Map((bizCompetitors ?? []).map(c => [c.id, c]))

  const pricingThreats = rawInsights.filter(i => {
    if (!compMap.has(i.competitor_id)) return false
    return /pric|cost|cheaper|discount|deal|afford|rate|fee/i.test(i.description ?? '')
  })

  const results: RuleResult[] = []

  for (const threat of pricingThreats) {
    const triggeredBy = `competitor_insight:${threat.id}`
    if (await alreadyRan(svc, ctx.workspaceId, 'competitor_price_threat', triggeredBy)) continue

    const comp    = compMap.get(threat.competitor_id)!
    const chainId = crypto.randomUUID()

    const signals: SignalSpec[] = [
      {
        business_id:  ctx.businessId,
        type:         'opportunity',
        title:        `${comp.name} made a pricing move — draft your counter-pitch`,
        body:         `Intelligence: "${threat.description}". Open AI Coach to generate talking points that justify your pricing and convert fence-sitting prospects.`,
        action_label: 'Open AI Coach',
        action_type:  'open_chat',
        action_data_json: {
          prefill: `${comp.name} just made a pricing move: "${threat.description}". Write me:\n1. A 3-line counter-pitch for prospects comparing us on price\n2. Three value talking points that justify our pricing\n3. A follow-up email subject line that re-engages cold leads`,
        },
        dismissed: false,
      },
      {
        business_id:  ctx.businessId,
        type:         'opportunity',
        title:        `Post a competitive positioning piece this week`,
        body:         `Strike while the iron's hot. A LinkedIn post on "why we're not the cheapest — and why customers prefer it" converts fence-sitters into buyers.`,
        action_label: 'Go to Content Calendar',
        action_type:  'approve_post',
        action_data_json: {
          suggested_topic:    `Why we're not the cheapest — and why our customers prefer it that way`,
          suggested_platform: 'linkedin',
          context_insight_id: threat.id,
        },
        dismissed: false,
      },
    ]

    await insertSignals(svc, signals, chainId)
    await logRun(svc, ctx.workspaceId, 'competitor_price_threat', 'Competitor Price Threat',
      triggeredBy, 'competitor.price_threat',
      ['open_chat:counter_pitch', 'approve_post:competitive_positioning'],
      chainId, signals.length,
    )

    results.push({ rule: 'competitor_price_threat', chain_id: chainId, signals: signals.length, triggered_by: triggeredBy })
  }

  return results
}

// ─── Rule 2: Lead Score Sharp Drop → Auto Re-segment ────────────────────────

async function ruleLeadScoreDrop(ctx: OrchestrationContext): Promise<RuleResult[]> {
  if (!isEnabled(ctx, 'lead_score_drop')) return []

  const svc   = createServiceClient()
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString()

  // Leads that scored below the warm threshold and were updated recently
  // (proxy for "score dropped" — ideal would be a score_history table)
  const { data: leads } = await svc
    .from('leads')
    .select('id, name, company, score, stage')
    .eq('business_id', ctx.businessId)
    .lt('score', 40)
    .not('stage', 'in', '("nurture","closed_lost","closed_won")')
    .gte('updated_at', since)

  const results: RuleResult[] = []

  for (const lead of (leads ?? [])) {
    const triggeredBy = `lead:${lead.id}`
    if (await alreadyRan(svc, ctx.workspaceId, 'lead_score_drop', triggeredBy)) continue

    const chainId    = crypto.randomUUID()
    const displayName = lead.name || lead.company || 'Unnamed lead'

    // Action 1: Move lead to nurture stage, clear priority
    await svc
      .from('leads')
      .update({ stage: 'nurture', priority: false, updated_at: new Date().toISOString() })
      .eq('id', lead.id)

    // Action 2: Enroll in cold drip — find or create default nurture campaign
    const { data: nurtureCampaign } = await svc
      .from('email_campaigns')
      .select('id')
      .eq('business_id', ctx.businessId)
      .ilike('name', '%nurture%')
      .limit(1)
      .maybeSingle()

    if (nurtureCampaign) {
      await svc.from('campaign_leads').insert({
        campaign_id: nurtureCampaign.id,
        lead_id:     lead.id,
        enrolled_at: new Date().toISOString(),
        enrolled_by: 'orchestration',
        status:      'active',
      }).maybeSingle()
    }

    const signals: SignalSpec[] = [
      {
        business_id:  ctx.businessId,
        type:         'warning',
        title:        `${displayName} auto-moved to nurture (score ${lead.score})`,
        body:         `Lead dropped below 40. Stage changed from "${lead.stage}" → nurture, priority flag cleared${nurtureCampaign ? ', and enrolled in your nurture drip sequence' : ''}. AI will re-score if they engage again.`,
        action_label: 'View Lead',
        action_type:  'view_lead',
        action_data_json: {
          lead_id:          lead.id,
          lead_name:        displayName,
          prev_stage:       lead.stage,
          auto_action:      'moved_to_nurture',
          drip_enrolled:    !!nurtureCampaign,
        },
        dismissed: false,
      },
    ]

    await insertSignals(svc, signals, chainId)
    await logRun(svc, ctx.workspaceId, 'lead_score_drop', 'Lead Score Sharp Drop',
      triggeredBy, 'lead.score_drop',
      ['update_lead:stage=nurture', 'update_lead:priority=false', nurtureCampaign ? 'enroll_drip' : 'no_drip'],
      chainId, signals.length,
    )

    results.push({ rule: 'lead_score_drop', chain_id: chainId, signals: signals.length, triggered_by: triggeredBy })
  }

  return results
}

// ─── Rule 3: Goal At-Risk → Best-Channel Suggestion + Content Slot ───────────

async function ruleGoalAtRisk(ctx: OrchestrationContext): Promise<RuleResult[]> {
  if (!isEnabled(ctx, 'goal_at_risk')) return []

  const svc   = createServiceClient()
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString()

  const { data: goals } = await svc
    .from('goals')
    .select('id, title, category, target_value, current_value, unit, deadline')
    .eq('business_id', ctx.businessId)
    .eq('status', 'at_risk')
    .gte('updated_at', since)

  if (!goals?.length) return []

  // Pull top-converting channel from analytics (best click-through lead source)
  const { data: topLeadSources } = await svc
    .from('leads')
    .select('source')
    .eq('business_id', ctx.businessId)
    .not('source', 'is', null)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 3_600_000).toISOString())

  const sourceCounts: Record<string, number> = {}
  for (const l of (topLeadSources ?? [])) {
    if (l.source) sourceCounts[l.source] = (sourceCounts[l.source] ?? 0) + 1
  }
  const bestChannel = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .at(0)?.[0] ?? 'LinkedIn'

  const results: RuleResult[] = []

  for (const goal of goals) {
    const triggeredBy = `goal:${goal.id}`
    if (await alreadyRan(svc, ctx.workspaceId, 'goal_at_risk', triggeredBy)) continue

    const chainId = crypto.randomUUID()
    const pct = goal.target_value > 0
      ? Math.round((Number(goal.current_value) / Number(goal.target_value)) * 100)
      : 0
    const remaining = Math.max(0, Number(goal.target_value) - Number(goal.current_value))

    const signals: SignalSpec[] = [
      {
        business_id:  ctx.businessId,
        type:         'urgent',
        title:        `Goal at risk: "${goal.title}" — ${pct}% of target`,
        body:         `You're ${remaining} ${goal.unit ?? 'units'} short. ${goal.deadline ? `Deadline: ${new Date(goal.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.` : ''} Check attribution to identify where to double down.`,
        action_label: 'View Attribution',
        action_type:  'view_report',
        action_data_json: {
          goal_id:      goal.id,
          pct_complete: pct,
          remaining,
        },
        dismissed: false,
      },
      {
        business_id:  ctx.businessId,
        type:         'opportunity',
        title:        `Shift content focus to ${bestChannel} — your top lead source`,
        body:         `${bestChannel} is generating the most leads in the last 30 days. Add 2 extra posts targeting this channel this week to accelerate your "${goal.title}" goal.`,
        action_label: 'Go to Content Calendar',
        action_type:  'approve_post',
        action_data_json: {
          goal_id:             goal.id,
          best_channel:        bestChannel,
          suggested_action:    'add_extra_posts',
          suggested_platform:  bestChannel.toLowerCase(),
        },
        dismissed: false,
      },
    ]

    await insertSignals(svc, signals, chainId)
    await logRun(svc, ctx.workspaceId, 'goal_at_risk', 'Goal At Risk → Channel Reallocation',
      triggeredBy, 'goal.at_risk',
      ['create_signal:attribution_check', `create_signal:content_shift_to_${bestChannel}`],
      chainId, signals.length,
    )

    results.push({ rule: 'goal_at_risk', chain_id: chainId, signals: signals.length, triggered_by: triggeredBy })
  }

  return results
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export async function runOrchestration(ctx: OrchestrationContext): Promise<{
  total_chains: number
  total_signals: number
  results: RuleResult[]
  errors: { rule: string; message: string }[]
}> {
  const [r1, r2, r3] = await Promise.allSettled([
    ruleCompetitorPriceThreat(ctx),
    ruleLeadScoreDrop(ctx),
    ruleGoalAtRisk(ctx),
  ])

  const results: RuleResult[] = [
    ...(r1.status === 'fulfilled' ? r1.value : []),
    ...(r2.status === 'fulfilled' ? r2.value : []),
    ...(r3.status === 'fulfilled' ? r3.value : []),
  ]

  const errors = [
    r1.status === 'rejected' ? { rule: 'competitor_price_threat', message: String(r1.reason) } : null,
    r2.status === 'rejected' ? { rule: 'lead_score_drop',          message: String(r2.reason) } : null,
    r3.status === 'rejected' ? { rule: 'goal_at_risk',             message: String(r3.reason) } : null,
  ].filter((e): e is { rule: string; message: string } => e !== null)

  return {
    total_chains:  results.length,
    total_signals: results.reduce((s, r) => s + r.signals, 0),
    results,
    errors,
  }
}
