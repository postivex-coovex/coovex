import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI, DynamicRetrievalMode } from '@google/generative-ai'
import { deductCredits } from '@/lib/credits'
import { logActivity } from '@/lib/activity-log'

export const maxDuration = 60

export type { GeoIntelligence } from '@/types/geo'
import type { GeoIntelligence } from '@/types/geo'

// ── Gemini Search Grounded Visibility Check ─────────────────────────────────

async function runGeminiVisibilityCheck(
  businessName: string,
  industry: string | null,
  promptExamples: GeoIntelligence['prompt_examples'],
  log: (msg: string) => void
): Promise<GeoIntelligence['actual_ai_visibility']> {
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    log('⏭️ Gemini API key not set — skipping live visibility check')
    return null
  }

  log('🔍 Checking real AI search visibility with Gemini Search...')
  try {
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

    // Pick 3 representative prompts: high-likelihood > discovery/best-of > comparison
    const high = promptExamples.filter(p => p.likelihood === 'high')
    const disc = promptExamples.filter(p => p.category === 'discovery' || p.category === 'best-of')
    const comp = promptExamples.filter(p => p.category === 'comparison')
    const pool = [
      ...(high.length ? [high[0]] : []),
      ...(disc.length ? [disc[0]] : []),
      ...(comp.length ? [comp[0]] : []),
    ]
    const testPrompts = [...new Set(pool.map(p => p.prompt))].slice(0, 3)
    if (testPrompts.length === 0) testPrompts.push(`best ${industry || 'business'} tools`)

    type VisCheck = NonNullable<GeoIntelligence['actual_ai_visibility']>['checks'][number]
    const checks: VisCheck[] = []

    for (const query of testPrompts) {
      log(`🔎 Searching: "${query.length > 60 ? query.slice(0, 60) + '…' : query}"`)
      try {
        const result = await model.generateContent(query)
        const text = result.response.text()
        const meta = result.response.candidates?.[0]?.groundingMetadata
        const sources = (meta?.groundingChunks ?? []).map(c => c.web?.uri ?? '').filter(Boolean)
        const found = text.toLowerCase().includes(businessName.toLowerCase())
        checks.push({
          query,
          ai: 'Gemini',
          found,
          response_snippet: text.slice(0, 500),
          sources: sources.slice(0, 5),
          search_queries: meta?.webSearchQueries ?? [],
        })
      } catch (e) {
        checks.push({ query, ai: 'Gemini', found: false, response_snippet: 'Search unavailable', sources: [], search_queries: [] })
        log(`⚠️ Search failed: ${e instanceof Error ? e.message : 'error'}`)
      }
    }

    const foundCount = checks.filter(c => c.found).length
    log(`✅ Visibility check — mentioned in ${foundCount}/${checks.length} AI searches`)
    return {
      checks,
      visibility_rate: checks.length > 0 ? Math.round((foundCount / checks.length) * 100) : 0,
      checked_at: new Date().toISOString(),
    }
  } catch (e) {
    log(`⚠️ Gemini visibility check skipped — ${e instanceof Error ? e.message : 'error'}`)
    return null
  }
}

// ── Streaming POST ──────────────────────────────────────────────────────────

