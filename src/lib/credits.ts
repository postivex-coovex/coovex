import { createServiceClient } from './supabase/service'

// ── Plan definitions ─────────────────────────────────────────────────────────

export const PLANS = {
  trial: {
    name: 'Free Trial',
    price: 0,
    creditsPerMonth: 100,
    maxLeads: 20,
    maxCompetitors: 1,
    maxTeamMembers: 1,
    maxWorkspaces: 1,
    features: ['20 leads', '1 competitor', '100 AI credits/month', 'Basic audit', '14-day trial'],
  },
  starter: {
    name: 'Starter',
    price: 29,
    creditsPerMonth: 500,
    maxLeads: 100,
    maxCompetitors: 3,
    maxTeamMembers: 1,
    maxWorkspaces: 1,
    features: [
      '100 leads',
      '3 competitors monitored',
      '500 AI credits/month',
      'AI Coach & Daily Brief',
      'Website audit & GEO',
      'Basic analytics',
      '1 team member',
      'Email support',
    ],
  },
  growth: {
    name: 'Growth',
    price: 79,
    creditsPerMonth: 2000,
    maxLeads: 500,
    maxCompetitors: 10,
    maxTeamMembers: 5,
    maxWorkspaces: 3,
    features: [
      '500 leads',
      '10 competitors monitored',
      '2,000 AI credits/month',
      'All AI features',
      'Cold lead finder',
      'Drip campaigns',
      'Revenue & forecast tracking',
      '5 team members',
      'Priority support',
    ],
    highlight: true,
  },
  scale: {
    name: 'Scale',
    price: 149,
    creditsPerMonth: 6000,
    maxLeads: 2000,
    maxCompetitors: 25,
    maxTeamMembers: 10,
    maxWorkspaces: 10,
    features: [
      '2,000 leads',
      '25 competitors monitored',
      '6,000 AI credits/month',
      'All features + white-label',
      'CRM integrations',
      'Proposals & AI reports',
      'NPS & review management',
      '10 team members',
      'Dedicated support',
    ],
  },
  agency: {
    name: 'Agency',
    price: 299,
    creditsPerMonth: 20000,
    maxLeads: -1,       // unlimited
    maxCompetitors: -1,
    maxTeamMembers: -1,
    maxWorkspaces: -1,
    features: [
      'Unlimited leads',
      'Unlimited competitors',
      '20,000 AI credits/month',
      'Full white-label & custom domain',
      'Multi-client agency dashboard',
      'All integrations',
      'Unlimited team members',
      'SLA + dedicated account manager',
    ],
  },
} as const

export type PlanKey = keyof typeof PLANS

// ── Feature credit costs ──────────────────────────────────────────────────────
//
// Real API costs (approx):
//   Claude Haiku:  ~$0.0008/1K in + $0.004/1K out
//   Claude Sonnet: ~$0.003/1K in  + $0.015/1K out
//
// Pricing philosophy:
//   - Chat messages are cheap to generate — charge 2 credits ($0.02) so users
//     get 250+ messages/month on Starter. Real cost ~$0.004 → fair margin.
//   - When chat invokes a TOOL (create post, add lead) charge 3 extra credits
//     for the actual action, not the conversation.
//   - Heavy one-shot AI jobs (audit, business plan) charge more because they
//     use Sonnet with large prompts — the cost is genuinely higher.
//
// Rule: never charge more than ~5–8x real API cost for conversational features.
// For one-shot tools 10–15x is acceptable (matches SaaS industry norms).

export const CREDIT_COSTS = {
  // ── Conversation (very cheap — charge fairly) ────
  chat_message:          2,   // real ~$0.004, charged $0.02 → ~5x margin
  chat_tool_action:      3,   // extra when chat creates post / adds lead / etc.
  daily_brief:           5,   // generated once/day, real ~$0.008
  smart_alert:           1,
  review_response:       3,   // short draft, real ~$0.003

  // ── Research / data jobs ─────────────────────────
  lead_research:         5,   // real ~$0.015 (web fetch + summarise)
  lead_score:            2,   // per lead, often batched
  cold_lead_search:      10,  // Reddit/HN fetch + AI scoring
  keyword_lead_scrape:   10,  // VPS Serper API call + dedup + store
  trends_analyze:        5,
  nps_analyze:           5,
  goals_suggest:         5,
  attribution_analyze:   8,

  // ── Content generation ───────────────────────────
  content_generate:      8,
  campaign_create:       10,
  drip_email:            5,   // per email in drip sequence

  // ── Competitor intelligence ──────────────────────
  competitor_snapshot:   8,
  competitor_analysis:   15,  // full scan — real ~$0.05

  // ── Heavy one-shot jobs ──────────────────────────
  website_audit:         20,  // full audit + GEO — real ~$0.05
  report_generate:       15,
  proposal_generate:     20,
  agent_report:          25,
  content_performance:   8,
  forecast_generate:     10,

  // ── Long-form AI tools ───────────────────────────
  swot_analysis:         15,  // real ~$0.05, charged $0.15
  icp_builder:           15,
  journey_map:           20,
  business_valuation:    10,
  marketing_plan:        30,  // real ~$0.12, charged $0.30
  pitch_deck:            40,
  business_plan:         50,  // real ~$0.08, charged $0.50
} as const

export type FeatureKey = keyof typeof CREDIT_COSTS

