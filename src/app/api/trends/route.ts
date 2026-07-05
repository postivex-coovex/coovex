import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const CACHE_HOURS = 6 // regenerate after 6 hours

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, industry, country, integrations').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ trends: [], generated_at: null, next_refresh_in: 0 })

  const integrations = (business.integrations as Record<string, unknown>) ?? {}
  const cache = integrations.__trends as { data: unknown[]; generated_at: string } | undefined

  if (cache?.data && cache.generated_at) {
    const ageHours = (Date.now() - new Date(cache.generated_at).getTime()) / 3600000
    const nextIn   = Math.max(0, CACHE_HOURS - ageHours)
    return NextResponse.json({
      trends:         cache.data,
      generated_at:   cache.generated_at,
      next_refresh_in: Math.round(nextIn * 10) / 10,
      industry:       business.industry,
      country:        business.country,
    })
  }

  return NextResponse.json({ trends: [], generated_at: null, next_refresh_in: 0, industry: business.industry, country: business.country })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { force } = (await req.json().catch(() => ({}))) as { force?: boolean }

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, name, industry, country, integrations, health_score').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business found' }, { status: 404 })

  const integrations = (business.integrations as Record<string, unknown>) ?? {}
  const cache = integrations.__trends as { data: unknown[]; generated_at: string } | undefined

  // Throttle: don't regenerate within CACHE_HOURS unless forced
  if (!force && cache?.generated_at) {
    const ageHours = (Date.now() - new Date(cache.generated_at).getTime()) / 3600000
    if (ageHours < CACHE_HOURS) {
      return NextResponse.json({
        trends:         cache.data,
        generated_at:   cache.generated_at,
        next_refresh_in: Math.round((CACHE_HOURS - ageHours) * 10) / 10,
        cached:         true,
      })
    }
  }

  // Gather business context for a richer, more specific prompt
  const [
    { data: leads },
    { data: competitors },
    { data: wonDeals },
  ] = await Promise.all([
    supabase.from('leads').select('stage, source, score').eq('business_id', business.id).limit(200),
    supabase.from('competitors').select('name, market_type').eq('business_id', business.id).limit(8),
    supabase.from('deals').select('value').eq('business_id', business.id).eq('status', 'won').limit(20),
  ])

  const allLeads    = leads ?? []
  const wonLeads    = allLeads.filter(l => l.stage === 'won')
  const winRate     = allLeads.filter(l => ['won','lost'].includes(l.stage)).length > 0
    ? Math.round((wonLeads.length / allLeads.filter(l => ['won','lost'].includes(l.stage)).length) * 100)
    : 0
  const topSource   = Object.entries(
    allLeads.reduce<Record<string,number>>((m, l) => { m[l.source ?? 'unknown'] = (m[l.source ?? 'unknown'] ?? 0) + 1; return m }, {})
  ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown'
  const competitorNames = (competitors ?? []).map(c => c.name).filter(Boolean).slice(0, 5)
  const avgDeal = wonDeals && wonDeals.length > 0
    ? Math.round(wonDeals.reduce((s, d) => s + Number(d.value), 0) / wonDeals.length)
    : 0

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const prompt = `You are a business intelligence analyst generating CURRENT, SPECIFIC industry trends.

Today's date: ${today}

Business context:
- Industry: ${business.industry || 'Business'}
- Country / Market: ${business.country || 'Global'}
- Total leads: ${allLeads.length}, Win rate: ${winRate}%
- Top acquisition channel: ${topSource}
- Avg deal size: ${avgDeal > 0 ? `$${avgDeal}` : 'unknown'}
- Known competitors: ${competitorNames.length > 0 ? competitorNames.join(', ') : 'none tracked'}
- Health score: ${business.health_score ?? 'not calculated'}

Generate exactly 6 industry trends that are:
1. SPECIFIC to the ${business.industry || 'business'} industry in ${business.country || 'global markets'} as of ${today}
2. Each trend must reference REAL statistics or observable market shifts (e.g., "42% of SaaS companies report...", "HubSpot's 2025 State of Marketing shows...")
3. At least 2 trends should be directly actionable given the business context above (e.g., reference their win rate, top channel, or competitor names if relevant)
4. Include diverse categories: at least one AI/tech, one market/competitive, one customer behavior

Return ONLY a valid JSON array of exactly 6 objects with these exact fields:
[
  {
    "title": "5-8 word specific headline",
    "summary": "2-3 sentences with a specific stat or data point. Mention real companies or research when possible.",
    "impact": "high" | "medium" | "low",
    "category": "ai" | "consumer" | "regulation" | "technology" | "market" | "sustainability",
    "action_tip": "One specific action for a ${business.industry} business with ${winRate}% win rate to capitalize on this trend this month.",
    "stat": "The key stat in this trend (e.g., '67% of buyers' or '$2.3B market')",
    "relevance": "high" | "medium" | "low"  // how directly relevant to THIS business
  }
]

No markdown, no explanation, no code blocks. Return only the JSON array.`

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 2000,
    messages:   [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

  let trends: unknown[]
  try {
    const match = text.match(/\[[\s\S]*\]/)
    trends = JSON.parse(match ? match[0] : text)
    if (!Array.isArray(trends)) throw new Error('Not an array')
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw: text.slice(0, 300) }, { status: 500 })
  }

  // Save to DB cache
  const now = new Date().toISOString()
  await supabase.from('businesses').update({
    integrations: { ...integrations, __trends: { data: trends, generated_at: now } },
  }).eq('id', business.id)

  return NextResponse.json({ trends, generated_at: now, next_refresh_in: CACHE_HOURS, cached: false })
}
