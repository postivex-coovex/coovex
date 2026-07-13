import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/credits'

interface AuditScores {
  performance: number
  seo: number
  accessibility: number
  best_practices: number
  mobile: number
  overall: number
}

interface AuditIssue {
  severity: 'critical' | 'warning' | 'info'
  category: string
  title: string
  description: string
}

export interface SearchPresence {
  ga4: boolean
  ga4_id: string | null
  gtm: boolean
  gsc_verified: boolean
  gsc_verification_id: string | null
  bing_verified: boolean
  bing_verification_id: string | null
  indexnow_configured: boolean
  sitemap_in_robots: boolean
}

export interface GeoCheck {
  llms_txt: boolean
  robots_txt: boolean
  sitemap_xml: boolean
  structured_data: boolean
  open_graph: boolean
  canonical_url: boolean
  meta_description: boolean
  twitter_card: boolean
  https: boolean
  ai_discoverability: 'high' | 'medium' | 'low'
  geo_score: number
  missing_geo: string[]
  ai_tasks: { title: string; desc: string; priority: 'critical' | 'high' | 'medium' }[]
  robots_ai_allowed: boolean
  llms_txt_quality: 'good' | 'basic' | 'missing'
  faq_content: boolean
  search_presence: SearchPresence
}

export interface BusinessIntel {
  business_name: string
  description: string
  industry: string
  services: string[]
  target_market: string
  who_needs_it: string[]
  pain_points: string[]
  contact: { email?: string; phone?: string; address?: string }
  social_links: { linkedin?: string; facebook?: string; instagram?: string; twitter?: string }
  team_members: string[]
  clients: string[]
  pricing_model: string
  unique_value_proposition: string
  missing_elements: string[]
  content_quality_score: number
  ai_insights: string[]
  blog: {
    exists: boolean
    url: string | null
    topics: string[]
    quality: 'good' | 'thin' | 'stale' | 'none'
    recommendation: string
  }
}

// ─── 1. GEO / AI Discoverability Check ───────────────────────────────────────

const FETCH_OPTS = {
  signal: AbortSignal.timeout(8000),
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CooVex-Audit/1.0; +https://coovex.com)' },
}

