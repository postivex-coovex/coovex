import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/credits'

interface Slide {
  title: string
  content: string
  notes: string
}

const FALLBACK_DECK: Slide[] = [
  { title: 'Problem', content: 'Small and medium businesses lose $50K+/year to inefficient marketing, missed leads, and reactive customer management. They have no time to act on the data they collect.', notes: 'Open with a relatable pain point. Use a story if possible.' },
  { title: 'Solution', content: 'An AI Business Agent that works 24/7 to monitor competitors, score leads, respond to reviews, and surface daily action items — so business owners can focus on growth, not admin.', notes: 'Keep it crisp. The AI does the work for them.' },
  { title: 'Market Size', content: 'TAM: 33M SMBs in the US alone, spending $75B annually on marketing tools.\nSAM: 5M SMBs with $10K+ annual marketing budgets.\nSOM: 500K within reach via digital channels in Year 1.', notes: 'Cite sources if available. Show you\'ve done the math.' },
  { title: 'Product', content: '• AI Agent Inbox — daily signals, tasks, and alerts\n• Content Calendar — AI-drafted posts across channels\n• Lead Pipeline — AI scoring and routing\n• Competitor Tracker — real-time monitoring\n• Review Management — AI-drafted responses', notes: 'Demo the product live if possible. Screenshots work too.' },
  { title: 'Business Model', content: 'SaaS subscription: Starter $49/mo · Growth $149/mo · Scale $349/mo.\n14-day free trial, no card required.\nTarget: 1,000 paying customers by Month 12 = $1.5M ARR.', notes: 'Investors love simple, recurring models. Show the math.' },
  { title: 'Traction', content: '• 200+ free tool users in first 30 days\n• 40 onboarded beta users\n• $8K MRR at 3 months\n• 85% trial-to-paid conversion rate\n• NPS: 72', notes: 'Show any momentum. Even pre-launch validation counts.' },
  { title: 'Go-to-Market', content: 'Phase 1: SEO + free tools as lead magnets.\nPhase 2: LinkedIn content + cold outbound to agencies.\nPhase 3: Partnerships with accountants and business coaches.', notes: 'Be specific about channels and why they\'ll work for you.' },
  { title: 'Team', content: 'Highlight domain expertise, prior startup experience, and complementary skills. Advisory board with relevant industry connections.', notes: 'Investors invest in people first. Be confident and specific.' },
  { title: 'Financials', content: 'Use of funds: 60% product/engineering, 25% sales & marketing, 15% operations.\nRunway: 18 months.\nBreak-even at 350 paying customers.', notes: 'Have a detailed model ready. This slide is the summary.' },
  { title: 'The Ask', content: 'Seeking seed funding. Looking for investors who bring SaaS GTM expertise and SMB distribution networks beyond capital.', notes: 'Be clear and confident. Know your numbers cold.' },
]

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const raise_amount: string = body.raise_amount ?? ''
  const valuation: string = body.valuation ?? ''

  // ── resolve workspace ────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()

  const wsId = profile?.current_workspace_id
  if (!wsId) return NextResponse.json({ slides: FALLBACK_DECK })

  const credit = await deductCredits(wsId, 'pitch_deck', 'Pitch Deck generation')
  if (!credit.ok) return NextResponse.json({ error: credit.error }, { status: 402 })

  // ── fetch business data in parallel ─────────────────────────────────────────
  const [bizRes, leadsRes, dealsRes, competitorsRes, goalsRes] = await Promise.all([
    supabase.from('businesses')
      .select('name, industry, target_customer, country, health_score, integrations')
      .eq('workspace_id', wsId).maybeSingle(),
    supabase.from('leads')
      .select('id, status', { count: 'exact', head: false })
      .eq('workspace_id', wsId),
    supabase.from('deals')
      .select('stage, value')
      .eq('workspace_id', wsId).limit(50),
    supabase.from('competitors')
      .select('name, status')
      .eq('workspace_id', wsId).limit(5),
    supabase.from('goals')
      .select('title, status')
      .eq('workspace_id', wsId).limit(4),
  ])

  const biz = bizRes.data
  const leads = leadsRes.data ?? []
  const deals = dealsRes.data ?? []
  const competitors = competitorsRes.data ?? []
  const goals = goalsRes.data ?? []

  const wm = (biz?.integrations as Record<string, unknown> | null)?.__website_metrics as Record<string, unknown> | undefined

  const wonDeals = deals.filter(d => d.stage === 'won')
  const openDeals = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost')
  const pipelineValue = openDeals.reduce((s, d) => s + Number(d.value ?? 0), 0)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key') {
    return NextResponse.json({ slides: FALLBACK_DECK }, { headers: { 'X-Credits-Remaining': String(credit.balance) } })
  }

  const prompt = `You are a pitch deck expert with Y Combinator and top-tier VC experience. Create a compelling 10-slide investor pitch deck. Return ONLY a valid JSON array — no markdown, no explanations.

BUSINESS PROFILE:
- Name: ${biz?.name || 'Startup'}
- Industry: ${biz?.industry || 'Technology'}
- Target customer: ${biz?.target_customer || 'SMBs'}
- Country: ${biz?.country || 'Unknown'}
- Health score: ${biz?.health_score ?? 'N/A'}/100

TRACTION DATA:
- Total leads: ${leads.length}
- Won deals: ${wonDeals.length}
- Open pipeline: $${pipelineValue.toLocaleString()} across ${openDeals.length} deals
- MRR: $${wm?.mrr ?? 'N/A'}
- Paying customers: ${wm?.paying_customers ?? 'N/A'}
- Monthly visitors: ${wm?.monthly_visitors ?? 'N/A'}

COMPETITORS:
${competitors.length > 0 ? competitors.map(c => `- ${c.name}`).join('\n') : '- None tracked yet'}

GOALS:
${goals.length > 0 ? goals.map(g => `- ${g.title} (${g.status})`).join('\n') : '- None set'}

${raise_amount ? `RAISE: ${raise_amount}` : ''}
${valuation ? `VALUATION: ${valuation}` : ''}

Return a JSON array of exactly 10 slides with this structure:
[
  {
    "title": "slide title",
    "content": "slide body — use bullet points with • for lists, or 2-3 short paragraphs. Include specific numbers where available.",
    "notes": "1-2 sentences of speaker talking points"
  }
]

Slides must cover in order: Problem, Solution, Market Size, Product, Business Model, Traction, Go-to-Market, Team, Financials, The Ask.
Use actual data from above. If data is zero or missing, present it as early-stage momentum rather than hiding it.`

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const match = text.match(/\[[\s\S]*\]/)
    if (match) {
      const slides = JSON.parse(match[0])
      return NextResponse.json({ slides }, { headers: { 'X-Credits-Remaining': String(credit.balance) } })
    }
  } catch {
    // fall through to fallback
  }

  return NextResponse.json({ slides: FALLBACK_DECK }, { headers: { 'X-Credits-Remaining': String(credit.balance) } })
}