export async function POST() {
  const encoder = new TextEncoder()
  const sseHeaders = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  } as const

  // Helper: return a single-event error stream
  const sseError = (msg: string) => new Response(
    new ReadableStream({ start(c) { c.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', msg })}\n\n`)); c.close() } }),
    { headers: sseHeaders }
  )

  // ── Pre-flight: auth, workspace, business ────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return sseError('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  if (!profile?.current_workspace_id) return sseError('No workspace found')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, website_url, industry, description, target_customer, website_intel')
    .eq('workspace_id', profile.current_workspace_id)
    .maybeSingle()
  if (!business) return sseError('No business found')

  const service = createServiceClient()

  // ── Cache check ──────────────────────────────────────────────────────────
  const { data: cached } = await service
    .from('agent_memory')
    .select('value_text, updated_at')
    .eq('business_id', business.id)
    .eq('key', 'geo_intelligence')
    .maybeSingle()

  if (cached?.value_text && cached.updated_at) {
    const ageMs = Date.now() - new Date(cached.updated_at).getTime()
    const isValid = ageMs < 7 * 24 * 60 * 60 * 1000
    try {
      const parsedCache = JSON.parse(cached.value_text) as GeoIntelligence

      // Validate required array fields — null arrays = corrupted; delete and regenerate
      const isCorrupted = typeof parsedCache !== 'object' || parsedCache === null
        || !Array.isArray(parsedCache.prompt_examples)
        || !Array.isArray(parsedCache.content_gaps)
        || !Array.isArray(parsedCache.topic_clusters)

      if (isCorrupted) {
        await service.from('agent_memory').delete()
          .eq('business_id', business.id).eq('key', 'geo_intelligence')
        // fall through to fresh generation below
      } else {
        const hasVisibility = 'actual_ai_visibility' in parsedCache

        if (isValid && hasVisibility) {
          return new Response(new ReadableStream({
            start(c) {
              c.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'log', msg: '✅ Returning cached analysis (less than 7 days old)' })}\n\n`))
              c.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', intelligence: parsedCache })}\n\n`))
              c.close()
            },
          }), { headers: sseHeaders })
        }

        // Cache valid but missing visibility check — run Gemini only, no credit deduction
        if (isValid && !hasVisibility && process.env.GEMINI_API_KEY) {
          return new Response(new ReadableStream({
            async start(c) {
              const log = (msg: string) => c.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'log', msg })}\n\n`))
              try {
                log('✨ Adding live visibility check to existing analysis (no credits charged)...')
                const actual_ai_visibility = await runGeminiVisibilityCheck(
                  business.name, business.industry ?? null, parsedCache.prompt_examples, log
                )
                const updated: GeoIntelligence = { ...parsedCache, actual_ai_visibility }
                const nowStr = new Date().toISOString()
                await service.from('agent_memory')
                  .update({ value_text: JSON.stringify(updated), updated_at: nowStr })
                  .eq('business_id', business.id).eq('key', 'geo_intelligence')
                log('💾 Visibility data cached')
                c.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', intelligence: updated })}\n\n`))
              } catch (e) {
                c.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', msg: e instanceof Error ? e.message : 'Visibility check failed' })}\n\n`))
              } finally {
                c.close()
              }
            },
          }), { headers: sseHeaders })
        }
      }
    } catch {
      // Cache JSON is malformed — delete and fall through to regeneration
      await service.from('agent_memory').delete()
        .eq('business_id', business.id).eq('key', 'geo_intelligence')
    }
  }

  // ── Check API key ────────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return sseError('AI not configured on this server')

  // ── Deduct credits (only for full AI generation) ─────────────────────────
  const credit = await deductCredits(profile.current_workspace_id, 'review_response', 'GEO Intelligence Analysis')
  if (!credit.ok) return sseError(credit.error ?? 'Insufficient credits')

  // ── AI generation stream ─────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      const log = (msg: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'log', msg })}\n\n`))
      const done = (intelligence: GeoIntelligence) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', intelligence })}\n\n`))
      const error = (msg: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', msg })}\n\n`))

      try {
        log('🧠 Loading competitor and market context from agent memory...')
        const { data: bCtx } = await service
          .from('agent_memory')
          .select('value_text')
          .eq('business_id', business.id)
          .eq('key', 'business_context')
          .maybeSingle()
        let competitors: string[] = []
        try {
          if (bCtx?.value_text) {
            const ctx = JSON.parse(bCtx.value_text) as Record<string, unknown>
            competitors = (ctx.competitors as string[]) ?? []
          }
        } catch { /* ignore */ }

        const intel = business.website_intel as Record<string, unknown> | null
        const services: string[] = (intel?.services as string[]) ?? []
        const description = business.description || (intel?.description as string) || ''
        const targetCustomer = business.target_customer || (intel?.target_customer as string) || ''

        log('🤖 Connecting to Claude AI...')
        log('🎯 Generating target prompts for ChatGPT, Perplexity, Claude & Gemini...')

        const anthropic = new Anthropic({ apiKey })

        const logTimer1 = setTimeout(() => log('📊 Mapping topic clusters and coverage gaps...'), 4000)
        const logTimer2 = setTimeout(() => log('✍️ Identifying high-impact content gaps...'), 8000)
        const logTimer3 = setTimeout(() => log('🏷️ Computing entity recognition score...'), 12000)
        const logTimer4 = setTimeout(() => log('🗣️ Crafting your AI voice summary...'), 16000)

        const msg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: `Today's date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.

You are an expert in GEO (Generative Engine Optimization) — optimizing businesses to appear in AI assistant responses from ChatGPT, Perplexity, Claude, and Gemini.

GEO differs from SEO: you don't rank in Google results, you get MENTIONED and RECOMMENDED by AI assistants when users ask relevant questions. The key is entity clarity, structured content, and covering the right intents.

Analyze this business for GEO and return a JSON object (no markdown, just JSON):

Business: ${business.name}
Industry: ${business.industry || 'Unknown'}
Description: ${description || 'Not provided'}
Services: ${services.join(', ') || 'Not provided'}
Target Customer: ${targetCustomer || 'Not provided'}
Website: ${business.website_url || 'Not provided'}
Competitors: ${competitors.join(', ') || 'Unknown'}

Return exactly this JSON structure:
{
  "prompt_examples": [
    { "prompt": "...", "ai": "ChatGPT", "category": "discovery", "likelihood": "high" }
  ],
  "topic_clusters": [
    { "topic": "...", "subtopics": ["...", "..."], "coverage": "strong", "suggested_url": "/features/topic-name" }
  ],
  "content_gaps": [
    { "type": "comparison", "suggestion": "...", "impact": "high" }
  ],
  "entity_score": 72,
  "entity_notes": "...",
  "ai_voice_summary": "..."
}

Rules:
- prompt_examples: 12-15 SPECIFIC prompts. Cover ChatGPT, Perplexity, Claude, Gemini. Categories: discovery ("best X for Y"), comparison ("X vs Y"), how-to ("how to do X"), best-of ("top X tools"), brand (direct brand queries). likelihood: high/medium/low.
- topic_clusters: 5-8 topic areas. coverage: strong/weak/missing.
- content_gaps: 6-8 specific content pieces. Be very specific (not "write a blog" but "Write: [Business] vs [Competitor] for [target customer]"). impact: high/medium/low. type MUST be one of: comparison, faq, how-to, guide, integration-guide, use-case, competitive-positioning, brand-entity, case-study, listicle, landing.
- entity_score: 0-100. Score: clear name+type (20), specific services (20), target market clarity (15), location/contact (15), description quality (15), uniqueness (15).
- entity_notes: what AI knows, what's missing, what would improve recognizability (2-3 sentences).
- ai_voice_summary: The 2-3 sentence answer an AI assistant WOULD give when recommending this business. Write as if AI is speaking to a user.`,
          }],
        })

        clearTimeout(logTimer1)
        clearTimeout(logTimer2)
        clearTimeout(logTimer3)
        clearTimeout(logTimer4)

        log('⚙️ Parsing AI response...')
        const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) { error('AI returned invalid JSON — please try again'); controller.close(); return }

        let parsed: Omit<GeoIntelligence, 'generated_at' | 'actual_ai_visibility'>
        try {
          parsed = JSON.parse(match[0]) as Omit<GeoIntelligence, 'generated_at' | 'actual_ai_visibility'>
        } catch {
          error('AI response was too large and got cut off — please try again'); controller.close(); return
        }

        // Gemini search grounded visibility check
        const actual_ai_visibility = await runGeminiVisibilityCheck(
          business.name, business.industry ?? null, parsed.prompt_examples, log
        )

        const intelligence: GeoIntelligence = { ...parsed, generated_at: new Date().toISOString(), actual_ai_visibility }

        log('💾 Saving to agent memory (cached for 7 days)...')
        const nowStr = new Date().toISOString()
        const valueText = JSON.stringify(intelligence)
        const { data: existingMem } = await service
          .from('agent_memory').select('id').eq('business_id', business.id).eq('key', 'geo_intelligence').maybeSingle()
        if (existingMem) {
          await service.from('agent_memory').update({ value_text: valueText, updated_at: nowStr })
            .eq('business_id', business.id).eq('key', 'geo_intelligence')
        } else {
          await service.from('agent_memory').insert({ business_id: business.id, key: 'geo_intelligence', value_text: valueText, updated_at: nowStr })
        }

        log(`✅ Analysis complete — ${intelligence.prompt_examples.length} prompts · ${intelligence.topic_clusters.length} topics · ${intelligence.content_gaps.length} content gaps`)
        logActivity({ action: 'geo_intelligence', description: 'AI Intelligence Report generated', credits_used: 5, business_id: business.id }).catch(() => {})
        done(intelligence)
      } catch (e) {
        error(e instanceof Error ? e.message : 'Analysis failed')
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      ...sseHeaders,
      'X-Credits-Remaining': String(credit.balance),
    },
  })
}

