import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/credits'

const FALLBACK_SWOT = {
  strengths: [
    'Strong local brand recognition and customer loyalty',
    'Experienced team with deep industry expertise',
    'Diversified service offering reducing single-revenue dependency',
    'Established relationships with key suppliers and partners',
  ],
  weaknesses: [
    'Limited online presence and digital marketing capabilities',
    'Operational processes largely manual, reducing efficiency',
    'Narrow geographic reach limiting growth potential',
    'Customer acquisition cost higher than industry average',
  ],
  opportunities: [
    'Growing demand for AI-powered business automation tools',
    'Underserved SMB segment in current target market',
    'Partnership opportunities with complementary service providers',
    'Expansion into adjacent markets with existing capabilities',
  ],
  threats: [
    'Increasing competition from well-funded tech startups',
    'Economic uncertainty affecting SMB spending decisions',
    'Rapid technology changes requiring continuous adaptation',
    'Rising customer acquisition costs across digital channels',
  ],
  summary: 'Your business has a solid foundation with strong local reputation and an experienced team. The primary strategic opportunity is investing in digital capabilities to scale beyond your current geographic footprint. Focus on automating manual processes to improve margins before expanding aggressively.',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { context } = await req.json()

  // ── resolve workspace ────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()

  const wsId = profile?.current_workspace_id
  let creditBalance: number | undefined
  if (wsId) {
    const credit = await deductCredits(wsId, 'swot_analysis', 'SWOT Analysis')
    if (!credit.ok) return NextResponse.json({ error: credit.error }, { status: 402 })
    creditBalance = credit.balance
  }
  if (!wsId) return NextResponse.json({ swot: FALLBACK_SWOT })

  // ── fetch business data in parallel ─────────────────────────────────────────
  const [bizRes, leadsRes, dealsRes, competitorsRes, goalsRes] = await Promise.all([
    supabase.from('businesses')
      .select('name, industry, target_customer, country, health_score, integrations')
      .eq('workspace_id', wsId).maybeSingle(),
    supabase.from('leads')
      .select('id, status', { count: 'exact', head: false })
      .eq('workspace_id', wsId),
    supabase.from('deals')
      .select('id, stage, value', { count: 'exact', head: false })
      .eq('workspace_id', wsId),
    supabase.from('competitors')
      .select('name, status, notes')
      .eq('workspace_id', wsId).limit(6),
    supabase.from('goals')
      .select('title, status, target_value, current_value')
      .eq('workspace_id', wsId).limit(5),
  ])

  const biz = bizRes.data
  const leads = leadsRes.data ?? []
  const deals = dealsRes.data ?? []
  const competitors = competitorsRes.data ?? []
  const goals = goalsRes.data ?? []

  // ── extract website metrics from integrations JSONB ──────────────────────────
  const wm = (biz?.integrations as Record<string, unknown> | null)?.__website_metrics as Record<string, unknown> | undefined

  // ── summarise data ───────────────────────────────────────────────────────────
  const totalLeads = leads.length
  const hotLeads = leads.filter(l => l.status === 'hot' || l.status === 'qualified').length
  const openDeals = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost')
  const openPipelineValue = openDeals.reduce((s, d) => s + Number(d.value ?? 0), 0)
  const wonDeals = deals.filter(d => d.stage === 'won').length

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key') {
    return NextResponse.json({ swot: FALLBACK_SWOT }, { headers: { 'X-Credits-Remaining': String(creditBalance) } })
  }

  const prompt = `You are a senior business strategist. Perform a SWOT analysis for this business. Return ONLY valid JSON — no markdown, no explanations.

BUSINESS PROFILE:
- Name: ${biz?.name || 'Unknown Business'}
- Industry: ${biz?.industry || 'Business Services'}
- Target customer: ${biz?.target_customer || 'SMBs'}
- Country: ${biz?.country || 'Unknown'}
- Health score: ${biz?.health_score ?? 'N/A'}/100

PIPELINE & LEADS:
- Total leads: ${totalLeads} (${hotLeads} hot/qualified)
- Open deals: ${openDeals.length} worth $${openPipelineValue.toLocaleString()}
- Won deals (all time): ${wonDeals}

COMPETITORS TRACKED:
${competitors.length > 0 ? competitors.map(c => `- ${c.name} (${c.status ?? 'tracked'})${c.notes ? `: ${c.notes}` : ''}`).join('\n') : '- None tracked'}

GOALS:
${goals.length > 0 ? goals.map(g => `- ${g.title} (${g.status}): ${g.current_value ?? 0}/${g.target_value ?? '?'}`).join('\n') : '- None set'}

${wm ? `WEBSITE METRICS:
- MRR: $${wm.mrr ?? 'N/A'}
- Paying customers: ${wm.paying_customers ?? 'N/A'}
- Monthly visitors: ${wm.monthly_visitors ?? 'N/A'}
- Churn rate: ${wm.churn_rate ?? 'N/A'}%` : ''}

${context ? `OWNER CONTEXT: ${context}` : ''}

Return JSON:
{
  "strengths": ["4-5 specific bullet points based on the actual data above"],
  "weaknesses": ["4-5 specific bullet points — honest about real gaps"],
  "opportunities": ["4-5 actionable opportunities given their industry and pipeline"],
  "threats": ["4-5 real threats based on competitors and market context"],
  "summary": "2-3 sentence strategic summary referencing actual numbers and the single most important action"
}

Be specific and data-driven. Reference actual numbers. Avoid generic business advice.`

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
      const swot = JSON.parse(match[0])
      return NextResponse.json({ swot }, { headers: { 'X-Credits-Remaining': String(creditBalance) } })
    }
  } catch {
    // fall through to fallback
  }

  return NextResponse.json({ swot: FALLBACK_SWOT }, { headers: { 'X-Credits-Remaining': String(creditBalance) } })
}
