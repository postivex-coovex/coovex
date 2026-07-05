import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, name, industry, country, health_score, integrations').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business found for this workspace' }, { status: 404 })

  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString()

  const [
    { count: totalLeads },
    { count: leadsThisMonth },
    { count: wonLeads },
    { count: totalReviews },
    { data: reviews },
    { count: postsThisMonth },
    { count: totalPosts },
    { data: deals },
    { data: currentGoalsRaw },
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', monthStart),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id).eq('stage', 'won'),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('reviews').select('rating').eq('business_id', business.id),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', monthStart),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('deals').select('value, status, probability').eq('business_id', business.id),
    Promise.resolve({ data: null }),
  ])

  const allDeals    = deals ?? []
  const wonRevenue  = allDeals.filter(d => d.status === 'won').reduce((s, d) => s + Number(d.value), 0)
  const pipeline    = allDeals.filter(d => d.status === 'open').reduce((s, d) => s + Number(d.value), 0)
  const wonDealsQ   = allDeals.filter(d => d.status === 'won').length
  const avgRating   = (reviews ?? []).length > 0
    ? ((reviews ?? []).reduce((s, r) => s + (r.rating ?? 0), 0) / (reviews ?? []).length).toFixed(1)
    : 'none'
  const closedCount = wonLeads! + allDeals.filter(d => d.status === 'lost').length
  const winRate     = closedCount > 0 ? Math.round(((wonLeads ?? 0) / closedCount) * 100) : 0

  void currentGoalsRaw
  const integrations = (business.integrations as Record<string, unknown>) ?? {}
  const existingGoals: { title: string; category: string }[] =
    ((integrations.__goals as { title: string; category: string }[]) ?? [])
      .map(g => ({ title: g.title, category: g.category }))

  // Real metrics from user's system (via API push or manual popup)
  const wm = (integrations.__website_metrics as Record<string, number | string | undefined> | undefined) ?? null

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate()
  const today = `${MONTHS[m]} ${d}, ${y}`
  const monthName = MONTHS[m]
  const monthEnd  = new Date(Date.UTC(y, m + 1, 0))   // last day of current month
  const monthEndStr = `${MONTHS[monthEnd.getUTCMonth()]} ${monthEnd.getUTCDate()}, ${monthEnd.getUTCFullYear()}`
  const quarterEndMonth = Math.floor(m / 3) * 3 + 2
  const quarterEnd = new Date(Date.UTC(y, quarterEndMonth + 1, 0))
  const quarterEndStr = `${MONTHS[quarterEnd.getUTCMonth()]} ${quarterEnd.getUTCDate()}, ${quarterEnd.getUTCFullYear()}`
  const yearEndStr = `December 31, ${y}`

  const prompt = `You are a business growth advisor for a ${business.industry || 'business'} in ${business.country || 'global market'}.
Today: ${today}. Current month: ${monthName}.

${wm ? `VERIFIED REAL METRICS (from user's system — treat these as ground truth, not estimates):
- Paying customers: ${wm.paying_customers ?? 'unknown'}
- MRR: $${wm.mrr ?? 'unknown'} | ARR: $${wm.arr ?? 'unknown'}
- Daily Active Users: ${wm.dau ?? 'unknown'} | Monthly Active Users: ${wm.mau ?? 'unknown'}
- Trial users: ${wm.trial_users ?? 'unknown'}
- Churn rate: ${wm.churn_rate !== undefined ? `${(Number(wm.churn_rate) * 100).toFixed(1)}%` : 'unknown'}
- ARPU: $${wm.arpu ?? 'unknown'} | Conversion rate: ${wm.conversion_rate !== undefined ? `${(Number(wm.conversion_rate) * 100).toFixed(1)}%` : 'unknown'}
- Total signups: ${wm.total_signups ?? 'unknown'}
- NPS score: ${wm.nps_score ?? 'unknown'}
- Last synced: ${wm.updated_at ?? 'unknown'}
` : 'NOTE: No real metrics synced yet. Use CooVex DB data below as estimates only — do NOT assume the user has zero customers.'}

CooVex CRM data (may not reflect full picture without metrics sync):
- Total leads: ${totalLeads ?? 0} (${leadsThisMonth ?? 0} added this month)
- Won leads/clients: ${wonLeads ?? 0} | Win rate: ${winRate}%
- Won revenue (all time): $${wonRevenue.toLocaleString()} | Open pipeline: $${pipeline.toLocaleString()}
- Won deals count: ${wonDealsQ}
- Reviews: ${totalReviews ?? 0} | Avg rating: ${avgRating}★
- Posts created: ${totalPosts ?? 0} (${postsThisMonth ?? 0} this month)
- Health score: ${business.health_score ?? 0}/100

Existing goals (DO NOT suggest these again):
${existingGoals.length > 0 ? existingGoals.map(g => `- ${g.title} (${g.category})`).join('\n') : 'None yet'}

Period end dates (goals must end ON these dates — do NOT suggest next month or future months):
- Monthly goal ends: ${monthEndStr}
- Quarterly goal ends: ${quarterEndStr}
- Yearly goal ends: ${yearEndStr}

Generate exactly 5 goal suggestions that are:
1. SPECIFIC and NUMERIC — based on actual current numbers above
2. REALISTIC but slightly challenging (not too easy, not impossible)
3. Diverse — cover different categories
4. Achievable within the CURRENT period (not next month — the current month is ${monthName})

For each goal, calculate target based on realistic growth:
- Leads: currently ${leadsThisMonth ?? 0} this month, suggest 20-40% stretch for rest of ${monthName}
- Revenue: $${wonRevenue.toLocaleString()} won all time, suggest realistic target by ${monthEndStr}
- Reviews: ${totalReviews ?? 0} total, suggest 3-5 new by ${monthEndStr}
- Content: ${postsThisMonth ?? 0} posts this month, suggest 30-50% increase by ${monthEndStr}
- Health: currently ${business.health_score ?? 0}/100, target improvement by ${monthEndStr}

Return ONLY a valid JSON array of exactly 5 objects:
[
  {
    "title": "Specific goal title (include target number)",
    "category": "leads" | "revenue" | "reviews" | "content" | "health" | "custom",
    "period": "monthly" | "quarterly" | "yearly",
    "target": <number>,
    "unit": "leads" | "$" | "reviews" | "posts" | "pts" | "clients" | etc,
    "reasoning": "1-2 sentences: why this goal, what data supports it, what achieving it means",
    "difficulty": "easy" | "realistic" | "stretch"
  }
]

No markdown, no explanation, JSON array only.`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let text = ''
  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })
    text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Anthropic API error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  let suggestions: unknown[]
  try {
    const match = text.match(/\[[\s\S]*\]/)
    suggestions = JSON.parse(match ? match[0] : text)
    if (!Array.isArray(suggestions)) throw new Error('Not array')
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw: text.slice(0, 300) }, { status: 500 })
  }

  return NextResponse.json({ suggestions })
}
