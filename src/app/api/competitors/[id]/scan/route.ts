import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/credits'

const claude = new Anthropic()

async function fetchWebsiteText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CooVexBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    const html = await res.text()
    // Strip HTML tags, scripts, styles — get readable text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000) // Limit for Claude context
    return text
  } catch {
    return ''
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Get competitor + user's business
  const { data: competitor } = await supabase.from('competitors').select('*').eq('id', id).maybeSingle()
  if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()

  let creditBalance: number | undefined
  if (profile?.current_workspace_id) {
    const credit = await deductCredits(profile.current_workspace_id, 'competitor_analysis', 'Competitor scan')
    if (!credit.ok) return NextResponse.json({ error: credit.error }, { status: 402 })
    creditBalance = credit.balance
  }

  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('*').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  // Get user's audit for comparison context
  const { data: audit } = await supabase
    .from('audits')
    .select('summary, score, recommendations')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Skip if already scanned today (prevents duplicate credit usage on refresh)
  const today = new Date().toISOString().split('T')[0]
  if (competitor.last_scanned_at) {
    const lastDate = competitor.last_scanned_at.split('T')[0]
    if (lastDate === today && competitor.crawl_status === 'done') {
      // Already scanned today — return cached data without calling Claude
      return NextResponse.json({ competitor, insights_count: 0, cached: true })
    }
  }

  // Mark as scanning
  await supabase.from('competitors').update({ crawl_status: 'scanning' }).eq('id', id)

  // Crawl website if available
  let websiteText = ''
  const websiteUrl = competitor.website || competitor.website_url
  if (websiteUrl) {
    websiteText = await fetchWebsiteText(websiteUrl)
  }

  const prompt = `You are a competitive intelligence AI. Analyse this competitor against a user's business and provide deep insights.

USER'S BUSINESS:
- Name: ${business.name}
- Industry: ${business.industry || 'Unknown'}
- Location: ${business.location || business.city || 'Unknown'}
- Health Score: ${business.health_score || 'N/A'}/100
${audit ? `- Audit Summary: ${audit.summary || 'N/A'}
- Audit Score: ${audit.score}/100` : ''}
- Google Rating: ${business.google_rating || 'N/A'}

COMPETITOR BEING ANALYSED:
- Name: ${competitor.name}
- Website: ${websiteUrl || 'Not provided'}
- Current data: Rating ${competitor.google_rating || 'unknown'}, ${competitor.google_review_count || 0} reviews

COMPETITOR WEBSITE CONTENT (scraped):
${websiteText || 'Website not accessible or no URL provided.'}

Based on this analysis, provide a comprehensive intelligence report. Respond ONLY with valid JSON:
{
  "intelligence_score": <0-100 overall strength score>,
  "threat_level": "<low|medium|high>",
  "google_rating": <estimated rating 1.0-5.0 or null>,
  "google_review_count": <estimated count or 0>,
  "monthly_traffic": <estimated monthly visitors>,
  "domain_authority": <estimated 1-100>,
  "pricing_tier": "<budget|mid|premium>",
  "target_audience": "<who they target>",
  "services_offered": ["service 1", "service 2", "service 3", "service 4"],
  "unique_selling_points": ["USP 1", "USP 2", "USP 3"],
  "weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "top_keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"],
  "ai_summary": "<2-3 sentence summary of who they are and why they matter as a competitor>",
  "gap_analysis": [
    {
      "insight_type": "gap",
      "category": "<seo|social|content|pricing|service|reputation>",
      "title": "<specific gap title>",
      "body": "<detailed explanation of the gap and its impact>",
      "priority": <1-10>
    }
  ],
  "opportunities": [
    {
      "insight_type": "opportunity",
      "category": "<category>",
      "title": "<opportunity title>",
      "body": "<how to capitalize on competitor's weakness>",
      "priority": <1-10>
    }
  ],
  "threats": [
    {
      "insight_type": "threat",
      "category": "<category>",
      "title": "<threat title>",
      "body": "<specific threat this competitor poses>",
      "priority": <1-10>
    }
  ],
  "growth_actions": [
    {
      "insight_type": "action",
      "category": "<category>",
      "title": "<specific action to take>",
      "body": "<detailed steps to outcompete this competitor in this area>",
      "priority": <1-10>
    }
  ]
}`

  try {
    const response = await claude.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const analysis = JSON.parse(jsonMatch[0])

    // Update competitor record
    await supabase.from('competitors').update({
      intelligence_score:   analysis.intelligence_score,
      threat_level:         analysis.threat_level,
      google_rating:        analysis.google_rating,
      google_review_count:  analysis.google_review_count || 0,
      monthly_traffic:      analysis.monthly_traffic,
      domain_authority:     analysis.domain_authority,
      pricing_tier:         analysis.pricing_tier,
      target_audience:      analysis.target_audience,
      services_offered:     analysis.services_offered || [],
      unique_selling_points:analysis.unique_selling_points || [],
      weaknesses:           analysis.weaknesses || [],
      top_keywords:         analysis.top_keywords || [],
      ai_summary:           analysis.ai_summary,
      raw_website_text:     websiteText.slice(0, 2000),
      crawl_status:         'done',
      last_scanned_at:      new Date().toISOString(),
    }).eq('id', id)

    // Delete old insights for this competitor
    await supabase.from('competitor_insights').delete()
      .eq('competitor_id', id)
      .eq('business_id', business.id)

    // Insert new insights
    const allInsights = [
      ...(analysis.gap_analysis || []),
      ...(analysis.opportunities || []),
      ...(analysis.threats || []),
      ...(analysis.growth_actions || []),
    ].map((ins: Record<string, unknown>) => ({
      business_id:    business.id,
      competitor_id:  id,
      insight_type:   ins.insight_type,
      category:       ins.category,
      title:          ins.title,
      body:           ins.body,
      priority:       ins.priority || 0,
    }))

    if (allInsights.length > 0) {
      await supabase.from('competitor_insights').insert(allInsights)
    }

    // Save daily snapshot — try-catch so missing table never breaks the scan
    try {
      const today = new Date().toISOString().split('T')[0]
      await supabase.from('competitor_snapshots').upsert({
        business_id:        business.id,
        competitor_id:      id,
        intelligence_score: analysis.intelligence_score,
        threat_level:       analysis.threat_level,
        google_rating:      analysis.google_rating ?? null,
        recorded_date:      today,
      }, { onConflict: 'competitor_id,recorded_date' })
      if (business.health_score) {
        await supabase.from('business_snapshots').upsert({
          business_id:   business.id,
          health_score:  business.health_score,
          recorded_date: today,
        }, { onConflict: 'business_id,recorded_date' })
      }
    } catch {
      // Snapshot tables may not exist yet — ignore
    }

    // Fire an agent signal
    await supabase.from('agent_signals').insert({
      business_id:   business.id,
      type:          'insight',
      title:         `Competitor scan: ${competitor.name}`,
      body:          `Intelligence score: ${analysis.intelligence_score}/100 · Threat: ${analysis.threat_level} · Found ${allInsights.length} insights`,
      action_label:  'View Competitors',
      action_url:    '/competitors',
    })

    const { data: updated } = await supabase.from('competitors').select('*').eq('id', id).single()
    return NextResponse.json({ competitor: updated, insights_count: allInsights.length }, creditBalance !== undefined ? { headers: { 'X-Credits-Remaining': String(creditBalance) } } : undefined)
  } catch (err) {
    await supabase.from('competitors').update({ crawl_status: 'error' }).eq('id', id)
    console.error('Competitor scan error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
