import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

interface GoalInput {
  title: string
  category: string
  period: string
  target: number
  unit: string
  current: number
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const body = await req.json() as { goal: GoalInput }
  const { goal } = body
  if (!goal) return NextResponse.json({ error: 'Goal required' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, name, industry, country, health_score, integrations').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  // Gather relevant context based on goal category
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [leadsR, dealsR, postsR, reviewsR, competitorsR] = await Promise.all([
    supabase.from('leads').select('stage, source, score').eq('business_id', business.id).limit(100),
    supabase.from('deals').select('value, status, probability').eq('business_id', business.id),
    supabase.from('posts').select('channel, status').eq('business_id', business.id).gte('created_at', monthStart),
    supabase.from('reviews').select('rating').eq('business_id', business.id),
    supabase.from('competitors').select('name').eq('business_id', business.id).limit(5),
  ])

  const allLeads    = leadsR.data ?? []
  const allDeals    = dealsR.data ?? []
  const allPosts    = postsR.data ?? []
  const allReviews  = reviewsR.data ?? []
  const competitors = competitorsR.data ?? []

  const wonLeads    = allLeads.filter(l => l.stage === 'won').length
  const closedTotal = allLeads.filter(l => ['won', 'lost'].includes(l.stage)).length
  const winRate     = closedTotal > 0 ? Math.round((wonLeads / closedTotal) * 100) : 0
  const topSource   = Object.entries(
    allLeads.reduce<Record<string, number>>((m, l) => { m[l.source ?? 'unknown'] = (m[l.source ?? 'unknown'] ?? 0) + 1; return m }, {})
  ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown'
  const wonRevenue  = allDeals.filter(d => d.status === 'won').reduce((s, d) => s + Number(d.value), 0)
  const pipeline    = allDeals.filter(d => d.status === 'open').reduce((s, d) => s + Number(d.value), 0)
  const avgRating   = allReviews.length > 0 ? (allReviews.reduce((s, r) => s + (r.rating ?? 0), 0) / allReviews.length).toFixed(1) : 'none'
  const channels    = [...new Set(allPosts.map(p => p.channel).filter(Boolean))]

  const remaining = goal.target - goal.current
  const pct       = Math.round((goal.current / goal.target) * 100)

  // Calculate period weeks
  const periodWeeks = goal.period === 'monthly' ? 4 : goal.period === 'quarterly' ? 13 : 52

  const today = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const prompt = `You are a business growth strategist. Create a specific, actionable execution plan for this goal.

Today: ${today}
Business: ${business.name || 'unnamed'} | Industry: ${business.industry || 'SaaS'} | Country: ${business.country || 'Global'}

GOAL: "${goal.title}"
- Category: ${goal.category}
- Period: ${goal.period} (${periodWeeks} weeks)
- Target: ${goal.target} ${goal.unit}
- Current: ${goal.current} ${goal.unit} (${pct}% complete)
- Remaining: ${remaining} ${goal.unit}

Business context:
- Total leads: ${allLeads.length} | Win rate: ${winRate}% | Top channel: ${topSource}
- Won revenue: $${wonRevenue.toLocaleString()} | Pipeline: $${pipeline.toLocaleString()}
- Reviews: ${allReviews.length} | Avg rating: ${avgRating}★
- Posts this month: ${allPosts.length} | Channels: ${channels.join(', ') || 'none'}
- Competitors: ${competitors.map(c => c.name).join(', ') || 'none tracked'}
- Health score: ${business.health_score ?? 0}/100

Generate a highly specific execution plan that:
1. Accounts for current progress (${goal.current}/${goal.target} — need ${remaining} more)
2. Breaks the ${goal.period} into phases with clear weekly actions
3. References actual business data (win rate, top channel, current reviews, etc.)
4. Includes 2-3 quick wins (actions doable in the first week)
5. Identifies the #1 bottleneck to achieving this goal

Return ONLY valid JSON:
{
  "overview": "2-3 sentence strategy summary specific to their situation and current progress",
  "bottleneck": "The single biggest obstacle to achieving this goal based on their data",
  "phases": [
    {
      "label": "Week 1-2",
      "focus": "Phase focus in 4-6 words",
      "actions": ["Specific action 1", "Specific action 2", "Specific action 3"]
    }
  ],
  "quick_wins": [
    { "action": "Specific thing to do today/this week", "impact": "Expected result" }
  ],
  "kpi": "The one metric to check daily to know you're on track"
}

Use ${periodWeeks <= 4 ? '2' : periodWeeks <= 13 ? '3' : '4'} phases covering the full ${goal.period}.
No markdown, no explanation. JSON only.`

  let text = ''
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })
    text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'AI error' }, { status: 500 })
  }

  try {
    const match = text.match(/\{[\s\S]*\}/)
    const plan = JSON.parse(match ? match[0] : text)
    return NextResponse.json({ plan })
  } catch {
    return NextResponse.json({ error: 'Failed to parse plan', raw: text.slice(0, 200) }, { status: 500 })
  }
}
