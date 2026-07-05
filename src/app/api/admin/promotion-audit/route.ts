import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Anthropic from '@anthropic-ai/sdk'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

const FETCH_OPTS = {
  signal: AbortSignal.timeout(10000),
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CooVex-Audit/1.0; +https://coovex.com)' },
}

function generateSlug(domain: string): string {
  const clean = domain.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 12)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${clean}-${rand}`
}

// ── GEO / AI Discoverability Check ───────────────────────────────────────────

async function checkGeo(url: string) {
  let origin: string
  try { origin = new URL(url).origin } catch { origin = url }

  let homepageHtml = ''
  try {
    const r = await fetch(url, FETCH_OPTS)
    if (r.ok) homepageHtml = await r.text()
  } catch { /* ignore */ }

  const fetchText = async (path: string) => {
    try {
      const r = await fetch(origin + path, { ...FETCH_OPTS, signal: AbortSignal.timeout(5000) })
      return r.ok ? await r.text() : null
    } catch { return null }
  }

  const [robotsContent, sitemapContent, llmsContent] = await Promise.all([
    fetchText('/robots.txt'), fetchText('/sitemap.xml'), fetchText('/llms.txt'),
  ])

  const robots_txt    = robotsContent !== null
  const sitemap_xml   = sitemapContent !== null
  const llms_txt      = llmsContent !== null
  const structured_data = /<script[^>]+type=["']application\/ld\+json["']/i.test(homepageHtml)
  const open_graph    = /<meta[^>]+property=["']og:/i.test(homepageHtml)
  const canonical_url = /<link[^>]+rel=["']canonical["']/i.test(homepageHtml)
  const meta_description = /<meta[^>]+name=["']description["']/i.test(homepageHtml)
  const twitter_card  = /<meta[^>]+(name=["']twitter:|property=["']twitter:)/i.test(homepageHtml)
  const https         = url.startsWith('https://')

  const AI_BOTS = ['gptbot', 'claudebot', 'perplexitybot', 'ccbot', 'anthropic-ai', 'google-extended']
  const robots_ai_allowed = robots_txt && AI_BOTS.some(b => (robotsContent ?? '').toLowerCase().includes(b))
  const llms_txt_quality = !llms_txt ? 'missing' : (llmsContent ?? '').length > 400 ? 'good' : 'basic'

  const weights = [
    { key: 'llms_txt',         label: 'llms.txt',         v: llms_txt,         w: 20, desc: 'AI model guide file' },
    { key: 'structured_data',  label: 'JSON-LD',           v: structured_data,  w: 18, desc: 'Structured data schema' },
    { key: 'meta_description', label: 'Meta Description',  v: meta_description, w: 15, desc: 'Page summary for AI' },
    { key: 'sitemap_xml',      label: 'sitemap.xml',       v: sitemap_xml,      w: 12, desc: 'Page index for crawlers' },
    { key: 'robots_txt',       label: 'robots.txt',        v: robots_txt,       w: 10, desc: 'Crawler permission file' },
    { key: 'open_graph',       label: 'Open Graph',        v: open_graph,       w: 10, desc: 'Social/AI preview tags' },
    { key: 'https',            label: 'HTTPS',             v: https,            w: 8,  desc: 'Secure connection' },
    { key: 'canonical_url',    label: 'Canonical URL',     v: canonical_url,    w: 4,  desc: 'Dedup prevention' },
    { key: 'twitter_card',     label: 'Twitter/X Card',    v: twitter_card,     w: 3,  desc: 'Social card meta' },
  ]

  const totalWeight = weights.reduce((s, x) => s + x.w, 0)
  const earned = weights.reduce((s, x) => s + (x.v ? x.w : 0), 0)
  const geo_score = Math.round((earned / totalWeight) * 100)
  const ai_discoverability = geo_score >= 65 ? 'high' : geo_score >= 35 ? 'medium' : 'low'

  return {
    llms_txt, robots_txt, sitemap_xml, structured_data, open_graph,
    canonical_url, meta_description, twitter_card, https,
    robots_ai_allowed, llms_txt_quality, geo_score, ai_discoverability,
    checklist: weights.map(w => ({ key: w.key, label: w.label, desc: w.desc, passed: w.v, weight: w.w })),
    missing: weights.filter(w => !w.v).map(w => w.label),
  }
}

// ── PageSpeed / Performance ───────────────────────────────────────────────────

async function checkPerformance(url: string) {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY
  const psUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&category=seo&category=accessibility&category=best-practices${apiKey && apiKey !== 'your_google_api_key' ? '&key=' + apiKey : ''}`

  try {
    const res = await fetch(psUrl, { signal: AbortSignal.timeout(25000) })
    if (!res.ok) throw new Error('unavailable')
    const d = await res.json()
    const cats = d.lighthouseResult?.categories || {}
    const audits = d.lighthouseResult?.audits || {}

    const performance  = Math.round((cats.performance?.score ?? 0) * 100)
    const seo          = Math.round((cats.seo?.score ?? 0) * 100)
    const accessibility = Math.round((cats.accessibility?.score ?? 0) * 100)
    const best_practices = Math.round((cats['best-practices']?.score ?? 0) * 100)
    const fcp          = d.lighthouseResult?.audits?.['first-contentful-paint']?.score ?? 0.5
    const mobile       = Math.round(fcp * 100)

    const issues: { severity: string; category: string; title: string; description: string }[] = []
    if (performance < 50) issues.push({ severity: 'critical', category: 'Performance', title: 'Poor page speed', description: 'Page loads very slowly — directly hurts conversions and search rankings.' })
    else if (performance < 80) issues.push({ severity: 'warning', category: 'Performance', title: 'Page speed can be improved', description: 'Large images and render-blocking scripts are slowing your site down.' })
    if (seo < 70) issues.push({ severity: 'warning', category: 'SEO', title: 'SEO improvements needed', description: 'Missing meta descriptions, alt text, or structured data.' })
    if (accessibility < 70) issues.push({ severity: 'warning', category: 'Accessibility', title: 'Accessibility issues found', description: 'Users with disabilities may have difficulty navigating your site.' })
    if (!audits['viewport']?.score) issues.push({ severity: 'critical', category: 'Mobile', title: 'No viewport meta tag', description: 'Site is not configured for mobile devices.' })
    if (mobile < 60) issues.push({ severity: 'warning', category: 'Mobile', title: 'Poor mobile experience', description: 'Mobile performance is below average — 60%+ of traffic is mobile.' })
    if (issues.length === 0) issues.push({ severity: 'info', category: 'Overall', title: 'Site is performing well', description: 'No critical issues found. Continue optimizing.' })

    return { scores: { performance, seo, accessibility, best_practices, mobile }, issues }
  } catch {
    // Fallback mock scores
    return {
      scores: { performance: 65, seo: 70, accessibility: 80, best_practices: 75, mobile: 55 },
      issues: [{ severity: 'info', category: 'Overall', title: 'Performance data unavailable', description: 'Could not fetch PageSpeed data — run a manual check at pagespeed.web.dev.' }],
    }
  }
}

