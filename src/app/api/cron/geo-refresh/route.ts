import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import Anthropic from '@anthropic-ai/sdk'

// VPS cron — runs daily at 3:00 AM UTC
// 0 3 * * * curl -s -X POST https://app.coovex.com/api/cron/geo-refresh \
//   -H "Authorization: Bearer $CRON_SECRET" > /dev/null

export const maxDuration = 300

const FETCH_OPTS = {
  signal: AbortSignal.timeout(8000),
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CooVex-GEO/1.0; +https://coovex.com)' },
}

const AI_BOTS = ['gptbot', 'claudebot', 'perplexitybot', 'ccbot', 'anthropic-ai', 'google-extended']

async function checkGeoReadiness(url: string) {
  let origin: string
  try { origin = new URL(url).origin } catch { origin = url }

  let homepageHtml = ''
  try {
    const r = await fetch(url, FETCH_OPTS)
    if (r.ok) homepageHtml = await r.text()
  } catch { /* ignore */ }

  const fetchText = async (path: string): Promise<string | null> => {
    try {
      const r = await fetch(origin + path, { ...FETCH_OPTS, signal: AbortSignal.timeout(5000) })
      if (!r.ok || r.status >= 400) return null
      return await r.text()
    } catch { return null }
  }

  const [robotsContent, sitemapContent, llmsContent] = await Promise.all([
    fetchText('/robots.txt'),
    fetchText('/sitemap.xml'),
    fetchText('/llms.txt'),
  ])

  const robots_txt  = robotsContent !== null
  const sitemap_xml = sitemapContent !== null
  const llms_txt    = llmsContent !== null

  const robotsLower = (robotsContent ?? '').toLowerCase()
  const robots_ai_allowed = robots_txt && AI_BOTS.some(b => robotsLower.includes(b))

  const llms_txt_quality: 'good' | 'basic' | 'missing' = !llms_txt
    ? 'missing'
    : (llmsContent ?? '').length > 400 && /^##\s/m.test(llmsContent ?? '') ? 'good' : 'basic'

  const faq_content = /\"@type\"\s*:\s*\"FAQPage\"/i.test(homepageHtml)
    || /<[^>]+id=["']?faq/i.test(homepageHtml)
    || /frequently asked questions/i.test(homepageHtml)

  const structured_data  = /<script[^>]+type=["']application\/ld\+json["']/i.test(homepageHtml)
  const open_graph       = /<meta[^>]+property=["']og:/i.test(homepageHtml)
  const canonical_url    = /<link[^>]+rel=["']canonical["']/i.test(homepageHtml)
  const meta_description = /<meta[^>]+name=["']description["']/i.test(homepageHtml)
  const twitter_card     = /<meta[^>]+(name=["']twitter:|property=["']twitter:)/i.test(homepageHtml)
  const https            = url.startsWith('https://')

  const weights = [
    { v: llms_txt, w: 20 }, { v: structured_data, w: 18 }, { v: meta_description, w: 15 },
    { v: sitemap_xml, w: 12 }, { v: robots_txt, w: 10 }, { v: open_graph, w: 10 },
    { v: https, w: 8 }, { v: canonical_url, w: 4 }, { v: twitter_card, w: 3 },
  ]
  const totalWeight = weights.reduce((s, x) => s + x.w, 0)
  const earned      = weights.reduce((s, x) => s + (x.v ? x.w : 0), 0)
  const geo_score   = Math.round((earned / totalWeight) * 100)

  const missing_geo: string[] = []
  if (!llms_txt)         missing_geo.push('llms.txt')
  if (!structured_data)  missing_geo.push('JSON-LD structured data')
  if (!meta_description) missing_geo.push('Meta description')
  if (!sitemap_xml)      missing_geo.push('sitemap.xml')
  if (!robots_txt)       missing_geo.push('robots.txt')
  if (!open_graph)       missing_geo.push('Open Graph tags')
  if (!https)            missing_geo.push('HTTPS')
  if (!canonical_url)    missing_geo.push('Canonical URL tags')

  const ai_tasks: { title: string; desc: string; priority: 'critical' | 'high' | 'medium' }[] = []
  if (!llms_txt)        ai_tasks.push({ title: 'Create /llms.txt', desc: 'Add llms.txt to your website root so AI models can understand and recommend your business.', priority: 'critical' })
  if (!structured_data) ai_tasks.push({ title: 'Add JSON-LD structured data', desc: 'Add Organization schema to your homepage for AI search engines.', priority: 'critical' })
  if (!meta_description) ai_tasks.push({ title: 'Add meta descriptions', desc: 'Add meta description to every page — used by AI for summaries.', priority: 'high' })

  const ai_discoverability: 'high' | 'medium' | 'low' = geo_score >= 65 ? 'high' : geo_score >= 35 ? 'medium' : 'low'

  return { llms_txt, robots_txt, sitemap_xml, structured_data, open_graph, canonical_url, meta_description, twitter_card, https, ai_discoverability, geo_score, missing_geo, ai_tasks, robots_ai_allowed, llms_txt_quality, faq_content }
}

async function refreshGeoIntelligence(
  supabase: ReturnType<typeof createServiceClient>,
  business: { id: string; name: string; industry?: string | null; description?: string | null; target_customer?: string | null; website_url?: string | null; website_intel?: Record<string, unknown> | null },
  apiKey: string,
) {
  const competitors: string[] = []
  const { data: bCtx } = await supabase
    .from('agent_memory')
    .select('memory_value')
    .eq('business_id', business.id)
    .eq('memory_key', 'business_context')
    .maybeSingle()
  if (bCtx?.memory_value) {
    const ctx = bCtx.memory_value as Record<string, unknown>
    if (Array.isArray(ctx.competitors)) competitors.push(...ctx.competitors as string[])
  }

  const intel = business.website_intel ?? {}
  const services: string[] = (intel.services as string[]) ?? []
  const description = business.description || (intel.description as string) || ''
  const targetCustomer = business.target_customer || (intel.target_customer as string) || ''

  const anthropic = new Anthropic({ apiKey })
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `Today's date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.

You are a GEO (Generative Engine Optimization) expert. Analyze this business and return a JSON object (no markdown, just raw JSON).

Business: ${business.name}
Industry: ${business.industry || 'Unknown'}
Description: ${description || 'Not provided'}
Services: ${services.join(', ') || 'Not provided'}
Target Customer: ${targetCustomer || 'Not provided'}
Website: ${business.website_url || 'Not provided'}
Competitors: ${competitors.join(', ') || 'Unknown'}

Return exactly:
{
  "prompt_examples": [
    { "prompt": "...", "ai": "ChatGPT", "category": "discovery", "likelihood": "high" }
  ],
  "topic_clusters": [
    { "topic": "...", "subtopics": ["...", "..."], "coverage": "strong", "suggested_url": "/features/topic" }
  ],
  "content_gaps": [
    { "type": "comparison", "suggestion": "...", "impact": "high" }
  ],
  "entity_score": 72,
  "entity_notes": "...",
  "ai_voice_summary": "..."
}

Rules:
- prompt_examples: 12-15 specific prompts. Cover ChatGPT, Perplexity, Claude, Gemini. likelihood: high/medium/low.
- topic_clusters: 5-8 topics. coverage: strong/weak/missing. suggested_url: ideal page path.
- content_gaps: 6-8 items. type must be one of: comparison, faq, how-to, guide, integration-guide, use-case, competitive-positioning, brand-entity, case-study, listicle, landing.
- entity_score: 0-100.
- entity_notes: 2-3 sentences.
- ai_voice_summary: 2-3 sentences as if AI is speaking.`,
    }],
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI returned invalid JSON')

  const parsed = JSON.parse(match[0])
  const intelligence = { ...parsed, generated_at: new Date().toISOString() }

  const nowStr = new Date().toISOString()
  const valueText = JSON.stringify(intelligence)
  const { data: existing } = await supabase
    .from('agent_memory').select('id').eq('business_id', business.id).eq('key', 'geo_intelligence').maybeSingle()
  if (existing) {
    await supabase.from('agent_memory').update({ value_text: valueText, updated_at: nowStr })
      .eq('business_id', business.id).eq('key', 'geo_intelligence')
  } else {
    await supabase.from('agent_memory').insert({ business_id: business.id, key: 'geo_intelligence', value_text: valueText, updated_at: nowStr })
  }

  return intelligence
}

export async function POST(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const apiKey = process.env.ANTHROPIC_API_KEY

  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, website_url, industry, description, target_customer, website_intel')
    .not('website_url', 'is', null)
    .limit(200)

  if (!businesses?.length) return NextResponse.json({ ok: true, processed: 0 })

  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
  const results = { scanned: 0, intel_refreshed: 0, intel_skipped: 0, errors: 0 }

  for (const biz of businesses) {
    if (!biz.website_url) continue
    try {
      // 1. GEO scan — always runs daily
      let url = biz.website_url
      if (!url.startsWith('http')) url = 'https://' + url

      const geo = await checkGeoReadiness(url)

      await supabase.from('audits').insert({
        business_id: biz.id,
        type: 'geo',
        score: geo.geo_score,
        report_json: { url, geo, checked_at: new Date().toISOString() },
      })
      results.scanned++

      // 2. GEO Intelligence — only if cache missing or > 7 days old
      if (apiKey) {
        const { data: cached } = await supabase
          .from('agent_memory')
          .select('updated_at')
          .eq('business_id', biz.id)
          .eq('key', 'geo_intelligence')
          .maybeSingle()

        const cacheAge = cached?.updated_at
          ? Date.now() - new Date(cached.updated_at).getTime()
          : Infinity

        if (cacheAge > SEVEN_DAYS) {
          await refreshGeoIntelligence(supabase, biz, apiKey)
          results.intel_refreshed++
        } else {
          results.intel_skipped++
        }
      }
    } catch (e) {
      console.error(`GEO refresh error for business ${biz.id}:`, e)
      results.errors++
    }
  }

  return NextResponse.json({ ok: true, ...results })
}
