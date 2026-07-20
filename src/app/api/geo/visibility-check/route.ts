import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { GoogleGenerativeAI, DynamicRetrievalMode } from '@google/generative-ai'

export const maxDuration = 60

export type { VisibilityResult } from '@/types/geo'
import type { VisibilityResult } from '@/types/geo'

// GET — return cached result
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ result: null })

    const { data: profile } = await supabase
      .from('profiles').select('current_workspace_id').eq('id', user.id).single()
    if (!profile?.current_workspace_id) return NextResponse.json({ result: null })

    const { data: business } = await supabase
      .from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    if (!business) return NextResponse.json({ result: null })

    const service = createServiceClient()
    const { data } = await service
      .from('agent_memory').select('value_text, updated_at')
      .eq('business_id', business.id).eq('key', 'geo_visibility_check').maybeSingle()

    if (!data?.value_text) return NextResponse.json({ result: null })

    // Cache valid for 24h
    const ageMs = Date.now() - new Date(data.updated_at).getTime()
    if (ageMs > 24 * 60 * 60 * 1000) return NextResponse.json({ result: null, stale: true })

    return NextResponse.json({ result: JSON.parse(data.value_text) as VisibilityResult })
  } catch {
    return NextResponse.json({ result: null })
  }
}

// POST — run Gemini visibility check (no credits, Gemini-only)
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('current_workspace_id').eq('id', user.id).single()
    if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    const { data: business } = await supabase
      .from('businesses')
      .select('id, name, industry, website_url')
      .eq('workspace_id', profile.current_workspace_id)
      .maybeSingle()
    if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) return NextResponse.json({ error: 'Gemini not configured' }, { status: 503 })

    const service = createServiceClient()

    // Try to get prompts from existing geo intelligence cache
    let testPrompts: string[] = []
    const { data: geoCache } = await service
      .from('agent_memory').select('value_text')
      .eq('business_id', business.id).eq('key', 'geo_intelligence').maybeSingle()

    if (geoCache?.value_text) {
      try {
        const parsed = JSON.parse(geoCache.value_text) as { prompt_examples?: { prompt: string; likelihood: string }[] }
        const high = parsed.prompt_examples?.filter(p => p.likelihood === 'high') ?? []
        testPrompts = high.slice(0, 3).map(p => p.prompt)
      } catch { /* ignore */ }
    }

    // Fallback: template-based prompts
    if (testPrompts.length === 0) {
      const biz = business.name
      const ind = business.industry || 'business'
      testPrompts = [
        `best ${ind} tools for small businesses`,
        `${biz} review — is it worth it?`,
        `alternatives to ${biz}`,
      ]
    }

    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      tools: [{
        googleSearchRetrieval: {
          dynamicRetrievalConfig: {
            mode: DynamicRetrievalMode.MODE_DYNAMIC,
            dynamicThreshold: 0,
          },
        },
      }],
    })

    const checks: VisibilityResult['checks'] = []
    for (const query of testPrompts.slice(0, 3)) {
      try {
        const result = await model.generateContent(query)
        const text = result.response.text()
        const meta = result.response.candidates?.[0]?.groundingMetadata
        const sources = (meta?.groundingChunks ?? []).map((c: { web?: { uri?: string } }) => c.web?.uri ?? '').filter(Boolean)
        checks.push({
          query, ai: 'Gemini',
          found: text.toLowerCase().includes(business.name.toLowerCase()),
          response_snippet: text.slice(0, 500),
          sources: sources.slice(0, 5),
          search_queries: meta?.webSearchQueries ?? [],
        })
      } catch {
        checks.push({ query, ai: 'Gemini', found: false, response_snippet: 'Search unavailable', sources: [], search_queries: [] })
      }
    }

    const foundCount = checks.filter(c => c.found).length
    const result: VisibilityResult = {
      checks,
      visibility_rate: checks.length ? Math.round((foundCount / checks.length) * 100) : 0,
      checked_at: new Date().toISOString(),
    }

    // Cache for 24h
    const nowStr = new Date().toISOString()
    const { data: existing } = await service
      .from('agent_memory').select('id')
      .eq('business_id', business.id).eq('key', 'geo_visibility_check').maybeSingle()
    if (existing) {
      await service.from('agent_memory')
        .update({ value_text: JSON.stringify(result), updated_at: nowStr })
        .eq('business_id', business.id).eq('key', 'geo_visibility_check')
    } else {
      await service.from('agent_memory')
        .insert({ business_id: business.id, key: 'geo_visibility_check', value_text: JSON.stringify(result), updated_at: nowStr })
    }

    // Also update geo_intelligence cache if it exists
    if (geoCache?.value_text) {
      try {
        const parsed = JSON.parse(geoCache.value_text) as Record<string, unknown>
        parsed.actual_ai_visibility = result
        await service.from('agent_memory')
          .update({ value_text: JSON.stringify(parsed), updated_at: nowStr })
          .eq('business_id', business.id).eq('key', 'geo_intelligence')
      } catch { /* ignore */ }
    }

    return NextResponse.json({ result })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