// ── Website text scrape ───────────────────────────────────────────────────────

async function scrapeText(url: string): Promise<string> {
  try {
    const res = await fetch(url, FETCH_OPTS)
    const html = await res.text()
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000)
  } catch { return '' }
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { url, prospectName, prospectEmail } = await req.json() as {
    url: string; prospectName?: string; prospectEmail?: string
  }
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`
  const domain = new URL(normalizedUrl).hostname.replace('www.', '')

  // Run all checks in parallel
  const [geo, perf, websiteText] = await Promise.all([
    checkGeo(normalizedUrl),
    checkPerformance(normalizedUrl),
    scrapeText(normalizedUrl),
  ])

  // Claude: business intel + ICP + cold email
  const client = new Anthropic()
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const prompt = `You are a B2B SaaS growth analyst. Analyze this website and generate a cold outreach package.

Today: ${today}
Domain: ${domain}
Prospect name: ${prospectName || 'the founder'}
Website content: ${websiteText || '[Could not fetch — analyze from domain only]'}

Return ONLY valid JSON (no markdown, no explanation):
{
  "business_name": "company name",
  "description": "2-sentence description of what they do and who they serve",
  "industry": "industry label",
  "stage": "early-stage | growth | established",
  "services": ["service1", "service2", "service3"],
  "target_market": "who their customers are",
  "pricing_model": "freemium | paid | enterprise | unknown",
  "who_needs_it": ["customer type 1", "customer type 2", "customer type 3"],
  "pain_points": ["pain1", "pain2", "pain3"],
  "missing_elements": ["missing page or content type 1", "missing page or content type 2"],
  "ai_insights": ["insight about their content/strategy 1", "insight 2", "insight 3"],
  "unique_value_proposition": "their core differentiator in one sentence",
  "cold_email": {
    "subject": "specific subject line referencing their product",
    "body": "full plain-text email body — mention their specific product, reference the GEO score of ${geo.geo_score}/100, mention 2-3 specific missing items (${geo.missing.slice(0,3).join(', ')}), explain how CooVex fixes this. Sign as Ferdous from CooVex (app.coovex.com). Max 200 words. Plain text only."
  },
  "linkedin_message": "3-sentence LinkedIn DM mentioning their product specifically and inviting them to see their free report"
}`

  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1800,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const intel = JSON.parse(jsonMatch[0])

    // Save full report
    const service = createServiceClient()
    const slug = generateSlug(domain)
    await service.from('promotion_reports').insert({
      slug,
      domain,
      report_json: { geo, perf, intel },
      prospect_email: prospectEmail || null,
      created_by: user.id,
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const reportUrl = `${appUrl}/report/${slug}`

    return NextResponse.json({ ok: true, domain, prospectEmail, geo, perf, intel, slug, reportUrl })
  } catch (e) {
    console.error('[admin/promotion-audit]', e)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
