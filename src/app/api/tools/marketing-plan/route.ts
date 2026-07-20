import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/credits'

export type { MarketingAction, MarketingPhase, MarketingPlan } from '@/types/marketing-plan'
import type { MarketingAction, MarketingPhase, MarketingPlan } from '@/types/marketing-plan'

const FALLBACK: MarketingPlan = {
  goal: 'Generate 100 qualified leads in 30 days',
  strategy_summary: 'Combine AI-powered outreach with LinkedIn content and targeted cold email to fill your pipeline fast.',
  key_channels: ['LinkedIn', 'Cold Email', 'Content Marketing', 'Referrals'],
  phases: [
    {
      name: 'Foundation', weeks: 'Week 1–2', focus: 'Build your lead generation infrastructure',
      actions: [
        { title: 'Build target prospect list', description: 'Use AI to find 200 decision-makers matching your ICP — job title, company size, and industry', impact: 'high', effort: 'low', timeline: 'Day 1–3', action_type: 'leads', ai_help_type: null, external_tools: [] },
        { title: 'Write cold email sequence', description: 'Create a 5-email value-first sequence that starts conversations and books demos', impact: 'high', effort: 'medium', timeline: 'Day 3–5', action_type: 'campaigns', ai_help_type: 'email_sequence', external_tools: [] },
        { title: 'Optimize LinkedIn profile', description: 'Update headline, about section, and banner to speak directly to your ICP\'s pain points', impact: 'medium', effort: 'low', timeline: 'Day 1–2', action_type: 'external', ai_help_type: 'linkedin_bio', external_tools: ['LinkedIn'] },
      ],
    },
    {
      name: 'Outreach', weeks: 'Week 3–4', focus: 'Execute multi-channel outreach at scale',
      actions: [
        { title: 'Launch LinkedIn content daily', description: 'Post daily insights about problems your ICP faces — each post builds trust with 1,000+ potential buyers', impact: 'high', effort: 'medium', timeline: 'Every day', action_type: 'content', ai_help_type: 'linkedin_post', external_tools: [] },
        { title: 'Send cold email campaign', description: 'Launch your email sequence to 200 prospects — aim for 40%+ open rate with strong subject lines', impact: 'high', effort: 'low', timeline: 'Week 3', action_type: 'leads/cold', ai_help_type: null, external_tools: [] },
        { title: 'Send personalized LinkedIn DMs', description: 'Reach out to prospects who engaged with your content — high-intent signals mean 3× higher reply rates', impact: 'high', effort: 'high', timeline: 'Daily, 20 per day', action_type: 'leads', ai_help_type: 'linkedin_post', external_tools: [] },
      ],
    },
    {
      name: 'Convert', weeks: 'Month 2', focus: 'Turn conversations into customers',
      actions: [
        { title: 'Send proposals to hot leads', description: 'For every positive reply, send a professional proposal within 24 hours while interest is high', impact: 'high', effort: 'medium', timeline: 'As leads come in', action_type: 'proposals', ai_help_type: null, external_tools: [] },
        { title: 'Run a free strategy session offer', description: 'Offer 30-min free sessions to qualified leads — closes 30% faster than demo-first approach', impact: 'high', effort: 'high', timeline: 'Weeks 5–8', action_type: 'campaigns', ai_help_type: 'email_sequence', external_tools: [] },
        { title: 'Collect and publish case studies', description: 'Ask your best existing customers for a testimonial — social proof reduces sales cycle by 40%', impact: 'medium', effort: 'medium', timeline: 'Week 5', action_type: 'reviews', ai_help_type: null, external_tools: [] },
      ],
    },
    {
      name: 'Scale', weeks: 'Month 3', focus: 'Build a repeatable growth engine',
      actions: [
        { title: 'Launch referral program', description: 'Turn happy customers into your best salespeople — offer 1 month free for each referral', impact: 'high', effort: 'low', timeline: 'Month 3', action_type: 'campaigns', ai_help_type: 'email_sequence', external_tools: [] },
        { title: 'Track what\'s working', description: 'Identify your best-converting channel and double down — eliminate what isn\'t working', impact: 'high', effort: 'low', timeline: 'Every Friday', action_type: 'analytics', ai_help_type: null, external_tools: [] },
        { title: 'Run paid ads on winning content', description: 'Boost the LinkedIn post with highest organic engagement — amplify what already works', impact: 'medium', effort: 'medium', timeline: 'Month 3', action_type: 'external', ai_help_type: 'ad_copy', external_tools: ['LinkedIn Ads', 'Google Ads'] },
      ],
    },
  ],
  expected_results: [
    { label: 'Leads Generated', value: '80–120' },
    { label: 'Demos Booked', value: '15–25' },
    { label: 'Deals Closed', value: '3–6' },
    { label: 'MRR Added', value: '+$3–8K' },
  ],
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const goal: string = body.goal ?? 'Generate qualified leads and grow revenue'

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()

  const wsId = profile?.current_workspace_id
  if (!wsId) return NextResponse.json({ plan: FALLBACK })

  const credit = await deductCredits(wsId, 'marketing_plan', 'Marketing Plan generation')
  if (!credit.ok) return NextResponse.json({ error: credit.error }, { status: 402 })

  const [bizRes, leadsRes, dealsRes, competitorsRes] = await Promise.all([
    supabase.from('businesses').select('name, industry, target_customer, country, health_score, integrations').eq('workspace_id', wsId).maybeSingle(),
    supabase.from('leads').select('id, status', { count: 'exact', head: false }).eq('workspace_id', wsId),
    supabase.from('deals').select('stage, value').eq('workspace_id', wsId).limit(30),
    supabase.from('competitors').select('name').eq('workspace_id', wsId).limit(4),
  ])

  const biz = bizRes.data
  const leads = leadsRes.data ?? []
  const deals = dealsRes.data ?? []
  const competitors = competitorsRes.data ?? []
  const wm = (biz?.integrations as Record<string, unknown> | null)?.__website_metrics as Record<string, unknown> | undefined
  const wonDeals = deals.filter(d => d.stage === 'won')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key') {
    return NextResponse.json({ plan: { ...FALLBACK, goal } }, { headers: { 'X-Credits-Remaining': String(credit.balance) } })
  }

  // Available CooVex action_type values the AI can assign:
  // leads → /leads (AI Lead Finder)
  // leads/cold → /leads/cold (Cold Outreach)
  // content → /content (AI Content Writer — LinkedIn/social)
  // campaigns → /campaigns (Email Campaign Builder)
  // proposals → /proposals (Proposal Builder)
  // competitors → /competitors (Competitor Tracker)
  // reviews → /reviews (Review Manager)
  // analytics → /analytics (Analytics Dashboard)
  // external → no CooVex feature, suggest tools

  const prompt = `You are an expert B2B marketer. Build a concrete 30-90 day marketing plan to achieve: "${goal}"

BUSINESS:
- Name: ${biz?.name || 'Unknown'}
- Industry: ${biz?.industry || 'B2B SaaS'}
- Target customer: ${biz?.target_customer || 'SMBs'}
- Country: ${biz?.country || 'Unknown'}
- Health score: ${biz?.health_score ?? 'N/A'}/100
- MRR: $${wm?.mrr ?? 0}
- Paying customers: ${wm?.paying_customers ?? 0}
- Total leads: ${leads.length}
- Won deals: ${wonDeals.length}
- Competitors: ${competitors.map(c => c.name).join(', ') || 'none tracked'}

AVAILABLE COOVEX FEATURES (assign action_type from this list only):
- "leads" → AI Lead Finder (finds and scores leads)
- "leads/cold" → Cold Outreach (send cold emails/messages)
- "content" → AI Content Writer (LinkedIn posts, social content)
- "campaigns" → Email Campaign Builder (drip campaigns, newsletters)
- "proposals" → Proposal Builder (send professional proposals)
- "competitors" → Competitor Tracker (monitor competitor activity)
- "reviews" → Review Manager (collect and respond to reviews)
- "analytics" → Analytics Dashboard (track performance)
- "external" → use external_tools array for this action

Return ONLY valid JSON:
{
  "goal": "${goal}",
  "strategy_summary": "2 sentence strategic summary — what's the core approach and why it will work for this specific business",
  "key_channels": ["3-4 most effective channels for this goal and industry"],
  "phases": [
    {
      "name": "phase name",
      "weeks": "Week 1–2",
      "focus": "one sentence — what this phase achieves",
      "actions": [
        {
          "title": "specific action title",
          "description": "what to do and why it works — specific, not vague. Reference actual business context.",
          "impact": "high|medium|low",
          "effort": "high|medium|low",
          "timeline": "Day 1-3 / Week 2 / Daily / etc.",
          "action_type": "use one from the list above",
          "ai_help_type": "linkedin_post|email_sequence|ad_copy|null",
          "external_tools": ["Tool Name"]
        }
      ]
    }
  ],
  "expected_results": [
    { "label": "metric name", "value": "realistic number range" }
  ]
}

Rules:
- Exactly 4 phases
- Each phase: 3 actions
- Start from current state (if MRR is $0, don't assume large existing base)
- action_type MUST be one of the values listed above
- ai_help_type only for: LinkedIn posts, email copy, ad copy — null otherwise
- expected_results: 4 metrics relevant to the goal
- Be bold and specific — no generic "improve your online presence" advice`

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 5000,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const plan: MarketingPlan = JSON.parse(match[0])
      return NextResponse.json({ plan }, { headers: { 'X-Credits-Remaining': String(credit.balance) } })
    }
    console.error('[marketing-plan] AI response had no JSON:', text.slice(0, 300))
  } catch (err) {
    console.error('[marketing-plan] API error:', err)
  }

  return NextResponse.json({ plan: { ...FALLBACK, goal }, _fallback: true }, { headers: { 'X-Credits-Remaining': String(credit.balance) } })
}
