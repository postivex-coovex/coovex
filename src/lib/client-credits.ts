'use client'

// ── Credit costs (mirror of server CREDIT_COSTS — keep in sync) ──────────────
export const AI_COSTS = {
  chat_message:        2,
  daily_brief:         5,
  review_response:     3,
  lead_research:       5,
  lead_score:          2,
  cold_lead_search:    10,
  keyword_lead_scrape: 10,
  trends_analyze:      5,
  goals_suggest:       5,
  content_generate:    8,
  campaign_create:     10,
  drip_email:          5,
  competitor_snapshot: 8,
  competitor_analysis: 15,
  website_audit:       20,
  report_generate:     15,
  proposal_generate:   20,
  geo_intelligence:    5,
  swot_analysis:       15,
  marketing_plan:      30,
  pitch_deck:          40,
  business_plan:       50,
} as const

export type AIFeature = keyof typeof AI_COSTS

/** Check if user has enough credits for an action.
 *  Returns { ok: true } or { ok: false, balance, needed } */
export async function checkCredits(
  feature: AIFeature
): Promise<{ ok: true; balance: number } | { ok: false; balance: number; needed: number; error: string }> {
  const needed = AI_COSTS[feature]
  try {
    const r = await fetch('/api/credits/balance', { cache: 'no-store' })
    if (!r.ok) return { ok: false, balance: 0, needed, error: 'Could not fetch balance' }
    const d = await r.json() as { balance: number }
    if (d.balance < needed) {
      return {
        ok: false,
        balance: d.balance,
        needed,
        error: `Not enough credits. Need ${needed}, you have ${d.balance}. Top up in Settings → Billing.`,
      }
    }
    return { ok: true, balance: d.balance }
  } catch {
    return { ok: false, balance: 0, needed, error: 'Could not check credit balance.' }
  }
}

/** Dispatch credit-changed event with new balance (for instant header update).
 *  Call this if you already know the new balance from an API response.
 *  If balance is unknown, omit it — the header interceptor handles it automatically. */
export function notifyCreditsSpent(balance?: number) {
  window.dispatchEvent(
    new CustomEvent('coovex:credits-changed', balance !== undefined ? { detail: { balance } } : undefined)
  )
}

/** Format: "5 credits" or "20 credits" */
export function formatCost(feature: AIFeature): string {
  return `${AI_COSTS[feature]} credits`
}
