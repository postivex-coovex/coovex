import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const claude = new Anthropic()

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('*').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const { data: competitors } = await supabase
    .from('competitors')
    .select('*')
    .eq('business_id', business.id)
    .in('crawl_status', ['done', 'scanning'])

  if (!competitors?.length) {
    return NextResponse.json({ error: 'No scanned competitors found' }, { status: 400 })
  }

  const { data: audit } = await supabase
    .from('audits')
    .select('score, summary')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let totalInsights = 0
  const allGeneratedInsights: Record<string, unknown>[] = []

  for (const competitor of competitors) {
    const prompt = `You are a competitive intelligence AI. Generate strategic insights comparing this competitor against the user's business.

USER'S BUSINESS:
- Name: ${business.name}
- Industry: ${business.industry || 'Unknown'}
- Location: ${business.location || business.city || 'Unknown'}
- Health Score: ${business.health_score || 'N/A'}/100
- Description: ${business.description || 'N/A'}
${audit ? `- Audit Score: ${audit.score}/100\n- Summary: ${audit.summary || 'N/A'}` : ''}

COMPETITOR:
- Name: ${competitor.name}
- Website: ${competitor.website || competitor.website_url || 'N/A'}
- Intelligence Score: ${competitor.intelligence_score}/100
- Threat Level: ${competitor.threat_level}
- Google Rating: ${competitor.google_rating || 'N/A'} (${competitor.google_review_count || 0} reviews)
- Pricing: ${competitor.pricing_tier || 'N/A'}
- Services: ${(competitor.services_offered || []).join(', ') || 'N/A'}
- USPs: ${(competitor.unique_selling_points || []).join(', ') || 'N/A'}
- Weaknesses: ${(competitor.weaknesses || []).join(', ') || 'N/A'}
- Target Audience: ${competitor.target_audience || 'N/A'}
- Summary: ${competitor.ai_summary || 'N/A'}

Generate competitive insights. Respond ONLY with valid JSON:
{
  "gap_analysis": [
    {"insight_type":"gap","category":"<seo|social|content|pricing|service|reputation>","title":"<gap title>","body":"<explanation>","priority":<1-10>},
    {"insight_type":"gap","category":"...","title":"...","body":"...","priority":<1-10>}
  ],
  "opportunities": [
    {"insight_type":"opportunity","category":"...","title":"...","body":"...","priority":<1-10>},
    {"insight_type":"opportunity","category":"...","title":"...","body":"...","priority":<1-10>}
  ],
  "threats": [
    {"insight_type":"threat","category":"...","title":"...","body":"...","priority":<1-10>}
  ],
  "growth_actions": [
    {"insight_type":"action","category":"...","title":"<specific action>","body":"<detailed steps>","priority":<1-10>},
    {"insight_type":"action","category":"...","title":"...","body":"...","priority":<1-10>}
  ]
}
Provide 2-3 items per category. Be specific and actionable.`

    try {
      const response = await claude.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) continue

      const analysis = JSON.parse(jsonMatch[0])

      const allInsights = [
        ...(analysis.gap_analysis   || []),
        ...(analysis.opportunities  || []),
        ...(analysis.threats        || []),
        ...(analysis.growth_actions || []),
      ].map((ins: Record<string, unknown>) => ({
        id:            crypto.randomUUID(),
        business_id:   business.id,
        competitor_id: competitor.id,
        insight_type:  ins.insight_type as string,
        category:      ins.category as string,
        title:         ins.title as string,
        body:          ins.body as string,
        priority:      (ins.priority as number) || 0,
      }))

      // Try to persist to DB (requires competitor_insights table migration)
      if (allInsights.length > 0) {
        try {
          await supabase.from('competitor_insights').delete()
            .eq('competitor_id', competitor.id)
            .eq('business_id', business.id)
          await supabase.from('competitor_insights').insert(allInsights)
        } catch { /* table may not exist yet — insights still returned in response */ }
        totalInsights += allInsights.length
        allGeneratedInsights.push(...allInsights)
      }
    } catch {
      // continue with next competitor
    }
  }

  return NextResponse.json({
    ok: true,
    total_insights: totalInsights,
    competitors_processed: competitors.length,
    insights: allGeneratedInsights,  // return directly so UI works even without DB
  })
}