// ── GET: return cached intelligence ────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ intelligence: null })

    const { data: profile } = await supabase
      .from('profiles').select('current_workspace_id').eq('id', user.id).single()
    if (!profile?.current_workspace_id) return NextResponse.json({ intelligence: null })

    const { data: business } = await supabase
      .from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    if (!business) return NextResponse.json({ intelligence: null })

    const service = createServiceClient()
    const { data } = await service
      .from('agent_memory')
      .select('value_text')
      .eq('business_id', business.id)
      .eq('key', 'geo_intelligence')
      .maybeSingle()

    let intelligence: GeoIntelligence | null = null
    if (data?.value_text) {
      try {
        const parsed = JSON.parse(data.value_text) as GeoIntelligence
        // Validate required fields — corrupted cache returns null so client shows empty state
        if (
          Array.isArray(parsed?.prompt_examples) &&
          Array.isArray(parsed?.topic_clusters) &&
          Array.isArray(parsed?.content_gaps) &&
          typeof parsed?.entity_score === 'number' &&
          typeof parsed?.ai_voice_summary === 'string'
        ) {
          intelligence = parsed
        }
      } catch { /* corrupted JSON — return null */ }
    }
    return NextResponse.json({ intelligence })
  } catch {
    return NextResponse.json({ intelligence: null })
  }
}