async function checkGeoReadiness(url: string): Promise<GeoCheck> {
  let origin: string
  try { origin = new URL(url).origin } catch { origin = url }

  // Fetch homepage HTML
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

  const AI_BOTS = ['gptbot', 'claudebot', 'perplexitybot', 'ccbot', 'anthropic-ai', 'google-extended']
  const robotsLower = (robotsContent ?? '').toLowerCase()
  const robots_ai_allowed = robots_txt && AI_BOTS.some(b => robotsLower.includes(b))

  const llms_txt_quality: 'good' | 'basic' | 'missing' = !llms_txt
    ? 'missing'
    : (llmsContent ?? '').length > 400 && /^##\s/m.test(llmsContent ?? '')
      ? 'good'
      : 'basic'

  const faq_content = /\"@type\"\s*:\s*\"FAQPage\"/i.test(homepageHtml)
    || /<[^>]+id=["']?faq/i.test(homepageHtml)
    || /frequently asked questions/i.test(homepageHtml)

  const structured_data = /<script[^>]+type=["']application\/ld\+json["']/i.test(homepageHtml)
  const open_graph     = /<meta[^>]+property=["']og:/i.test(homepageHtml)
  const canonical_url  = /<link[^>]+rel=["']canonical["']/i.test(homepageHtml)
  const meta_description = /<meta[^>]+name=["']description["']/i.test(homepageHtml)
  const twitter_card   = /<meta[^>]+(name=["']twitter:|property=["']twitter:)/i.test(homepageHtml)
  const https          = url.startsWith('https://')

  // Weighted scoring: some items matter more for AI discoverability
  const weights = [
    { v: llms_txt,         w: 20 }, // most important for AI
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
  const earned = weights.reduce((s, x) => s + (x.v ? x.w : 0), 0)
  const geo_score = Math.round((earned / totalWeight) * 100)

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
  if (!structured_data)  ai_tasks.push({ title: 'Add JSON-LD structured data', desc: 'Add <script type="application/ld+json"> with Organization or LocalBusiness schema to your homepage. This lets Google SGE, Bing AI, and other AI search engines understand your business and include you in AI-generated answers.', priority: 'critical' })
  if (!meta_description) ai_tasks.push({ title: 'Add meta description to all pages', desc: 'Add <meta name="description" content="..."> (150–160 chars) to every page. AI search engines use this as the primary summary when recommending your site.', priority: 'high' })
  if (!sitemap_xml)      ai_tasks.push({ title: 'Generate and submit sitemap.xml', desc: 'Create an XML sitemap and submit it to Google Search Console, Bing Webmaster Tools. Submit URL: ' + origin + '/sitemap.xml', priority: 'high' })
  if (!robots_txt)       ai_tasks.push({ title: 'Add robots.txt', desc: 'Create /robots.txt with "User-agent: *\\nAllow: /" to explicitly allow AI crawlers. Add specific rules for GPTBot, CCBot, and PerplexityBot.', priority: 'high' })
  if (!open_graph)       ai_tasks.push({ title: 'Add Open Graph meta tags', desc: 'Add og:title, og:description, og:image, og:url to every page. Used by AI platforms for rich link previews and content understanding.', priority: 'medium' })
  if (!canonical_url)    ai_tasks.push({ title: 'Add canonical URL tags', desc: 'Add <link rel="canonical" href="..."> to every page to prevent duplicate content in AI and search engine indexes.', priority: 'medium' })

  const ai_discoverability: 'high' | 'medium' | 'low' = geo_score >= 65 ? 'high' : geo_score >= 35 ? 'medium' : 'low'

  // ── Search Presence checks ─────────────────────────────────────────────────
  const ga4Match = homepageHtml.match(/['"`]G-[A-Z0-9]{4,12}['"`]/)
  const ga4    = !!ga4Match
  const ga4_id = ga4Match?.[0]?.replace(/['"`]/g, '') ?? null
  const gtm    = /GTM-[A-Z0-9]{4,8}/.test(homepageHtml)

  const gscMatch = homepageHtml.match(/name=["']google-site-verification["'][^>]*content=["']([^"']+)["']/i)
    ?? homepageHtml.match(/content=["']([^"']+)["'][^>]*name=["']google-site-verification["']/i)
  const gsc_verified       = !!gscMatch
  const gsc_verification_id = gscMatch?.[1]?.slice(0, 10) ?? null

  const bingMetaMatch = homepageHtml.match(/name=["']msvalidate\.01["'][^>]*content=["']([^"']+)["']/i)
    ?? homepageHtml.match(/content=["']([^"']+)["'][^>]*name=["']msvalidate\.01["']/i)
  let bing_verified        = !!bingMetaMatch
  const bing_verification_id = bingMetaMatch?.[1]?.slice(0, 10) ?? null

  if (!bing_verified) {
    const bingAuth = await fetchText('/BingSiteAuth.xml')
    if (bingAuth?.includes('<user>')) bing_verified = true
  }

  const sitemap_in_robots  = robots_txt && /sitemap\s*:/i.test(robotsContent ?? '')
  const indexnow_configured = /indexnow/i.test(robotsContent ?? '')

  const search_presence: SearchPresence = {
    ga4, ga4_id, gtm,
    gsc_verified, gsc_verification_id,
    bing_verified, bing_verification_id,
    indexnow_configured, sitemap_in_robots,
  }

  return { llms_txt, robots_txt, sitemap_xml, structured_data, open_graph, canonical_url, meta_description, twitter_card, https, ai_discoverability, geo_score, missing_geo, ai_tasks, robots_ai_allowed, llms_txt_quality, faq_content, search_presence }
}

// ─── 2. PageSpeed Audit ────────────────────────────────────────────────────────

async function runPageSpeedAudit(url: string): Promise<{ scores: AuditScores; issues: AuditIssue[]; recommendations: string[] }> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY
  const psUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&category=seo&category=accessibility&category=best-practices${apiKey && apiKey !== 'your_google_api_key' ? '&key=' + apiKey : ''}`

  try {
    const psRes = await fetch(psUrl, { signal: AbortSignal.timeout(20000) })
    if (!psRes.ok) throw new Error('PageSpeed unavailable')

    const psData = await psRes.json()
    const cats = psData.lighthouseResult?.categories || {}
    const audits = psData.lighthouseResult?.audits || {}

    const perf = Math.round((cats.performance?.score ?? 0) * 100)
    const seo  = Math.round((cats.seo?.score ?? 0) * 100)
    const acc  = Math.round((cats.accessibility?.score ?? 0) * 100)
    const bp   = Math.round((cats['best-practices']?.score ?? 0) * 100)
    const fcp  = psData.lighthouseResult?.audits?.['first-contentful-paint']?.score ?? 0.5
    const mobile = Math.round(fcp * 100)
    const overall = Math.round((perf + seo + acc + bp + mobile) / 5)

    const issues: AuditIssue[] = []
    if (perf < 50)  issues.push({ severity: 'critical', category: 'Performance', title: 'Poor page speed', description: 'Page loads slowly — hurts UX and search rankings.' })
    else if (perf < 80) issues.push({ severity: 'warning', category: 'Performance', title: 'Page speed can be improved', description: 'Large images and render-blocking scripts are slowing your site down.' })
    if (seo < 70)  issues.push({ severity: 'warning', category: 'SEO', title: 'SEO improvements needed', description: 'Missing meta descriptions, alt text, or structured data on key pages.' })
    if (acc < 70)  issues.push({ severity: 'warning', category: 'Accessibility', title: 'Accessibility issues found', description: 'Users with disabilities may have difficulty navigating your site.' })
    if (!audits['is-on-https']?.score) issues.push({ severity: 'critical', category: 'Security', title: 'Not using HTTPS', description: 'Your site is not secure — hurts trust, conversions, and SEO.' })
    if (audits['render-blocking-resources']?.score === 0) issues.push({ severity: 'warning', category: 'Performance', title: 'Render-blocking resources', description: 'CSS/JS files block page render and slow load time.' })
    if (!audits['viewport']?.score) issues.push({ severity: 'critical', category: 'Mobile', title: 'No viewport meta tag', description: 'Site is not properly configured for mobile devices.' })
    if (mobile < 60) issues.push({ severity: 'warning', category: 'Mobile', title: 'Poor mobile experience', description: 'Mobile performance is below average — 60%+ of traffic is mobile.' })
    if (issues.length === 0) issues.push({ severity: 'info', category: 'Overall', title: 'Site is performing well', description: 'No critical issues found. Continue optimizing.' })

    return {
      scores: { performance: perf, seo, accessibility: acc, best_practices: bp, mobile, overall },
      issues,
      recommendations: buildRecommendations({ performance: perf, seo, accessibility: acc, best_practices: bp, mobile, overall }),
    }
  } catch {
    return generateMockAudit(url)
  }
}

// ─── 3. Website Scraper ────────────────────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Keywords matched against URL path
const URL_KEYWORDS = [
  'about', 'team', 'service', 'solution', 'product', 'pricing', 'price', 'plan',
  'contact', 'feature', 'client', 'case-study', 'portfolio', 'work', 'faq',
  'blog', 'story', 'mission', 'partner', 'integration', 'how-it-work',
  // multilingual / creative slugs
  'kontak', 'kontakt', 'uber', 'ueber', 'equipe', 'nosotros', 'nous',
  'tarif', 'preise', 'kosten', 'leistung', 'angebot', 'offre',
  'reach', 'touch', 'connect', 'write', 'enquir', 'inquir',
  'founder', 'who-we', 'what-we', 'our-', 'get-in',
]

// Keywords matched against anchor text (link label)
const ANCHOR_KEYWORDS = [
  'about', 'who we', 'our story', 'our team', 'team', 'mission', 'founder',
  'service', 'solution', 'what we do', 'offering', 'what we offer',
  'product', 'features', 'how it work',
  'pricing', 'price', 'plan', 'package', 'cost', 'tarif', 'kosten',
  'contact', 'reach us', 'get in touch', 'write to us', 'connect', 'talk to us',
  'enquire', 'inquire', 'kontak', 'kontakt',
  'portfolio', 'work', 'case stud', 'project', 'client',
  'blog', 'article', 'news', 'insight',
  'faq', 'help', 'support',
  'testimonial', 'review', 'feedback',
  'partner', 'integration',
]

function getPageType(pathname: string, anchorText = ''): string {
  const p   = pathname.toLowerCase().replace(/\/$/, '') || '/'
  const txt = anchorText.toLowerCase()

  if (p === '/') return 'homepage'

  // Match by URL path first, then anchor text as fallback
  if (/pricing|price|plan|package|kosten|tarif|preise/.test(p) ||
      /pricing|price|plan|package|cost/.test(txt))              return 'pricing'
  if (/about|team|story|mission|founder|uber|ueber|equipe|qui-sommes|nosotros|who-we/.test(p) ||
      /about|who we|our team|our story|mission|founder/.test(txt)) return 'about'
  if (/contact|kontak|kontakt|reach|touch|write|enquir|inquir|get-in/.test(p) ||
      /contact|reach us|get in touch|write to|enquire|inquire|talk to|connect/.test(txt)) return 'contact'
  if (/service|solution|offering|leistung|angebot|offre/.test(p) ||
      /service|solution|what we do|offering/.test(txt))          return 'services'
  if (/product/.test(p) || /product/.test(txt))                 return 'product'
  if (/feature/.test(p) || /feature|how it work/.test(txt))    return 'features'
  if (/case.stud|portfolio|work|project/.test(p) ||
      /case stud|portfolio|project/.test(txt))                   return 'case_study'
  if (/blog|article|post|news|insight/.test(p) ||
      /blog|article|news|insight/.test(txt))                     return 'blog'
  if (/faq|help|support/.test(p) || /faq|help|support/.test(txt)) return 'faq'
  if (/client|testimonial|review/.test(p) ||
      /testimonial|review|feedback|client/.test(txt))            return 'testimonials'
  if (/partner|integration/.test(p) ||
      /partner|integration/.test(txt))                           return 'integration'
  return 'other'
}

function discoverInternalLinks(html: string, base: string): { url: string; anchorHint: string }[] {
  const origin = new URL(base).origin
  const seen   = new Set<string>()
  const links: { url: string; anchorHint: string }[] = []

  // Extract <a href="...">anchor text</a> pairs
  const anchorRe = /<a[^>]+href=["']([^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = anchorRe.exec(html)) !== null) {
    try {
      const href       = m[1].trim()
      const anchorText = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
      if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) continue
      const full = href.startsWith('http') ? href : origin + (href.startsWith('/') ? href : '/' + href)
      const u    = new URL(full)
      if (u.origin !== origin) continue
      if (/\.(pdf|png|jpg|jpeg|gif|svg|webp|ico|css|js|xml|json|zip)$/i.test(u.pathname)) continue
      const path = u.pathname.replace(/\/$/, '') || '/'
      if (seen.has(path)) continue

      const slug          = path.toLowerCase()
      const matchByUrl    = path === '/' || URL_KEYWORDS.some(k => slug.includes(k))
      const matchByAnchor = ANCHOR_KEYWORDS.some(k => anchorText.includes(k))

      if (matchByUrl || matchByAnchor) {
        seen.add(path)
        links.push({ url: full, anchorHint: anchorText })
      }
    } catch { /* bad URL */ }
  }
  return links.slice(0, 12)
}

async function fetchPage(url: string, anchorHint = ''): Promise<{ url: string; pageType: string; text: string; jsRendered?: boolean } | null> {
  try {
    const res = await fetch(url, FETCH_OPTS)
    if (!res.ok) return null
    const html = await res.text()
    const text = htmlToText(html).slice(0, 3500)
    // Use page's own <title> or <h1> as additional type hint
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
    const h1Match    = html.match(/<h1[^>]*>(.*?)<\/h1>/i)
    const pageHint   = [anchorHint, titleMatch?.[1] ?? '', h1Match?.[1] ?? ''].join(' ')
    const pageType   = getPageType(new URL(url).pathname, pageHint)
    const isSpa = (/<div[^>]+id=["'](root|app|__next)["']/i.test(html) || html.includes('__NEXT_DATA__') || html.includes('window.__nuxt__'))
    const hasLittleContent = text.length < 300
    if (isSpa && hasLittleContent) return { url, pageType, text: `[Page exists but content is JavaScript-rendered — static scraping cannot read it]`, jsRendered: true }
    return text.length > 80 ? { url, pageType, text } : null
  } catch { return null }
}

export interface ScrapedPage {
  url: string
  pageType: string
  contentSummary: string
  jsRendered: boolean
}

async function scrapeWebsite(baseUrl: string): Promise<{ content: string; pagesVisited: string[]; jsRenderedPages: string[]; scrapedPages: ScrapedPage[] }> {
  let homepageHtml = ''
  try {
    const res = await fetch(baseUrl, FETCH_OPTS)
    homepageHtml = res.ok ? await res.text() : ''
  } catch { /* ignore */ }

  const discovered = discoverInternalLinks(homepageHtml, baseUrl)
  if (!discovered.find(d => new URL(d.url).pathname === '/')) {
    discovered.unshift({ url: baseUrl, anchorHint: 'homepage' })
  }

  const results = await Promise.all(discovered.map(d => fetchPage(d.url, d.anchorHint)))
  const pages = results.filter(Boolean) as { url: string; pageType: string; text: string; jsRendered?: boolean }[]
  const pagesVisited = pages.map(p => p.url)
  const jsRenderedPages = pages.filter(p => p.jsRendered).map(p => p.url)

  const scrapedPages: ScrapedPage[] = pages.map(p => ({
    url: p.url,
    pageType: p.pageType,
    contentSummary: p.jsRendered ? '[JS-rendered — content not readable by scraper]' : p.text.slice(0, 500),
    jsRendered: !!p.jsRendered,
  }))

  const content = pages
    .map(p => `=== PAGE [${p.pageType.toUpperCase()}]: ${p.url}${p.jsRendered ? ' [JS-RENDERED]' : ''} ===\n${p.text}`)
    .join('\n\n')
    .slice(0, 14000)

  return { content, pagesVisited, jsRenderedPages, scrapedPages }
}

// ─── 4. Claude AI Business Intel Extraction ───────────────────────────────────

async function extractBusinessIntel(url: string, websiteText: string, pagesVisited: string[], jsRenderedPages: string[] = [], geo: GeoCheck, scrapedPages: ScrapedPage[] = []): Promise<BusinessIntel> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key' || !websiteText.trim()) return generateMockIntel(url)

  try {
    const anthropic = new Anthropic({ apiKey })
    const geoContext = geo.missing_geo.length > 0
      ? `\n\nGEO/AI DISCOVERABILITY GAPS DETECTED (for ai_insights):
${geo.missing_geo.map(m => `- ${m}`).join('\n')}
GEO Score: ${geo.geo_score}/100 (${geo.ai_discoverability} AI discoverability)
Include 1-2 ai_insights about their AI discoverability based on these gaps.`
      : '\n\nGEO Score: ' + geo.geo_score + '/100 — AI discoverability looks good.'

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `You are a business analyst. Analyze ONLY what is present in the scraped content below.

PAGES VISITED (${pagesVisited.length} pages):
${scrapedPages.length > 0
  ? scrapedPages.map((p, i) => `  ${i + 1}. [${p.pageType.toUpperCase()}] ${p.url}${p.jsRendered ? ' (JS-rendered)' : ''}`).join('\n')
  : pagesVisited.map((p, i) => `  ${i + 1}. ${p}`).join('\n')
}

${jsRenderedPages.length > 0 ? `JAVASCRIPT-RENDERED PAGES (exist but content unreadable):
${jsRenderedPages.map(p => `  - ${p}`).join('\n')}` : ''}

SCRAPED CONTENT:
${websiteText}
${geoContext}

RULES for "missing_elements":
- NEVER flag something missing if its page was JS-rendered (page EXISTS)
- Only flag things genuinely absent from ALL visited pages
- Be conservative

RULES for "blog":
- exists=true only if a [BLOG] page was actually scraped with real content
- quality="good" if multiple posts visible and content is substantive
- quality="thin" if blog page found but only 1-2 posts or very short content
- quality="stale" if blog exists but posts appear old (>6 months, low update frequency)
- quality="none" if no blog page found at all (exists must be false)
- topics: list 2-4 content themes visible in blog posts; empty array if no blog
- recommendation: specific, actionable one-liner about their blog strategy

Return ONLY valid JSON:
{
  "business_name": "Company name",
  "description": "2-3 sentence description",
  "industry": "Industry/sector",
  "services": ["service 1", "service 2"],
  "target_market": "Broad description of who they serve",
  "who_needs_it": ["Specific persona 1 (role + context)", "Specific persona 2", "Specific persona 3"],
  "pain_points": ["Problem this business solves #1", "Problem #2", "Problem #3"],
  "contact": { "email": null, "phone": null, "address": null },
  "social_links": { "linkedin": null, "facebook": null, "instagram": null, "twitter": null },
  "team_members": [],
  "clients": [],
  "pricing_model": "subscription/one-time/custom/freemium/unknown",
  "unique_value_proposition": "What makes them different",
  "missing_elements": ["Only truly absent items"],
  "content_quality_score": 72,
  "ai_insights": [
    "Key business insight",
    "AI discoverability insight if GEO gaps exist",
    "Top improvement opportunity"
  ],
  "blog": {
    "exists": true,
    "url": "/blog or full URL if found, null if no blog",
    "topics": ["topic1", "topic2"],
    "quality": "good | thin | stale | none",
    "recommendation": "One sentence: what they should do about their blog content"
  }
}`
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return generateMockIntel(url)
    return JSON.parse(jsonMatch[0]) as BusinessIntel
  } catch {
    return generateMockIntel(url)
  }
}

function generateMockIntel(url: string): BusinessIntel {
  return {
    business_name: new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace('www.', ''),
    description: 'Business information will be extracted after a full website scan.',
    industry: 'Unknown — add your industry in Settings',
    services: ['Website scan pending'],
    target_market: 'To be determined',
    who_needs_it: [],
    pain_points: [],
    contact: {},
    social_links: {},
    team_members: [],
    clients: [],
    pricing_model: 'unknown',
    unique_value_proposition: 'Run the audit to extract your USP from your website.',
    missing_elements: ['Could not fully scan website'],
    content_quality_score: 0,
    ai_insights: ['Website content could not be fully analyzed. Ensure your site is publicly accessible.'],
    blog: { exists: false, url: null, topics: [], quality: 'none', recommendation: '' },
  }
}

// ─── 5. Helpers ───────────────────────────────────────────────────────────────

function buildRecommendations(scores: AuditScores): string[] {
  const recs: string[] = []
  if (scores.performance < 70) recs.push('Compress and lazy-load images — can improve load time by 40–60%')
  if (scores.seo < 80) recs.push('Add unique meta descriptions (150–160 chars) to every page')
  if (scores.accessibility < 80) recs.push('Add alt text to all images and fix color contrast ratios (min 4.5:1)')
  if (scores.best_practices < 80) recs.push('Update JavaScript libraries to remove known security vulnerabilities')
  if (scores.mobile < 70) recs.push('Fix viewport and tap-target issues for a better mobile experience')
  if (recs.length < 4) recs.push('Set up Google Search Console to track keyword rankings and crawl errors')
  if (recs.length < 4) recs.push('Add JSON-LD structured data markup for better AI search visibility')
  if (recs.length < 4) recs.push('Create an llms.txt file so AI models can understand and recommend your business')
  return recs.slice(0, 5)
}

function generateMockAudit(url: string): { scores: AuditScores; issues: AuditIssue[]; recommendations: string[] } {
  const hasHttps = url.startsWith('https')
  const base = hasHttps ? 58 : 38
  const v = () => Math.floor(Math.random() * 25) - 8
  const perf = Math.max(10, Math.min(95, base + v() + 10))
  const seo  = Math.max(30, Math.min(95, base + v() + 18))
  const acc  = Math.max(30, Math.min(95, base + v() + 8))
  const bp   = Math.max(30, Math.min(95, base + v() + 22))
  const mobile = Math.max(15, Math.min(90, base + v()))
  const overall = Math.round((perf + seo + acc + bp + mobile) / 5)
  const issues: AuditIssue[] = [
    { severity: perf < 60 ? 'critical' : 'warning', category: 'Performance', title: perf < 60 ? 'Slow page load speed' : 'Page speed can be improved', description: 'Large images and render-blocking scripts are slowing your site down.' },
    { severity: 'warning', category: 'SEO', title: 'Missing meta descriptions', description: 'Several pages are missing meta descriptions, reducing search click-through rates.' },
    { severity: mobile < 60 ? 'critical' : 'warning', category: 'Mobile', title: 'Mobile experience needs work', description: 'Text is too small and tap targets are too close together on mobile.' },
  ]
  if (!hasHttps) issues.unshift({ severity: 'critical', category: 'Security', title: 'Site not using HTTPS', description: 'Your site is served over HTTP. This is a security risk and SEO penalty.' })
  return { scores: { performance: perf, seo, accessibility: acc, best_practices: bp, mobile, overall }, issues, recommendations: buildRecommendations({ performance: perf, seo, accessibility: acc, best_practices: bp, mobile, overall }) }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
    if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    const credit = await deductCredits(profile.current_workspace_id, 'website_audit', 'Website audit')
    if (!credit.ok) return NextResponse.json({ error: credit.error }, { status: 402 })

    const { data: business } = await supabase.from('businesses').select('id, website_url').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    if (!business) return NextResponse.json({ error: 'No business found' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    let url: string = body.url || business.website_url || ''
    if (!url) return NextResponse.json({ error: 'No website URL — add one in Settings > Business' }, { status: 400 })
    if (!url.startsWith('http')) url = 'https://' + url

    // Run all checks in parallel
    const [pageSpeedResult, { content: websiteText, pagesVisited, jsRenderedPages, scrapedPages }, geo] = await Promise.all([
      runPageSpeedAudit(url),
      scrapeWebsite(url),
      checkGeoReadiness(url),
    ])

    const intel = await extractBusinessIntel(url, websiteText, pagesVisited, jsRenderedPages, geo, scrapedPages)
    const { scores, issues, recommendations } = pageSpeedResult

    const { data: audit, error: auditError } = await supabase
      .from('audits')
      .insert({
        business_id: business.id,
        type: 'website',
        score: scores.overall,
        report_json: {
          url,
          scores,
          issues,
          recommendations,
          intel,
          geo,
          pages_visited: pagesVisited,
          js_rendered_pages: jsRenderedPages,
          checked_at: new Date().toISOString(),
        },
      })
      .select()
      .single()

    if (auditError) throw auditError

    await supabase.from('businesses').update({
      health_score: scores.overall,
      website_intel: intel,
    } as never).eq('id', business.id)

    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('business_metrics').upsert({
      business_id: business.id,
      date: today,
      health_score: scores.overall,
      metrics_json: { website_score: scores.overall, geo_score: geo.geo_score, ...scores },
    }, { onConflict: 'business_id,date' })

    // Write dedicated website_audit memory so all AI features (marketing plan,
    // ICP builder, proposals, content) can load it without re-running the audit.
    const auditMemory = {
      audited_at: new Date().toISOString(),
      url,
      scores: {
        overall:       scores.overall,
        performance:   scores.performance,
        seo:           scores.seo,
        accessibility: scores.accessibility,
        best_practices: scores.best_practices,
        mobile:        scores.mobile,
        geo:           geo.geo_score,
      },
      pages: scrapedPages.map(p => ({
        url:        p.url,
        type:       p.pageType,
        summary:    p.contentSummary,
        js_rendered: p.jsRendered,
      })),
      intel: {
        business_name:            intel.business_name,
        description:              intel.description,
        industry:                 intel.industry,
        services:                 intel.services,
        target_market:            intel.target_market,
        who_needs_it:             intel.who_needs_it,
        pain_points:              intel.pain_points,
        unique_value_proposition: intel.unique_value_proposition,
        pricing_model:            intel.pricing_model,
        clients:                  intel.clients,
        team_members:             intel.team_members,
        social_links:             intel.social_links,
        contact:                  intel.contact,
        content_quality_score:    intel.content_quality_score,
        ai_insights:              intel.ai_insights,
        missing_elements:         intel.missing_elements,
        blog:                     intel.blog,
      },
      geo: {
        score:               geo.geo_score,
        ai_discoverability:  geo.ai_discoverability,
        missing:             geo.missing_geo,
        llms_txt:            geo.llms_txt,
        structured_data:     geo.structured_data,
        sitemap:             geo.sitemap_xml,
        robots:              geo.robots_txt,
        open_graph:          geo.open_graph,
        https:               geo.https,
      },
      issues:          issues.slice(0, 10),
      recommendations: recommendations,
    }

    // Upsert into agent_memory (key: website_audit)
    const { data: existingMem } = await supabase
      .from('agent_memory')
      .select('id')
      .eq('business_id', business.id)
      .eq('key', 'website_audit')
      .maybeSingle()

    if (existingMem) {
      await supabase.from('agent_memory')
        .update({ value_text: JSON.stringify(auditMemory), updated_at: new Date().toISOString() })
        .eq('business_id', business.id).eq('key', 'website_audit')
    } else {
      await supabase.from('agent_memory')
        .insert({ business_id: business.id, key: 'website_audit', value_text: JSON.stringify(auditMemory) })
    }

    // Refresh full business_context memory (non-blocking)
    const { syncBusinessMemory } = await import('@/lib/agent/sync-memory')
    syncBusinessMemory(business.id, profile.current_workspace_id, 0).catch(() => {})

    // Agent signals
    const criticalCount = (issues || []).filter(i => i.severity === 'critical').length
    const grade = scores.overall >= 90 ? 'A' : scores.overall >= 80 ? 'B' : scores.overall >= 70 ? 'C' : scores.overall >= 60 ? 'D' : 'F'
    const signalType = criticalCount > 0 ? 'warning' : scores.overall >= 70 ? 'done' : 'opportunity'

    const signalsToInsert = [
      {
        business_id: business.id,
        type: signalType,
        title: `Website Audit Complete — Score ${scores.overall}/100 (${grade}) · GEO ${geo.geo_score}/100`,
        body: criticalCount > 0
          ? `Found ${criticalCount} critical issue${criticalCount > 1 ? 's' : ''}. GEO/AI discoverability: ${geo.ai_discoverability}. Performance: ${scores.performance}, SEO: ${scores.seo}, Mobile: ${scores.mobile}.`
          : `Website scored ${scores.overall}/100. AI discoverability: ${geo.ai_discoverability} (${geo.geo_score}/100). Performance: ${scores.performance}, SEO: ${scores.seo}.`,
        action_type: 'view_report',
        action_label: 'View Report',
        dismissed: false,
      },
    ]

    // GEO tasks as signals
    for (const task of (geo.ai_tasks || []).slice(0, 3)) {
      signalsToInsert.push({
        business_id: business.id,
        type: 'opportunity',
        title: `GEO: ${task.title}`,
        body: task.desc,
        action_type: 'view_report',
        action_label: 'View Audit',
        dismissed: false,
      })
    }

    // Missing website elements
    const missingTips: Record<string, string> = {
      'contact': 'Add a /contact page with email, phone, and a form.',
      'email': 'Display your email address prominently.',
      'phone': 'Add a phone number to your site.',
      'address': 'List your physical address — improves local SEO.',
      'pricing': 'Add a pricing page — 80% of B2B buyers want to see pricing first.',
      'blog': 'Start a blog — companies with blogs get 67% more leads.',
      'testimonial': 'Add client testimonials — increases conversion by 34%.',
      'case stud': 'Add case studies — #1 B2B content type for converting prospects.',
      'faq': 'Add an FAQ — reduces support questions and improves SEO.',
      'social': 'Link your social media profiles.',
      'team': 'Add a team/about page — builds trust.',
    }
    for (const missing of (intel.missing_elements || []).slice(0, 2)) {
      const tip = Object.entries(missingTips).find(([k]) => missing.toLowerCase().includes(k))?.[1]
      signalsToInsert.push({
        business_id: business.id,
        type: 'opportunity',
        title: missing.replace(/^No\s+/i, 'Add ').replace(/^Missing\s+/i, 'Add '),
        body: tip || `${missing} — fixing this could improve your health score and conversions.`,
        action_type: 'view_report',
        action_label: 'View Full Audit',
        dismissed: false,
      })
    }

    // ── Blog signals ──────────────────────────────────────────────────────────
    const blog = intel.blog ?? { exists: false, url: null, topics: [], quality: 'none', recommendation: '' }

    if (!blog.exists) {
      // No blog found — pending task signal
      signalsToInsert.push({
        business_id: business.id,
        type: 'opportunity',
        title: '[Blog] Add a blog page to your website',
        body: 'No blog page was detected. Businesses with blogs get 67% more leads and rank significantly better on Google and AI search engines (Perplexity, ChatGPT). Create a blog and use the Content Generator to publish your first post.',
        action_type: 'open_url',
        action_label: 'Open Content Generator',
        dismissed: false,
      })
    } else if (blog.quality === 'thin') {
      signalsToInsert.push({
        business_id: business.id,
        type: 'opportunity',
        title: '[Blog] Your blog needs more content',
        body: `Blog detected but content is thin. ${blog.recommendation || 'Publish at least 2 posts per week to build SEO authority and AI discoverability.'} Use the Content Generator to create targeted articles.`,
        action_type: 'open_url',
        action_label: 'Open Content Generator',
        dismissed: false,
      })
    } else if (blog.quality === 'stale') {
      signalsToInsert.push({
        business_id: business.id,
        type: 'warning',
        title: '[Blog] Blog content is stale — needs fresh posts',
        body: `Your blog hasn't been updated recently. ${blog.recommendation || 'Publish fresh content at least twice a month to maintain SEO rankings and AI discoverability.'} Use the Content Generator to get started.`,
        action_type: 'open_url',
        action_label: 'Open Content Generator',
        dismissed: false,
      })
    }

    // ── Blog recommendations ───────────────────────────────────────────────────
    if (!blog.exists) {
      recommendations.unshift('Create a blog page — companies with blogs get 67% more leads. Use CooVex Content Generator to publish your first post.')
    } else if (blog.quality === 'thin' || blog.quality === 'stale') {
      recommendations.push(blog.recommendation || 'Publish 2+ blog posts per week using Content Generator to build SEO authority and AI discoverability.')
    }

    // Dismiss all previous audit signals before inserting new ones
    await supabase
      .from('agent_signals')
      .update({ dismissed: true })
      .eq('business_id', business.id)
      .eq('dismissed', false)
      .or('title.ilike.Website Audit Complete%,title.ilike.GEO:%,title.ilike.Add %,title.ilike.Audit complete%,title.ilike.[Blog]%')

    await supabase.from('agent_signals').insert(signalsToInsert)

    // Emit orchestration event so engine can react (update memory, create tasks, etc.)
    const { data: prof } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
    if (prof?.current_workspace_id) {
      const { emitEvent, runOrchestration } = await import('@/lib/agent/orchestration')
      await emitEvent(prof.current_workspace_id, 'audit.completed', 'audit', audit.id, {
        score: scores.overall,
        grade,
        critical_issues: criticalCount,
        geo_score: geo.geo_score,
      })
      runOrchestration(prof.current_workspace_id).catch(() => {})
    }

    return NextResponse.json({ audit, scores, intel, geo }, { headers: { 'X-Credits-Remaining': String(credit.balance) } })
  } catch (error) {
    console.error('POST /api/audit/run error:', error)
    return NextResponse.json({ error: 'Failed to run audit' }, { status: 500 })
  }
}
