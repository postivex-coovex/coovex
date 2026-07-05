import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const claude = new Anthropic()

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const marketTypes: string[] = body.marketTypes?.length ? body.marketTypes : ['international']
  const reset: boolean = body.reset ?? false
  const localLocation: string = body.localLocation || ''
  const productService: string = body.productService || ''
  const businessWebsite: string = body.businessWebsite || ''
  const correctionNote: string = body.correctionNote || ''

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('*').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  // Delete all existing competitors + their data if reset requested
  if (reset) {
    await supabase.from('competitors').delete().eq('business_id', business.id)
  }

  // Save market type preferences + correction note to business
  const updateFields: Record<string, unknown> = { competitor_market_types: marketTypes }
  if (correctionNote) updateFields.competitor_correction_note = correctionNote
  await supabase.from('businesses').update(updateFields).eq('id', business.id)

  // Use saved correction note if not provided in this request
  const effectiveCorrectionNote = correctionNote || (business as Record<string, unknown>).competitor_correction_note as string || ''

  // Get audit data for context
  const { data: latestAudit } = await supabase
    .from('audits')
    .select('summary, score')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Get remaining competitors after potential delete
  const { data: existing } = await supabase
    .from('competitors')
    .select('name')
    .eq('business_id', business.id)

  const existingNames = (existing ?? []).map(c => c.name.toLowerCase())

  // If already has 6+ (no reset), return them
  if (!reset && existingNames.length >= 6) {
    const { data: existingAll } = await supabase
      .from('competitors')
      .select('*')
      .eq('business_id', business.id)
      .order('last_scanned_at', { ascending: false })
    const seen = new Set<string>()
    const deduped = (existingAll ?? []).filter(c => {
      const key = (c.name as string).toLowerCase().trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return NextResponse.json({ competitors: deduped, count: deduped.length, message: 'Competitors already tracked' })
  }

  // Calculate per-type count (always 6 total)
  const perType = Math.floor(6 / marketTypes.length)
  const remainder = 6 - perType * marketTypes.length

  const effectiveLocation = localLocation || business.location || business.city || ''
  const country = effectiveLocation.split(',').pop()?.trim() || ''

  const marketInstructions = marketTypes.map((m, idx) => {
    const count = perType + (idx === marketTypes.length - 1 ? remainder : 0)
    if (m === 'local') {
      const area = effectiveLocation || 'the business location'
      return `LOCAL (exactly ${count} competitors): Real businesses that physically operate in or primarily serve ${area}. These MUST be local/regional brands actually present in that specific area — NOT global SaaS or international platforms. Think local agencies, local service providers, or small-to-mid businesses in ${area}.`
    }
    if (m === 'regional') {
      return `REGIONAL (exactly ${count} competitors): National brands or regional chains operating in ${country || 'the same country'}. These serve the national market but are not global giants.`
    }
    return `INTERNATIONAL (exactly ${count} competitors): Global industry leaders, international SaaS platforms, or worldwide brands in ${business.industry || 'this industry'}. These are the big global players.`
  }).join('\n')

  const prompt = `You are a competitive intelligence expert. Find REAL, existing businesses that compete with the given business.

CRITICAL RULES:
1. Return ONLY real, verifiable businesses that actually exist — no invented names like "Acme Corp" or "Growth Co"
2. Use real company websites (verify they are plausible real URLs)
3. All numeric metrics (google_rating, google_review_count, intelligence_score) are YOUR BEST ESTIMATE based on public knowledge — mark them as estimates, not verified facts
4. For local competitors: only businesses physically present in the specified location
5. For international: only globally recognised brands in this industry
${effectiveCorrectionNote ? `6. ⚠️ USER CORRECTION (HIGHEST PRIORITY): The previous analysis was wrong. The user says: "${effectiveCorrectionNote}" — you MUST strictly follow this correction when finding competitors.` : ''}

BUSINESS TO FIND COMPETITORS FOR:
- Name: ${business.name}
- Industry: ${business.industry || 'Not specified'}
- Website: ${businessWebsite || business.website_url || 'Not specified'}
- Location: ${business.location || business.city || 'Not specified'}
- Product/Service: ${productService || business.description || 'Not specified'}
- Description: ${business.description || 'Not specified'}
${latestAudit ? `- Audit Score: ${latestAudit.score}/100\n- Summary: ${latestAudit.summary || 'N/A'}` : ''}
${effectiveCorrectionNote ? `\nUSER'S CORRECTION NOTE (follow strictly): ${effectiveCorrectionNote}` : ''}

MARKET TYPES TO FIND:
${marketInstructions}

EXCLUDE (already tracked): ${existingNames.length ? existingNames.join(', ') : 'none'}

For each competitor set "market_type" to exactly "local", "regional", or "international".
Set "intelligence_score" as your estimate of their overall digital strength (0-100).
Set "threat_level" as "high", "medium", or "low" based on how directly they compete.

Respond ONLY with a valid JSON array (${6} items total):
[
  {
    "name": "Real Company Name",
    "website_url": "https://realcompany.com",
    "market_type": "local",
    "google_rating": 4.2,
    "google_review_count": 127,
    "pricing_tier": "mid",
    "services_offered": ["Service 1", "Service 2", "Service 3"],
    "unique_selling_points": ["Strength 1", "Strength 2"],
    "weaknesses": ["Weakness 1", "Weakness 2"],
    "linkedin_url": "https://linkedin.com/company/example",
    "intelligence_score": 72,
    "threat_level": "medium",
    "ai_summary": "Two sentence summary of why they compete with ${business.name} and their key differentiator.",
    "top_keywords": ["keyword 1", "keyword 2", "keyword 3"],
    "target_audience": "Who they target"
  }
]`

  try {
    const response = await claude.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return NextResponse.json({ error: 'AI response parse failed' }, { status: 500 })

    const discovered: Array<Record<string, unknown>> = JSON.parse(jsonMatch[0])

    const inserts = discovered.map(c => ({
      business_id:           business.id,
      name:                  c.name,
      website:               c.website_url || null,
      linkedin_url:          c.linkedin_url || null,
      auto_discovered:       true,
      market_type:           c.market_type || 'international',
      google_rating:         c.google_rating || null,
      google_review_count:   c.google_review_count || 0,
      pricing_tier:          c.pricing_tier || null,
      services_offered:      c.services_offered || [],
      unique_selling_points: c.unique_selling_points || [],
      weaknesses:            c.weaknesses || [],
      intelligence_score:    c.intelligence_score || 0,
      threat_level:          c.threat_level || 'unknown',
      ai_summary:            c.ai_summary || null,
      top_keywords:          c.top_keywords || [],
      target_audience:       c.target_audience || null,
      crawl_status:          'done',
      last_scanned_at:       new Date().toISOString(),
    }))

    const safeInserts = inserts.filter(
      c => !existingNames.includes((c.name as string).toLowerCase().trim())
    )
    if (safeInserts.length === 0) {
      return NextResponse.json({ competitors: [], count: 0, message: 'All suggested competitors already tracked' })
    }

    const { data: inserted, error } = await supabase
      .from('competitors')
      .insert(safeInserts)
      .select()

    if (error) {
      console.error('Competitor insert error:', error)
      throw new Error(`DB insert failed: ${error.message} (code: ${error.code})`)
    }

    // Save initial snapshots
    if (inserted && inserted.length > 0) {
      try {
        const today = new Date().toISOString().split('T')[0]
        await supabase.from('competitor_snapshots').upsert(
          inserted.map(c => ({
            business_id:        business.id,
            competitor_id:      c.id,
            intelligence_score: c.intelligence_score || 0,
            threat_level:       c.threat_level,
            google_rating:      c.google_rating ?? null,
            recorded_date:      today,
          })),
          { onConflict: 'competitor_id,recorded_date' }
        )
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
    }

    return NextResponse.json({ competitors: inserted, count: inserted?.length ?? 0 })
  } catch (err) {
    console.error('Competitor discover error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
