import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/credits'

// ─── types ───────────────────────────────────────────────────────────────────
interface ComparisonMetric {
  label: string
  prev: number
  curr: number
  unit: string
  isRevenue?: boolean
  isFloat?: boolean
  noCompare?: boolean
  change: number | null
  trend: 'up' | 'down' | 'flat'
}

interface ReportData {
  title: string
  business_name: string
  generated_at: string
  period: { this_month: string; last_month: string }
  metrics: ComparisonMetric[]
  ai: {
    executive_summary: string
    winning: string
    needs_attention: string
    next_actions: string
  }
  data: {
    top_deals: { title: string; value: number; stage: string }[]
    recent_posts: { title: string; status: string; created_at: string }[]
    competitors: { name: string; status: string; notes: string }[]
    goals: unknown[]
    website_metrics: unknown
    open_deals_count: number
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0
  return Math.round(((curr - prev) / prev) * 100)
}

function trend(curr: number, prev: number): 'up' | 'down' | 'flat' {
  if (curr > prev) return 'up'
  if (curr < prev) return 'down'
  return 'flat'
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function buildReportTitle(type: string, thisMonthName: string, lastMonthName: string): string {
  const titles: Record<string, string> = {
    'compare-improvement': `Performance Comparison: ${lastMonthName} vs ${thisMonthName}`,
    'monthly-review':      `Monthly Business Review — ${thisMonthName}`,
    'pipeline-summary':    `Pipeline Summary — ${thisMonthName}`,
    'content-performance': `Content Performance Report — ${thisMonthName}`,
    'nps-report':          `NPS & Review Report — ${thisMonthName}`,
    'competitor-intel':    `Competitor Intelligence Report — ${thisMonthName}`,
    'client-report':       `Client Business Report — ${thisMonthName}`,
  }
  return titles[type] ?? `Business Report — ${thisMonthName}`
}

// ─── Claude prompt per report type ───────────────────────────────────────────
function buildPrompt(
  type: string,
  bizName: string,
  industry: string,
  thisMonthName: string,
  lastMonthName: string,
  metrics: ComparisonMetric[],
  data: ReportData['data'],
): string {
  const metricsText = metrics.map(m => {
    const prevLabel = m.noCompare ? '' : ` (prev: ${m.isFloat ? m.prev.toFixed(1) : m.prev}${m.unit})`
    const changeLabel = m.change !== null ? `, ${m.change >= 0 ? '+' : ''}${m.change}%` : ''
    return `• ${m.label}: ${m.isFloat ? m.curr.toFixed(1) : m.curr}${m.unit}${prevLabel}${changeLabel}`
  }).join('\n')

  const dealsText = data.top_deals.length > 0
    ? data.top_deals.map(d => `  • ${d.title} — $${Number(d.value).toLocaleString()} (${d.stage})`).join('\n')
    : '  • No open deals'

  const postsText = data.recent_posts.length > 0
    ? data.recent_posts.map(p => `  • ${p.title || 'Untitled'} (${p.status})`).join('\n')
    : '  • No recent posts'

  const competitorText = data.competitors.length > 0
    ? data.competitors.map(c => `  • ${c.name} (${c.status || 'tracked'})`).join('\n')
    : '  • No competitors tracked'

  const baseContext = `
Business: ${bizName}
Industry: ${industry}
Period: ${lastMonthName} → ${thisMonthName}
Health Score: ${metrics.find(m => m.label === 'Health Score')?.curr ?? 'N/A'}/100

KEY METRICS:
${metricsText}

TOP DEALS:
${dealsText}

RECENT CONTENT:
${postsText}

COMPETITORS:
${competitorText}
`.trim()

  const focusMap: Record<string, string> = {
    'compare-improvement': `Compare ${lastMonthName} vs ${thisMonthName} performance. Focus on what changed and why it matters.`,
    'monthly-review':      `Provide a full monthly review of ${thisMonthName} business performance across all areas.`,
    'pipeline-summary':    `Focus primarily on the deal pipeline. The business has ${data.open_deals_count} open deals. Analyze pipeline health, stage distribution, and revenue forecast.`,
    'content-performance': `Focus on content marketing performance. Analyze post volume, cadence, and effectiveness.`,
    'nps-report':          `Focus on customer reviews, satisfaction, and NPS. The average rating this month is ${metrics.find(m => m.label === 'Avg Rating')?.curr?.toFixed(1) ?? 'N/A'}★.`,
    'competitor-intel':    `Focus on competitive landscape. Analyze tracked competitors and their activity versus this business.`,
    'client-report':       `Write a professional, client-facing executive summary. Be positive and action-oriented. Suitable for sharing with a client or stakeholder.`,
  }

  const focus = focusMap[type] ?? focusMap['monthly-review']

  return `You are a business analyst. ${focus}

${baseContext}

Return ONLY valid JSON with exactly this structure:
{
  "executive_summary": "3-4 sentence overview of the overall business performance this period. Be specific about numbers.",
  "winning": "2-3 sentences on what improved or is going well. Reference actual numbers. Be specific.",
  "needs_attention": "2-3 sentences on what declined or needs action. Reference actual numbers. Be honest and suggest a specific action.",
  "next_actions": "3-4 bullet points (one per line, starting with •) of concrete next steps the business owner should take this month."
}

Be specific, data-driven, and avoid generic business advice. Reference actual metrics from the data.`
}

// ─── main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const type: string = body.type ?? 'monthly-review'

  // ── resolve business ───────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()

  let creditBalance: number | undefined
  if (profile?.current_workspace_id) {
    const credit = await deductCredits(profile.current_workspace_id, 'report_generate', `Report: ${type}`)
    if (!credit.ok) return NextResponse.json({ error: credit.error }, { status: 402 })
    creditBalance = credit.balance
  }

  const { data: businessRaw } = profile?.current_workspace_id
    ? await supabase
        .from('businesses')
        .select('id, name, industry, integrations, health_score')
        .eq('workspace_id', profile.current_workspace_id)
        .maybeSingle()
    : { data: null }

  if (!businessRaw) return NextResponse.json({ error: 'No business found' }, { status: 404 })

  // ── date ranges ────────────────────────────────────────────────────────────
  const now = new Date()
  const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString()
  const lastMonthEnd   = thisMonthStart
  const todayEnd       = now.toISOString()

  const thisMonthName = MONTH_NAMES[now.getUTCMonth()]
  const lastMonthName = MONTH_NAMES[(now.getUTCMonth() + 11) % 12]

  // ── parallel data fetch ────────────────────────────────────────────────────
  const [
    { count: leadsThis },
    { count: leadsPrev },
    { data: dealsOpen },
    { data: dealsWonThis },
    { data: dealsWonPrev },
    { count: postsThis },
    { count: postsPrev },
    { count: reviewsThis },
    { count: reviewsPrev },
    { data: reviewsRatingThis },
    { data: reviewsRatingPrev },
    { data: competitors },
    { data: recentPosts },
    { data: topDeals },
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', businessRaw.id).gte('created_at', thisMonthStart).lte('created_at', todayEnd),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', businessRaw.id).gte('created_at', lastMonthStart).lt('created_at', lastMonthEnd),
    supabase.from('deals').select('value, stage, title').eq('business_id', businessRaw.id).eq('status', 'open').order('value', { ascending: false }),
    supabase.from('deals').select('value').eq('business_id', businessRaw.id).eq('status', 'won').gte('updated_at', thisMonthStart),
    supabase.from('deals').select('value').eq('business_id', businessRaw.id).eq('status', 'won').gte('updated_at', lastMonthStart).lt('updated_at', lastMonthEnd),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', businessRaw.id).eq('status', 'published').gte('created_at', thisMonthStart),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', businessRaw.id).eq('status', 'published').gte('created_at', lastMonthStart).lt('created_at', lastMonthEnd),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', businessRaw.id).gte('created_at', thisMonthStart),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', businessRaw.id).gte('created_at', lastMonthStart).lt('created_at', lastMonthEnd),
    supabase.from('reviews').select('rating').eq('business_id', businessRaw.id).gte('created_at', thisMonthStart),
    supabase.from('reviews').select('rating').eq('business_id', businessRaw.id).gte('created_at', lastMonthStart).lt('created_at', lastMonthEnd),
    supabase.from('competitors').select('name, status, notes').eq('business_id', businessRaw.id).limit(5),
    supabase.from('posts').select('title, status, created_at').eq('business_id', businessRaw.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('deals').select('title, value, stage').eq('business_id', businessRaw.id).eq('status', 'open').order('value', { ascending: false }).limit(5),
  ])

  // ── computed metrics ───────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const biz = businessRaw as any
  const integrations  = biz.integrations ?? {}
  const websiteMetrics = integrations.__website_metrics ?? null
  const goals         = integrations.__goals ?? []
  const healthScore   = biz.health_score ?? 0

  const pipelineValue = (dealsOpen ?? []).reduce((s: number, d: { value: unknown }) => s + (Number(d.value) || 0), 0)
  const wonRevThis    = (dealsWonThis ?? []).reduce((s: number, d: { value: unknown }) => s + (Number(d.value) || 0), 0)
  const wonRevPrev    = (dealsWonPrev ?? []).reduce((s: number, d: { value: unknown }) => s + (Number(d.value) || 0), 0)
  const avgRatingThis = reviewsRatingThis?.length
    ? reviewsRatingThis.reduce((s: number, r: { rating: number }) => s + (r.rating || 0), 0) / reviewsRatingThis.length
    : 0
  const avgRatingPrev = reviewsRatingPrev?.length
    ? reviewsRatingPrev.reduce((s: number, r: { rating: number }) => s + (r.rating || 0), 0) / reviewsRatingPrev.length
    : 0

  // ── comparison metrics ─────────────────────────────────────────────────────
  const rawMetrics = [
    { label: 'New Leads',     prev: leadsPrev ?? 0, curr: leadsThis ?? 0,   unit: '' },
    { label: 'Won Revenue',   prev: wonRevPrev,      curr: wonRevThis,        unit: '$', isRevenue: true },
    { label: 'Open Pipeline', prev: 0,               curr: pipelineValue,     unit: '$', isRevenue: true, noCompare: true },
    { label: 'Content Posts', prev: postsPrev ?? 0,  curr: postsThis ?? 0,    unit: '' },
    { label: 'New Reviews',   prev: reviewsPrev ?? 0, curr: reviewsThis ?? 0, unit: '' },
    { label: 'Avg Rating',    prev: avgRatingPrev,   curr: avgRatingThis,     unit: '★', isFloat: true },
    { label: 'Health Score',  prev: 0,               curr: healthScore,       unit: '', noCompare: true },
  ]

  const comparisonMetrics: ComparisonMetric[] = rawMetrics.map(m => ({
    ...m,
    change: m.noCompare ? null : pctChange(m.curr, m.prev),
    trend:  m.noCompare ? 'flat' : trend(m.curr, m.prev),
  }))

  // ── report data object ─────────────────────────────────────────────────────
  const reportTitle = buildReportTitle(type, thisMonthName, lastMonthName)

  const reportData: Omit<ReportData, 'ai'> = {
    title:          reportTitle,
    business_name:  businessRaw.name,
    generated_at:   now.toISOString(),
    period:         { this_month: thisMonthName, last_month: lastMonthName },
    metrics:        comparisonMetrics,
    data: {
      top_deals:       (topDeals ?? []) as { title: string; value: number; stage: string }[],
      recent_posts:    (recentPosts ?? []) as { title: string; status: string; created_at: string }[],
      competitors:     (competitors ?? []) as { name: string; status: string; notes: string }[],
      goals,
      website_metrics: websiteMetrics,
      open_deals_count: dealsOpen?.length ?? 0,
    },
  }

  // ── Claude AI narrative ────────────────────────────────────────────────────
  const DEFAULT_AI = {
    executive_summary: `${businessRaw.name} recorded ${leadsThis ?? 0} new leads this month with a pipeline value of $${pipelineValue.toLocaleString()}. Won revenue stands at $${wonRevThis.toLocaleString()} and the health score is ${healthScore}/100. Content activity saw ${postsThis ?? 0} published posts with an average review rating of ${avgRatingThis.toFixed(1)}★.`,
    winning:           wonRevThis >= wonRevPrev
      ? `Won revenue improved to $${wonRevThis.toLocaleString()} vs $${wonRevPrev.toLocaleString()} last month — a positive signal for the pipeline conversion.`
      : `Lead volume of ${leadsThis ?? 0} provides a solid top-of-funnel for the coming month.`,
    needs_attention:   wonRevThis < wonRevPrev
      ? `Won revenue dropped from $${wonRevPrev.toLocaleString()} to $${wonRevThis.toLocaleString()}. Review your follow-up cadence and focus on advancing the ${dealsOpen?.length ?? 0} open deals.`
      : avgRatingThis < 4
      ? `Average review rating of ${avgRatingThis.toFixed(1)}★ is below target. Implement a proactive review-request workflow for happy customers.`
      : `Monitor the open pipeline of $${pipelineValue.toLocaleString()} across ${dealsOpen?.length ?? 0} deals to ensure steady conversion.`,
    next_actions: `• Follow up on all open deals in the pipeline\n• Request reviews from recent clients to improve rating\n• Publish at least ${Math.max(4, (postsThis ?? 0) + 2)} posts next month\n• Review competitor activity and update positioning`,
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key') {
    return NextResponse.json({ ...reportData, ai: DEFAULT_AI }, creditBalance !== undefined ? { headers: { 'X-Credits-Remaining': String(creditBalance) } } : undefined)
  }

  let ai = DEFAULT_AI
  try {
    const client = new Anthropic({ apiKey })
    const prompt = buildPrompt(
      type,
      businessRaw.name,
      biz.industry ?? 'Business',
      thisMonthName,
      lastMonthName,
      comparisonMetrics,
      reportData.data,
    )
    const msg = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages:   [{ role: 'user', content: prompt }],
    })
    const text  = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      ai = {
        executive_summary: parsed.executive_summary ?? DEFAULT_AI.executive_summary,
        winning:           parsed.winning           ?? DEFAULT_AI.winning,
        needs_attention:   parsed.needs_attention   ?? DEFAULT_AI.needs_attention,
        next_actions:      parsed.next_actions      ?? DEFAULT_AI.next_actions,
      }
    }
  } catch {
    // keep DEFAULT_AI
  }

  return NextResponse.json({ ...reportData, ai }, creditBalance !== undefined ? { headers: { 'X-Credits-Remaining': String(creditBalance) } } : undefined)
}
