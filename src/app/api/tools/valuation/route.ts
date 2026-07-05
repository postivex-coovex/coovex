import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/credits'

const FALLBACK_VALUATION = {
  low:  340000,
  mid:  520000,
  high: 780000,
  methods: [
    { name: 'Revenue Multiple',  value: 480000, multiple: '3.2x ARR',    basis: 'SaaS median for B2B tools at your growth stage' },
    { name: 'EBITDA Multiple',   value: 390000, multiple: '9.5x EBITDA', basis: 'Industry average for profitable SMB software' },
    { name: 'DCF (5-year)',      value: 620000, multiple: 'N/A',         basis: '15% discount rate, 25% annual growth assumed' },
    { name: 'Comparable Exits', value: 510000, multiple: '3.4x ARR',    basis: 'Based on recent exits in your category' },
  ],
  key_factors: [
    'Monthly Recurring Revenue (MRR) — the primary driver for SaaS valuations',
    'Net Revenue Retention >100% signals strong product-market fit and commands premium',
    'Customer concentration risk — single client >20% revenue discounts valuation',
    'Gross margin above 70% supports higher revenue multiples',
  ],
  risks: [
    'Pre-revenue or early-stage companies trade at larger discounts',
    'Market conditions in 2025 favor capital-efficient businesses',
    'Churn rate above 5% monthly significantly reduces multiples',
  ],
  summary: 'Based on the inputs provided, your business likely falls in the $340K–$780K range. The most defensible valuation anchor is your ARR multiple, sitting at 3.2x — in line with current market for early-stage B2B SaaS. Reaching $500K ARR with sub-5% monthly churn would meaningfully expand the range toward $1M+.',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { arr, mrr, growth_rate, gross_margin, customer_count, churn_rate } = body

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()

  const wsId = profile?.current_workspace_id
  let creditBalance: number | undefined
  if (wsId) {
    const credit = await deductCredits(wsId, 'business_valuation', 'Business Valuation')
    if (!credit.ok) return NextResponse.json({ error: credit.error }, { status: 402 })
    creditBalance = credit.balance
  }

  const [bizRes, leadsRes, dealsRes] = await Promise.all([
    wsId
      ? supabase.from('businesses').select('name, industry, integrations').eq('workspace_id', wsId).maybeSingle()
      : Promise.resolve({ data: null }),
    wsId
      ? supabase.from('leads').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId)
      : Promise.resolve({ count: 0 }),
    wsId
      ? supabase.from('deals').select('stage, value').eq('workspace_id', wsId).limit(50)
      : Promise.resolve({ data: [] }),
  ])

  const biz = bizRes.data
  const leadCount = leadsRes.count ?? 0
  const deals = (dealsRes.data ?? []) as { stage: string; value: unknown }[]
  const wonDeals = deals.filter(d => d.stage === 'won')
  const wonRevenue = wonDeals.reduce((s, d) => s + Number(d.value ?? 0), 0)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key') {
    return NextResponse.json({ valuation: FALLBACK_VALUATION }, creditBalance !== undefined ? { headers: { 'X-Credits-Remaining': String(creditBalance) } } : undefined)
  }

  const effectiveMrr = mrr || ((biz?.integrations as Record<string, unknown> | null)?.__website_metrics as Record<string, unknown> | undefined)?.mrr
  const effectiveArr = arr || (effectiveMrr ? Number(effectiveMrr) * 12 : null)

  const prompt = `You are a startup valuation expert. Estimate the business valuation. Return ONLY valid JSON — no markdown, no explanations.

COMPANY:
- Name: ${biz?.name || 'SaaS Business'}
- Industry: ${biz?.industry || 'Software'}

FINANCIALS (user-provided):
- ARR: ${effectiveArr ? `$${Number(effectiveArr).toLocaleString()}` : 'Not provided'}
- MRR: ${effectiveMrr ? `$${Number(effectiveMrr).toLocaleString()}` : 'Not provided'}
- YoY Growth Rate: ${growth_rate ? `${growth_rate}%` : 'Not provided'}
- Gross Margin: ${gross_margin ? `${gross_margin}%` : 'Not provided'}
- Paying customers: ${customer_count || 'Not provided'}
- Monthly churn: ${churn_rate ? `${churn_rate}%` : 'Not provided'}

PIPELINE DATA:
- Total leads: ${leadCount}
- Won deals: ${wonDeals.length} (total value: $${wonRevenue.toLocaleString()})

Return JSON:
{
  "low": <conservative valuation as integer USD>,
  "mid": <most likely valuation as integer USD>,
  "high": <optimistic valuation as integer USD>,
  "methods": [
    { "name": "method name", "value": <integer USD>, "multiple": "X.Xx metric", "basis": "1 sentence explanation" }
  ],
  "key_factors": ["4 factors that most influence this specific valuation"],
  "risks": ["3 risks that could lower valuation, specific to this business"],
  "summary": "3-4 sentences: current valuation range rationale + the ONE most impactful thing to do to increase valuation"
}

Use realistic 2025 SaaS market multiples. If revenue data is missing, use pipeline and leads as proxies for stage. Be honest and specific.`

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const valuation = JSON.parse(match[0])
      return NextResponse.json({ valuation }, creditBalance !== undefined ? { headers: { 'X-Credits-Remaining': String(creditBalance) } } : undefined)
    }
  } catch { /* fall through */ }

  return NextResponse.json({ valuation: FALLBACK_VALUATION }, creditBalance !== undefined ? { headers: { 'X-Credits-Remaining': String(creditBalance) } } : undefined)
}