// ── Credit top-up packs ───────────────────────────────────────────────────────

export const CREDIT_PACKS = [
  { credits: 500,    price: 5,   label: '500 credits',    pricePerCredit: 0.010 },
  { credits: 1200,   price: 10,  label: '1,200 credits',  pricePerCredit: 0.0083 },
  { credits: 3000,   price: 25,  label: '3,000 credits',  pricePerCredit: 0.0083 },
  { credits: 7000,   price: 50,  label: '7,000 credits',  pricePerCredit: 0.0071 },
  { credits: 15000,  price: 100, label: '15,000 credits', pricePerCredit: 0.0067 },
] as const

// ── Server-side utilities ─────────────────────────────────────────────────────

export interface CreditResult {
  ok: boolean
  balance: number
  error?: string
}

/** Check balance without deducting.
 *  Tries profile-level balance first (post-migration); falls back to workspace if column missing. */
export async function checkCredits(workspaceId: string, cost: number): Promise<CreditResult> {
  const service = createServiceClient()

  // Try profile-level balance (requires 20260704_profile_credits migration)
  const { data: ws } = await service
    .from('workspaces')
    .select('owner_id, ai_credits_balance')
    .eq('id', workspaceId)
    .single()

  if (!ws) return { ok: false, balance: 0, error: 'Workspace not found' }

  let balance = 0
  if (ws.owner_id) {
    const { data: prof, error: profErr } = await service
      .from('profiles')
      .select('ai_credits_balance')
      .eq('id', ws.owner_id)
      .single()

    if (!profErr && prof?.ai_credits_balance != null) {
      // Migration applied — use profile balance
      balance = prof.ai_credits_balance
    } else {
      // Migration not yet applied — fall back to workspace balance
      balance = ws.ai_credits_balance ?? 0
    }
  } else {
    balance = ws.ai_credits_balance ?? 0
  }

  if (balance < cost) {
    return { ok: false, balance, error: `Insufficient credits. Need ${cost}, have ${balance}.` }
  }
  return { ok: true, balance }
}

/** Atomically deduct credits using the DB function.
 *  Falls back to workspace-level deduction if profile migration not yet applied. */
export async function deductCredits(
  workspaceId: string,
  feature: FeatureKey,
  description?: string,
): Promise<CreditResult> {
  const cost = CREDIT_COSTS[feature]
  const service = createServiceClient()

  // Try profile-level RPC first
  const { data, error } = await service.rpc('deduct_ai_credits', {
    p_workspace_id: workspaceId,
    p_amount:       cost,
    p_feature:      feature,
    p_description:  description ?? feature,
  })

  if (!error) {
    if (data === -1) return { ok: false, balance: 0, error: 'Insufficient AI credits. Top up in Settings → Billing.' }
    return { ok: true, balance: data as number }
  }

  // RPC failed (migration not applied) — fall back to direct workspace deduction
  const { data: ws } = await service
    .from('workspaces')
    .select('ai_credits_balance')
    .eq('id', workspaceId)
    .single()

  const balance = ws?.ai_credits_balance ?? 0
  if (balance < cost) return { ok: false, balance, error: 'Insufficient AI credits. Top up in Settings → Billing.' }

  const newBalance = balance - cost
  await service.from('workspaces').update({ ai_credits_balance: newBalance }).eq('id', workspaceId)
  await service.from('credit_transactions').insert({
    workspace_id: workspaceId,
    amount: -cost,
    type: 'usage',
    feature,
    description: description ?? feature,
    balance_after: newBalance,
  })
  return { ok: true, balance: newBalance }
}

/** Get current balance — profile-level if migration applied, else workspace-level. */
export async function getCredits(workspaceId: string): Promise<number> {
  const service = createServiceClient()
  const { data: ws } = await service
    .from('workspaces')
    .select('owner_id, ai_credits_balance')
    .eq('id', workspaceId)
    .single()
  if (!ws) return 0
  if (ws.owner_id) {
    const { data: prof, error } = await service
      .from('profiles')
      .select('ai_credits_balance')
      .eq('id', ws.owner_id)
      .single()
    if (!error && prof?.ai_credits_balance != null) return prof.ai_credits_balance
  }
  return ws.ai_credits_balance ?? 0
}

/** Add credits (purchase or monthly refresh) */
export async function addCredits(
  workspaceId: string,
  amount: number,
  type: 'purchase' | 'monthly_refresh' | 'bonus' | 'refund',
  description?: string,
): Promise<CreditResult> {
  const service = createServiceClient()
  const { data, error } = await service.rpc('add_ai_credits', {
    p_workspace_id: workspaceId,
    p_amount:       amount,
    p_type:         type,
    p_description:  description ?? type,
  })
  if (error) return { ok: false, balance: 0, error: error.message }
  return { ok: true, balance: data as number }
}

/** Returns response headers that include the remaining balance.
 *  Include in any NextResponse that deducts credits so the client updates instantly. */
export function creditResponseHeaders(balance: number): Record<string, string> {
  return { 'X-Credits-Remaining': String(balance) }
}

/** Get workspace_id for authenticated user (server-side) */
export async function getWorkspaceId(userId: string): Promise<string | null> {
  const service = createServiceClient()
  const { data } = await service
    .from('profiles')
    .select('current_workspace_id')
    .eq('id', userId)
    .single()
  return data?.current_workspace_id ?? null
}
