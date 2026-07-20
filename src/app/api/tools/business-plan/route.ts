import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/credits'

export type { PlanMilestone, PlanQuarter, ExecutionPlan } from '@/types/business-plan'
import type { PlanMilestone, PlanQuarter, ExecutionPlan } from '@/types/business-plan'

const FALLBACK: ExecutionPlan = {
  product: 'Overall Business',
  annual_goal: 'Reach $500K ARR and 500 paying customers by end of year',
  key_metrics: [
    { label: 'MRR Target', target: '$42K', current: '$0' },
    { label: 'Paying Customers', target: '500', current: '0' },
    { label: 'Monthly Churn', target: '<3%', current: 'N/A' },
    { label: 'Health Score', target: '85/100', current: '71/100' },
  ],
  quarters: [
    {
      label: 'Q1', months: 'Jan – Mar', theme: 'Foundation & First Revenue',
      objectives: ['Validate product-market fit', 'Acquire first 20 paying customers', 'Set up core growth channels'],
      milestones: [
        { title: 'Launch lead generation funnel', description: 'Build the core acquisition engine', priority: 'high', due: 'Month 1', steps: ['Create high-converting landing page', 'Set up email capture and 5-email nurture sequence', 'Publish 3 SEO articles targeting buyer-intent keywords'] },
        { title: 'Close first 10 paying customers', description: 'Manual sales to validate pricing and ICP', priority: 'high', due: 'Month 2', steps: ['Identify 50 ideal-fit leads from network', 'Send personalized cold outreach with demo offer', 'Run 30-min discovery calls and iterate on pitch'] },
        { title: 'Set up analytics baseline', description: 'Track the metrics that matter', priority: 'medium', due: 'Month 3', steps: ['Install tracking for signups, activations, and churn', 'Create weekly KPI dashboard', 'Define North Star Metric'] },
      ],
    },
    {
      label: 'Q2', months: 'Apr – Jun', theme: 'Growth & Repeatability',
      objectives: ['Reach $10K MRR', 'Establish repeatable sales motion', 'Launch content flywheel'],
      milestones: [
        { title: 'Launch content marketing engine', description: 'Build organic traffic for sustainable growth', priority: 'high', due: 'Month 4', steps: ['Publish 2 blog posts per week', 'Start LinkedIn founder content (3x/week)', 'Build backlink strategy with 10 guest posts'] },
        { title: 'Build partner channel', description: 'Access warm leads through ecosystem partners', priority: 'medium', due: 'Month 5', steps: ['Identify 20 complementary service providers', 'Create partner referral program (15% rev-share)', 'Co-market with first 3 partners'] },
        { title: 'Improve onboarding & reduce churn', description: 'Retain the customers we acquire', priority: 'high', due: 'Month 6', steps: ['Map and optimize 7-day onboarding journey', 'Launch in-app activation checklist', 'Set up automated churn risk alerts at day 14'] },
      ],
    },
    {
      label: 'Q3', months: 'Jul – Sep', theme: 'Scale & Efficiency',
      objectives: ['Reach $25K MRR', 'Launch paid acquisition', 'Expand team'],
      milestones: [
        { title: 'Launch paid acquisition', description: 'Pour fuel on what already works organically', priority: 'high', due: 'Month 7', steps: ['Run $2K/mo test on LinkedIn Ads and Google Search', 'A/B test 3 ad angles', 'Optimize for trial signups at CAC < $120'] },
        { title: 'Hire first customer success role', description: 'Protect revenue with dedicated CS', priority: 'medium', due: 'Month 8', steps: ['Define CS scope and success metrics', 'Post role, interview, and onboard', 'Handoff top 50 accounts from founder'] },
        { title: 'Launch annual plan upsell', description: 'Improve cash flow and LTV', priority: 'medium', due: 'Month 9', steps: ['Offer 20% discount for annual pre-payment', 'Email existing customers with upgrade offer', 'Track annual vs monthly conversion rate'] },
      ],
    },
    {
      label: 'Q4', months: 'Oct – Dec', theme: 'Momentum & 2027 Setup',
      objectives: ['Reach $42K MRR ($500K ARR)', 'Lock in partnerships for next year', 'Build 2027 roadmap'],
      milestones: [
        { title: 'Launch enterprise tier', description: 'Unlock higher ACV with team features', priority: 'high', due: 'Month 10', steps: ['Define enterprise feature set (SSO, admin, audit logs)', 'Price at $499–$999/mo', 'Reach out to 30 enterprise prospects with pilot offer'] },
        { title: 'Build 2027 product roadmap', description: 'Plan next year based on what customers need most', priority: 'medium', due: 'Month 11', steps: ['Survey top 50 customers on pain points', 'Run internal roadmap prioritization sprint', 'Publish public roadmap to build community trust'] },
        { title: 'Close year with investor update', description: 'Prepare for potential raise in Q1 next year', priority: 'medium', due: 'Month 12', steps: ['Compile full-year metrics and growth story', 'Update pitch deck with real traction data', 'Schedule calls with 10 target investors'] },
      ],
    },
  ],
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const product: string = body.product ?? ''

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()

  const wsId = profile?.current_workspace_id
  if (!wsId) return NextResponse.json({ plan: FALLBACK })

  const credit = await deductCredits(wsId, 'business_plan', 'Business Plan generation')
  if (!credit.ok) return NextResponse.json({ error: credit.error }, { status: 402 })

  const [bizRes, leadsRes, dealsRes, competitorsRes, goalsRes] = await Promise.all([
    supabase.from('businesses')
      .select('name, industry, target_customer, country, health_score, integrations')
      .eq('workspace_id', wsId).maybeSingle(),
    supabase.from('leads').select('id, status', { count: 'exact', head: false }).eq('workspace_id', wsId),
    supabase.from('deals').select('stage, value').eq('workspace_id', wsId).limit(50),
    supabase.from('competitors').select('name, status').eq('workspace_id', wsId).limit(5),
    supabase.from('goals').select('title, status, target_value, current_value').eq('workspace_id', wsId).limit(6),
  ])

  const biz = bizRes.data
  const leads = leadsRes.data ?? []
  const deals = dealsRes.data ?? []
  const competitors = competitorsRes.data ?? []
  const goals = goalsRes.data ?? []

  const wm = (biz?.integrations as Record<string, unknown> | null)?.__website_metrics as Record<string, unknown> | undefined
  const wonDeals = deals.filter(d => d.stage === 'won')
  const openDeals = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost')
  const openPipeline = openDeals.reduce((s, d) => s + Number(d.value ?? 0), 0)

  const currentYear = new Date().getFullYear()
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
  const quarterMonths = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec']

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key') {
    return NextResponse.json({ plan: FALLBACK }, { headers: { 'X-Credits-Remaining': String(credit.balance) } })
  }

  const prompt = `You are a strategic business execution consultant. Build a detailed quarterly execution roadmap. Return ONLY valid JSON — no markdown, no explanations.

BUSINESS CONTEXT:
- Business: ${biz?.name || 'Unknown'} ${product ? `(planning for: ${product})` : '(overall business plan)'}
- Industry: ${biz?.industry || 'Technology'}
- Target customer: ${biz?.target_customer || 'SMBs'}
- Country: ${biz?.country || 'Unknown'}
- Health score: ${biz?.health_score ?? 'N/A'}/100

CURRENT STATE:
- MRR: $${wm?.mrr ?? 0}
- Paying customers: ${wm?.paying_customers ?? 0}
- Churn: ${wm?.churn_rate ?? 'N/A'}%
- Monthly visitors: ${wm?.monthly_visitors ?? 'N/A'}
- Total leads: ${leads.length}
- Open pipeline: $${openPipeline.toLocaleString()} (${openDeals.length} deals)
- Won deals: ${wonDeals.length}

EXISTING GOALS:
${goals.length > 0 ? goals.map(g => `- ${g.title} (${g.status}): ${g.current_value ?? 0}/${g.target_value ?? '?'}`).join('\n') : '- None set'}

COMPETITORS:
${competitors.length > 0 ? competitors.map(c => `- ${c.name}`).join('\n') : '- None tracked'}

${product ? `SPECIFIC FOCUS: Create a plan specifically for "${product}" — not the overall business.` : 'Create an overall business execution plan.'}

Return this exact JSON structure:
{
  "product": "${product || biz?.name || 'Overall Business'}",
  "annual_goal": "one specific, measurable annual goal with numbers",
  "key_metrics": [
    { "label": "metric name", "target": "target value", "current": "current value from data" }
  ],
  "quarters": [
    {
      "label": "${quarters[0]}",
      "months": "${quarterMonths[0]} ${currentYear}",
      "theme": "theme in 3-4 words",
      "objectives": ["2-3 specific quarter objectives"],
      "milestones": [
        {
          "title": "milestone title",
          "description": "one line description",
          "priority": "high|medium|low",
          "due": "Month 1|2|3",
          "steps": ["3-4 concrete action steps"]
        }
      ]
    }
  ]
}

Rules:
- key_metrics: exactly 4 metrics based on current state and annual goal
- Each quarter: exactly 2-3 milestones
- Each milestone: exactly 3-4 steps
- Steps must be specific, actionable, executable (not vague)
- Q1 milestones must reflect current stage (if MRR is $0, don't assume $100K revenue)
- Later quarters should build on earlier ones (sequential progress)
- All 4 quarters required`

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const plan: ExecutionPlan = JSON.parse(match[0])
      return NextResponse.json({ plan }, { headers: { 'X-Credits-Remaining': String(credit.balance) } })
    }
  } catch { /* fall through */ }

  return NextResponse.json({ plan: FALLBACK }, { headers: { 'X-Credits-Remaining': String(credit.balance) } })
}
