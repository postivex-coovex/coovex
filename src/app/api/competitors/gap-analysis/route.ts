import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const claude = new Anthropic()

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('*').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const [
    { data: competitors },
    { data: insights },
    { data: audit },
  ] = await Promise.all([
    supabase.from('competitors').select('*').eq('business_id', business.id).eq('crawl_status', 'done'),
    supabase.from('competitor_insights').select('*').eq('business_id', business.id).order('priority', { ascending: false }),
    supabase.from('audits').select('score, summary').eq('business_id', business.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  if (!competitors?.length) {
    return NextResponse.json({ summary: null, insights: [], competitors: [] })
  }

  // Group insights by type
  const gaps       = (insights ?? []).filter(i => i.insight_type === 'gap').slice(0, 5)
  const opps       = (insights ?? []).filter(i => i.insight_type === 'opportunity').slice(0, 5)
  const threats    = (insights ?? []).filter(i => i.insight_type === 'threat').slice(0, 5)
  const actions    = (insights ?? []).filter(i => i.insight_type === 'action').slice(0, 8)

  // Generate overall strategic summary if we have data
  let strategicSummary = ''
  if (competitors.length > 0 && insights && insights.length > 0) {
    try {
      const prompt = `Generate a concise strategic summary (3-4 sentences) for ${business.name} based on this competitive landscape:

Competitors tracked: ${competitors.map(c => `${c.name} (score: ${c.intelligence_score}, threat: ${c.threat_level})`).join(', ')}
Business health score: ${business.health_score || 'N/A'}/100
Audit score: ${audit?.score || 'N/A'}/100
Top gaps found: ${gaps.slice(0, 3).map(g => g.title).join('; ')}
Top opportunities: ${opps.slice(0, 3).map(o => o.title).join('; ')}

Write a sharp, actionable 3-sentence strategic summary. Focus on the most critical competitive position and what needs to happen.`

      const res = await claude.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      })
      strategicSummary = res.content[0].type === 'text' ? res.content[0].text : ''
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    summary: strategicSummary,
    gaps,
    opportunities: opps,
    threats,
    actions,
    competitors: competitors?.map(c => ({
      id: c.id,
      name: c.name,
      intelligence_score: c.intelligence_score,
      threat_level: c.threat_level,
      google_rating: c.google_rating,
      pricing_tier: c.pricing_tier,
    })),
  })
}
