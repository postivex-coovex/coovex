import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GEO check (copied from audit/run/route.ts) ───────────────────────────────

interface GeoCheck {
  llms_txt: boolean; robots_txt: boolean; sitemap_xml: boolean
  structured_data: boolean; open_graph: boolean; canonical_url: boolean
  meta_description: boolean; twitter_card: boolean; https: boolean
  ai_discoverability: 'high' | 'medium' | 'low'
  geo_score: number; missing_geo: string[]
  ai_tasks: { title: string; desc: string; priority: 'critical' | 'high' | 'medium' }[]
  // Enhanced checks
  robots_ai_allowed: boolean
  llms_txt_quality: 'good' | 'basic' | 'missing'
  faq_content: boolean
}

const FETCH_OPTS = {
  signal: AbortSignal.timeout(8000),
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CooVex-GEO/1.0; +https://coovex.com)' },
}

async function checkGeoReadiness(url: string): Promise<GeoCheck> {
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

  const robots_txt    = robotsContent !== null
  const sitemap_xml   = sitemapContent !== null
  const llms_txt      = llmsContent !== null

  // Check robots.txt explicitly allows AI crawlers
  const AI_BOTS = ['gptbot', 'claudebot', 'perplexitybot', 'ccbot', 'anthropic-ai', 'google-extended']
  const robotsLower = (robotsContent ?? '').toLowerCase()
  const robots_ai_allowed = robots_txt && AI_BOTS.some(b => robotsLower.includes(b))

  // Check llms.txt content quality
  const llms_txt_quality: 'good' | 'basic' | 'missing' = !llms_txt
    ? 'missing'
    : (llmsContent ?? '').length > 400 && /^##\s/m.test(llmsContent ?? '')
      ? 'good'
      : 'basic'

  // FAQ detection: FAQ schema or common FAQ section patterns
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
    { v: llms_txt,         w: 20 },
    { v: structured_data,  w: 18 },
    { v: meta_description, w: 15 },
    { v: sitemap_xml,      w: 12 },
    { v: robots_txt,       w: 10 },
    { v: open_graph,       w: 10 },
    { v: https,            w: 8  },
    { v: canonical_url,    w: 4  },
    { v: twitter_card,     w: 3  },
  ]
  const totalWeight = weights.reduce((s, x) => s + x.w, 0)
  const earned      = weights.reduce((s, x) => s + (x.v ? x.w : 0), 0)
  const geo_score   = Math.round((earned / totalWeight) * 100)

  const missing_geo: string[] = []
  if (!llms_txt)         missing_geo.push('llms.txt — AI model guide file (Perplexity, ChatGPT, Gemini read this)')
  if (!structured_data)  missing_geo.push('JSON-LD structured data — enables rich results & AI knowledge graph')
  if (!meta_description) missing_geo.push('Meta description tags — used by AI for page summaries')
  if (!sitemap_xml)      missing_geo.push('sitemap.xml — page index for search & AI crawlers')
  if (!robots_txt)       missing_geo.push('robots.txt — crawler permission file')
  if (!open_graph)       missing_geo.push('Open Graph tags — AI/social sharing preview data')
  if (!https)            missing_geo.push('HTTPS — required for trust signals and AI indexing')
  if (!canonical_url)    missing_geo.push('Canonical URL tags — prevents duplicate content in AI indexes')
  if (!twitter_card)     missing_geo.push('Twitter/X card meta tags')

  const ai_tasks: GeoCheck['ai_tasks'] = []
  if (!llms_txt)         ai_tasks.push({ title: 'Create /llms.txt file', desc: 'Add an llms.txt file to your website root. Include: company name, description, services, contact, and key pages. AI models like Perplexity and ChatGPT read this to understand and recommend your business.', priority: 'critical' })
  if (!structured_data)  ai_tasks.push({ title: 'Add JSON-LD structured data', desc: 'Add <script type="application/ld+json"> with Organization or LocalBusiness schema to your homepage. This lets Google SGE, Bing AI, and other AI search engines understand your business.', priority: 'critical' })
  if (!meta_description) ai_tasks.push({ title: 'Add meta description to all pages', desc: 'Add <meta name="description" content="..."> (150–160 chars) to every page. AI search engines use this as the primary summary when recommending your site.', priority: 'high' })
  if (!sitemap_xml)      ai_tasks.push({ title: 'Generate and submit sitemap.xml', desc: 'Create an XML sitemap and submit it to Google Search Console, Bing Webmaster Tools. Submit URL: ' + origin + '/sitemap.xml', priority: 'high' })
  if (!robots_txt)       ai_tasks.push({ title: 'Add robots.txt', desc: 'Create /robots.txt with "User-agent: *\\nAllow: /" to explicitly allow AI crawlers. Add specific rules for GPTBot, CCBot, and PerplexityBot.', priority: 'high' })
  if (!open_graph)       ai_tasks.push({ title: 'Add Open Graph meta tags', desc: 'Add og:title, og:description, og:image, og:url to every page. Used by AI platforms for rich link previews and content understanding.', priority: 'medium' })
  if (!canonical_url)    ai_tasks.push({ title: 'Add canonical URL tags', desc: 'Add <link rel="canonical" href="..."> to every page to prevent duplicate content in AI and search engine indexes.', priority: 'medium' })

  const ai_discoverability: 'high' | 'medium' | 'low' = geo_score >= 65 ? 'high' : geo_score >= 35 ? 'medium' : 'low'

  return { llms_txt, robots_txt, sitemap_xml, structured_data, open_graph, canonical_url, meta_description, twitter_card, https, ai_discoverability, geo_score, missing_geo, ai_tasks, robots_ai_allowed, llms_txt_quality, faq_content }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()
    if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    const { data: business } = await supabase
      .from('businesses')
      .select('id, website_url')
      .eq('workspace_id', profile.current_workspace_id)
      .maybeSingle()
    if (!business?.website_url) return NextResponse.json({ error: 'No website URL — add one in Settings > Business' }, { status: 400 })

    let url = business.website_url
    if (!url.startsWith('http')) url = 'https://' + url

    const geo = await checkGeoReadiness(url)

    // Save as a geo-type audit (no credits deducted)
    const { error: insertError } = await supabase.from('audits').insert({
      business_id: business.id,
      type: 'geo',
      score: geo.geo_score,
      report_json: {
        url,
        geo,
        checked_at: new Date().toISOString(),
      },
    })

    if (insertError) {
      console.error('GEO scan insert error:', insertError)
      // Still return geo data so the UI can display it, but warn about save failure
      return NextResponse.json({ geo, url, saved: false, saveError: insertError.message })
    }

    return NextResponse.json({ geo, url, saved: true })
  } catch (error) {
    console.error('POST /api/geo/scan error:', error)
    return NextResponse.json({ error: 'Failed to run GEO scan' }, { status: 500 })
  }
}
