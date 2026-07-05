import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const FALLBACK_PERSONA = {
  name: 'Alex Chen',
  age: '32–42',
  role: 'Head of Operations / VP of Marketing',
  company_size: '10–50 employees',
  industry: 'B2B SaaS / Professional Services',
  location: 'US, UK, or Canada',
  goals: [
    'Reduce manual work and automate repetitive business processes',
    'Get clearer visibility into pipeline and revenue performance',
    'Make data-driven decisions without needing a data analyst',
    'Scale the team without proportionally increasing overhead',
  ],
  pain_points: [
    'Spending too much time in spreadsheets instead of strategy',
    'No single source of truth for business metrics',
    'Difficulty tracking which marketing efforts actually drive revenue',
    'Sales and marketing teams not aligned on ideal customer profile',
  ],
  motivations: [
    'Looking credible and data-savvy in front of leadership',
    'Proving ROI of their team and initiatives',
    'Moving faster than competitors in their market',
  ],
  objections: [
    '"We already have a CRM, why do we need another tool?"',
    '"Our data is messy — I\'m not sure this will work for us."',
    '"I need to get buy-in from my CEO before committing."',
  ],
  buying_triggers: [
    'Just missed a quarterly revenue target',
    'Hired a new VP of Sales who wants better pipeline visibility',
    'Competitor adopted similar tooling and is moving faster',
    'Board meeting coming up and needs better reporting',
  ],
  preferred_channels: [
    'LinkedIn (professional content and case studies)',
    'Email newsletters from industry thought leaders',
    'G2 and Capterra reviews before purchase',
    'Referrals from trusted peers in their network',
  ],
  budget: '$500–$5,000/month depending on team size',
  decision_process: 'Evaluates 2–3 alternatives, requires a demo, involves finance for contracts over $1k/month. Typical sales cycle: 2–6 weeks.',
  summary: 'Your ideal customer is a data-hungry operator at a growing SMB who needs a system to prove business value to leadership. They buy on ROI and peer trust, not features. Lead with outcomes and use case studies from similar companies.',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const context: string = body.context ?? ''

  // ── resolve workspace ────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()

  const wsId = profile?.current_workspace_id
  if (!wsId) return NextResponse.json({ persona: FALLBACK_PERSONA })

  // ── fetch data in parallel ───────────────────────────────────────────────────
  const [bizRes, leadsRes, dealsRes, competitorsRes] = await Promise.all([
    supabase.from('businesses')
      .select('name, industry, target_customer, country, health_score, integrations')
      .eq('workspace_id', wsId).maybeSingle(),
    supabase.from('leads')
      .select('status, source')
      .eq('workspace_id', wsId).limit(100),
    supabase.from('deals')
      .select('stage, value')
      .eq('workspace_id', wsId).limit(50),
    supabase.from('competitors')
      .select('name, status')
      .eq('workspace_id', wsId).limit(5),
  ])

  const biz = bizRes.data
  const leads = leadsRes.data ?? []
  const deals = dealsRes.data ?? []
  const competitors = competitorsRes.data ?? []

  const wm = (biz?.integrations as Record<string, unknown> | null)?.__website_metrics as Record<string, unknown> | undefined

  const sourceCounts: Record<string, number> = {}
  for (const l of leads) {
    const src = l.source ?? 'unknown'
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1
  }
  const topSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)

  const wonDeals = deals.filter(d => d.stage === 'won')
  const avgDealValue = wonDeals.length > 0
    ? Math.round(wonDeals.reduce((s, d) => s + Number(d.value ?? 0), 0) / wonDeals.length)
    : 0

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key') {
    return NextResponse.json({ persona: FALLBACK_PERSONA })
  }

  const prompt = `You are a B2B go-to-market strategist. Build a detailed Ideal Customer Profile (ICP) / buyer persona for this business. Return ONLY valid JSON — no markdown, no explanations.

BUSINESS PROFILE:
- Name: ${biz?.name || 'Unknown Business'}
- Industry: ${biz?.industry || 'Business Services'}
- Target customer: ${biz?.target_customer || 'SMBs'}
- Country: ${biz?.country || 'Unknown'}
- Health score: ${biz?.health_score ?? 'N/A'}/100

SALES DATA:
- Total leads: ${leads.length}
- Won deals: ${wonDeals.length} (avg value: $${avgDealValue.toLocaleString()})
- Top lead sources: ${topSources.length > 0 ? topSources.map(([src, cnt]) => `${src} (${cnt})`).join(', ') : 'none tracked'}

COMPETITORS:
${competitors.length > 0 ? competitors.map(c => `- ${c.name} (${c.status ?? 'tracked'})`).join('\n') : '- None tracked'}

${wm ? `WEBSITE METRICS:
- MRR: $${wm.mrr ?? 'N/A'}
- Paying customers: ${wm.paying_customers ?? 'N/A'}
- Avg revenue per customer: $${wm.arpu ?? 'N/A'}` : ''}

${context ? `OWNER CONTEXT: ${context}` : ''}

Return JSON:
{
  "name": "a realistic persona first name + last name",
  "age": "age range e.g. 28-38",
  "role": "specific job title(s)",
  "company_size": "e.g. 10-50 employees",
  "industry": "specific industry vertical",
  "location": "primary geographic market",
  "goals": ["3-4 specific professional goals"],
  "pain_points": ["3-4 specific pain points related to this business's solution"],
  "motivations": ["3 emotional or career motivations"],
  "objections": ["3 real objections in first person quotes"],
  "buying_triggers": ["3-4 events that would make them buy now"],
  "preferred_channels": ["3-4 channels where they discover solutions"],
  "budget": "realistic budget range per month",
  "decision_process": "one sentence on buying process and typical timeline",
  "summary": "2-3 sentences on how to sell to this person — specific to this business's value prop"
}

Be specific and data-driven. Reference actual industry context. Avoid generic B2B clichés.`

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const persona = JSON.parse(match[0])
      return NextResponse.json({ persona })
    }
  } catch {
    // fall through to fallback
  }

  return NextResponse.json({ persona: FALLBACK_PERSONA })
}
