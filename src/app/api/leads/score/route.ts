import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { emitEvent, runOrchestration } from '@/lib/agent/orchestration'

function mockScore(lead: Record<string, unknown>): number {
  let score = 30
  if (lead.email) score += 10
  if (lead.phone) score += 10
  if (lead.company) score += 10
  if (lead.job_title) {
    const title = String(lead.job_title).toLowerCase()
    if (['ceo', 'cto', 'coo', 'founder', 'owner', 'director', 'vp', 'head'].some(t => title.includes(t))) score += 20
    else if (['manager', 'lead', 'senior'].some(t => title.includes(t))) score += 10
  }
  if (lead.notes) score += 5
  if (lead.stage === 'qualified') score += 10
  if (lead.stage === 'proposal' || lead.stage === 'proposal_sent') score += 15
  if (lead.stage === 'won') score = 100
  return Math.min(score, 99)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lead_id } = await req.json()
  if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

  // Verify lead belongs to this user's business
  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = await supabase.from('businesses').select('id, name, industry, website_intel').eq('workspace_id', profile?.current_workspace_id).maybeSingle()
  if (!business) return NextResponse.json({ error: 'No business found' }, { status: 400 })

  const { data: lead } = await supabase.from('leads').select('*').eq('id', lead_id).eq('business_id', business.id).single()
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const { data: activities } = await supabase
    .from('lead_activities')
    .select('activity_type, created_at')
    .eq('lead_id', lead_id)
    .order('created_at', { ascending: false })
    .limit(10)

  let score: number
  let reasoning: string

  if (!process.env.ANTHROPIC_API_KEY) {
    score = mockScore(lead)
    reasoning = `Score based on: profile completeness (${lead.email ? '+email' : ''} ${lead.phone ? '+phone' : ''} ${lead.company ? '+company' : ''}), job title seniority, stage, and activity.`
  } else {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const intel = (business as any).website_intel as Record<string, unknown> | null
    const intelContext = intel ? `
Business intel (from website):
- Services: ${(intel.services as string[] | undefined)?.join(', ') || 'unknown'}
- Target market: ${intel.target_market || 'unknown'}
- Pricing model: ${intel.pricing_model || 'unknown'}
- USP: ${intel.unique_value_proposition || 'unknown'}` : ''

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Score this lead for a ${business.industry} business (${business.name}) on a scale of 0-100.
${intelContext}

Lead profile:
- Name: ${lead.name}
- Company: ${lead.company || 'unknown'}
- Job title: ${lead.job_title || 'unknown'}
- Email: ${lead.email ? 'provided' : 'missing'}
- Phone: ${lead.phone ? 'provided' : 'missing'}
- Stage: ${lead.stage}
- Notes: ${lead.notes || 'none'}
- Activities: ${(activities || []).map((a: Record<string, unknown>) => a.activity_type).join(', ') || 'none'}

Consider: does this lead's company/title match the target market and services? Score higher if strong alignment.
Return ONLY a JSON object: {"score": 0-100, "reasoning": "one sentence explanation"}
No markdown, no extra text.`
      }]
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'
    try {
      const parsed = JSON.parse(text)
      score = Math.min(100, Math.max(0, Number(parsed.score) || mockScore(lead)))
      reasoning = parsed.reasoning || ''
    } catch {
      score = mockScore(lead)
      reasoning = 'Score calculated from profile completeness and stage.'
    }
  }

  const oldScore = Number((lead as Record<string, unknown>).score ?? (lead as Record<string, unknown>).lead_score ?? 0)

  // Update the lead score
  await supabase.from('leads').update({ lead_score: score }).eq('id', lead_id)

  // Log score_change activity
  await supabase.from('lead_activities').insert({
    lead_id,
    activity_type: 'score_change',
    data_json: { score, reasoning, scored_by: 'ai' },
  })

  // Emit orchestration events based on score change
  const workspaceId = profile?.current_workspace_id ?? ''
  if (workspaceId) {
    const leadData = {
      name: String((lead as Record<string, unknown>).name ?? 'Lead'),
      score,
      old_score: oldScore,
      stage: String((lead as Record<string, unknown>).stage ?? 'new'),
      company: (lead as Record<string, unknown>).company ?? null,
    }
    if (score >= 70 && oldScore < 70) {
      // Crossed the hot threshold
      await emitEvent(workspaceId, 'lead.score_high', 'lead', lead_id, leadData)
    } else if (score < oldScore - 15) {
      // Significant drop
      await emitEvent(workspaceId, 'lead.score_drop', 'lead', lead_id, leadData)
    }
    // Process events immediately (fire-and-forget)
    runOrchestration(workspaceId).catch(() => {})
  }

  return NextResponse.json({ score, reasoning })
}
