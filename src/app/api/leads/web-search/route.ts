import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 45

interface SearchResult {
  title: string
  link: string
  snippet: string
  displayLink: string
}

// Search via SearXNG (self-hosted) → Serper.dev → DuckDuckGo fallback
async function webSearch(query: string, limit = 8): Promise<SearchResult[]> {
  // 1. SearXNG (self-hosted on VPS — best, free, Google+Bing+DDG combined)
  const searxUrl = process.env.SEARCH_SERVICE_URL
  if (searxUrl) {
    try {
      const params = new URLSearchParams({ q: query, format: 'json', engines: 'google,bing,duckduckgo' })
      const res = await fetch(`${searxUrl}/search?${params}`, {
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const data = await res.json()
        const results: SearchResult[] = (data.results ?? []).slice(0, limit).map((r: { title: string; url: string; content: string }) => ({
          title:       r.title ?? '',
          link:        r.url ?? '',
          snippet:     r.content ?? '',
          displayLink: (() => { try { return new URL(r.url).hostname.replace('www.', '') } catch { return '' } })(),
        }))
        if (results.length > 0) return results
      }
    } catch (e) { console.error('[WebSearch] SearXNG failed:', e) }
  }

  // 2. Serper.dev (optional, if SERPER_API_KEY set)
  const serperKey = process.env.SERPER_API_KEY
  if (serperKey) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, num: limit }),
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const data = await res.json()
        return (data.organic ?? []).slice(0, limit)
      }
    } catch {}
  }

  // 3. Free fallback: DuckDuckGo HTML scraping
  try {
    const params = new URLSearchParams({ q: query, kl: 'us-en' })
    const res = await fetch(`https://html.duckduckgo.com/html/?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return []
    const html = await res.text()

    const results: SearchResult[] = []

    // Extract result links and titles from DDG HTML
    const linkRe   = /class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    const snippetRe = /class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div|span)>/g

    const links    = [...html.matchAll(linkRe)]
    const snippets = [...html.matchAll(snippetRe)]

    for (let i = 0; i < Math.min(links.length, limit); i++) {
      const url     = links[i][1]
      const title   = links[i][2].replace(/<[^>]+>/g, '').trim()
      const snippet = (snippets[i]?.[1] ?? '').replace(/<[^>]+>/g, '').trim()
      if (url?.startsWith('http') && title) {
        try {
          results.push({
            title,
            link:        url,
            snippet,
            displayLink: new URL(url).hostname.replace('www.', ''),
          })
        } catch {}
      }
    }
    return results
  } catch (e) {
    console.error('[WebSearch] DDG failed:', e)
    return []
  }
}

function extractEmails(html: string): string[] {
  const emailRe  = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  const blacklist = ['noreply', 'no-reply', 'example.', 'sentry.', 'w3.org', 'schema.org', 'cloudflare', 'wixpress', 'wordpress', 'jquery', 'png', 'jpg', 'gif']
  return [...new Set(html.match(emailRe) ?? [])]
    .filter(e => !blacklist.some(b => e.toLowerCase().includes(b)))
    .slice(0, 4)
}

function extractPhones(html: string): string[] {
  const bdRe   = /(?:\+?880|0)1[3-9]\d{8}/g
  const intlRe = /\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g
  const bd   = html.match(bdRe)   ?? []
  const intl = html.match(intlRe) ?? []
  return [...new Set([...bd, ...intl.filter(p => p.replace(/\D/g, '').length >= 10)])].slice(0, 3)
}

// Domains that should never appear as leads (doc sites, social media, big tech)
const BLACKLISTED = new Set([
  'scribd.com', 'issuu.com', 'slideshare.net', 'docstoc.com', 'docs.google.com',
  'drive.google.com', 'microsoft.com', 'support.microsoft.com', 'learn.microsoft.com',
  'office.com', 'google.com', 'google.co', 'googleapis.com',
  'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com',
  'linkedin.com', 'youtube.com', 'tiktok.com', 'pinterest.com',
  'wikipedia.org', 'wikimedia.org', 'wikidata.org',
  'amazon.com', 'ebay.com', 'alibaba.com', 'aliexpress.com',
  'reddit.com', 'quora.com', 'stackoverflow.com',
  'medium.com', 'substack.com', 'wordpress.com', 'blogger.com', 'blogspot.com',
  'researchgate.net', 'academia.edu', 'apple.com', 'cloudflare.com',
])

async function scrapeContactInfo(url: string): Promise<{ emails: string[]; phones: string[] }> {
  try {
    const base  = new URL(url).origin
    const pages = [url, `${base}/contact`, `${base}/contact-us`, `${base}/about`]
    for (const page of pages.slice(0, 3)) {
      try {
        const res = await fetch(page, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CooVexBot/1.0; +https://coovex.com)' },
          signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) continue
        const html   = await res.text()
        const emails = extractEmails(html)
        const phones = extractPhones(html)
        if (emails.length > 0 || phones.length > 0) return { emails, phones }
      } catch { continue }
    }
  } catch {}
  return { emails: [], phones: [] }
}

// Let AI decide which search results are real institutions vs directory pages vs noise
async function filterWithAI(
  results: SearchResult[],
  anthropic: Anthropic,
  context: string,
): Promise<{ institutions: string[]; directories: string[] }> {
  if (results.length === 0) return { institutions: [], directories: [] }

  try {
    const list = results.map((r, i) =>
      `${i + 1}. "${r.title}"\n   URL: ${r.link}\n   ${r.snippet?.slice(0, 120) ?? ''}`
    ).join('\n\n')

    const aiRes = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `We are finding potential customers for: ${context}

Below are web search results. Classify each URL:
- "institution" → actual organization website (school, office, company) that probably has a /contact page with email — worth scraping
- "directory" → a page that LISTS multiple institutions with links to their individual websites — we'll extract those links
- "skip" → news, Wikipedia, social media, Microsoft, Google, generic content

Results:
${list}

Return ONLY valid JSON (no markdown):
{"institutions": ["url1", "url2"], "directories": ["url3"], "skip": []}

Be liberal — prefer "institution" or "directory" over "skip" when unsure.`,
      }],
    })

    const text    = (aiRes.content[0] as { type: string; text: string }).text.trim()
    const jsonStr = text.startsWith('{') ? text : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    const parsed  = JSON.parse(jsonStr)
    return {
      institutions: (parsed.institutions ?? []) as string[],
      directories:  (parsed.directories  ?? []) as string[],
    }
  } catch {
    // Fallback: treat all non-blacklisted results as institutions
    const fallback = results
      .filter(r => {
        try { return !BLACKLISTED.has(new URL(r.link).hostname.replace('www.', '')) } catch { return false }
      })
      .map(r => r.link)
    return { institutions: fallback.slice(0, 8), directories: [] }
  }
}

// Extract institution website links from a directory / listing page
async function scrapeDirectoryLinks(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CooVexBot/1.0; +https://coovex.com)' },
      signal:  AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const html     = await res.text()
    const baseHost = new URL(url).hostname.replace('www.', '')
    const linkRe   = /href=["']?(https?:\/\/[^"'\s>]+)/gi
    const seen     = new Set<string>()
    const found: string[] = []

    for (const m of html.matchAll(linkRe)) {
      try {
        const link   = m[1].split('?')[0].split('#')[0] // strip query/hash
        const domain = new URL(link).hostname.replace('www.', '')
        if (domain === baseHost)     continue // same site
        if (BLACKLISTED.has(domain)) continue
        if (seen.has(domain))        continue
        seen.add(domain)
        found.push(link)
        if (found.length >= 10) break
      } catch { continue }
    }
    return found
  } catch { return [] }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { product_id, market = 'regional', custom_queries } = await req.json()
  if (!product_id) return NextResponse.json({ error: 'product_id required' }, { status: 400 })

  const { data: product } = await supabase
    .from('products')
    .select('id, name, category, target_audience, type, tagline, description')
    .eq('id', product_id)
    .single()

  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  // Check Supabase cache — skip if user provided custom queries (they want fresh results)
  const cacheKey = `${product.name}|${product.category ?? ''}|${product.target_audience ?? ''}|${market}`.toLowerCase().trim()
  if (!custom_queries) try {
    const { data: cached } = await supabase
      .from('web_lead_cache')
      .select('leads, queries, buyer_role')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (cached) {
      const cl = cached.leads as { emails: string[]; phones: string[] }[]
      console.log('[WebSearch] Cache hit:', cacheKey)
      return NextResponse.json({
        leads:              cached.leads,
        queries_used:       cached.queries,
        buyer_role:         cached.buyer_role,
        total_with_contact: cl.filter(l => l.emails?.length > 0 || l.phones?.length > 0).length,
        product_name:       product.name,
        from_cache:         true,
      })
    }
  } catch { /* table may not exist yet — skip */ }

  const marketLabel = market === 'local' ? 'Local (specific city/area)' : market === 'international' ? 'International (global)' : 'Regional (country-level)'
  const locationHint = market === 'international' ? 'Do not restrict to any country.' : `Use location terms from target audience.`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let queries: string[] = []
  let buyerRole = ''

  if (Array.isArray(custom_queries) && custom_queries.length > 0) {
    // User provided their own queries — use directly
    queries   = custom_queries.map(q => String(q).trim()).filter(Boolean)
    buyerRole = ''
  } else {
    // AI-generate queries
    const aiRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `You are a B2B lead generation expert. Generate Google search queries to DISCOVER real organizations that would buy this product.

Product: ${product.name}
Type: ${product.type}
Category: ${product.category ?? 'N/A'}
Target audience: ${product.target_audience ?? 'N/A'}
Description: ${product.description ?? 'N/A'}
Market scope: ${marketLabel} — ${locationHint}

STEP 1 — Identify the BUYER:
Who specifically holds budget authority to purchase this? One specific job title.

STEP 2 — Generate 5 DISCOVERY queries to find lists and directories of these organizations.

QUERY STRATEGY — Think like a buyer searching Google:
✅ Use simple: "[institution type] in [city]" or "[institution type] [country] list"
✅ Good: "private school in dhaka", "madrasa list sylhet", "college in chittagong"
✅ Also good: "[institution type] [city] website" or "[institution type] [area]"
✅ Listing/directory pages are GOOD — we extract institution links from them
❌ Do NOT add "contact", "email", "phone" to queries — those return PDFs and spam sites
❌ Do NOT add "directory", "database", "spreadsheet"

The goal is to find PAGES WITH LISTS of institutions, then we visit each institution's website to find contact info.

Good example — Attendance Device, Schools, Bangladesh (regional):
{
  "buyer_role": "School Principal / Madrasa Headmaster",
  "queries": [
    "private school in dhaka",
    "english medium school dhaka list",
    "madrasa in sylhet bangladesh",
    "college in chittagong",
    "technical institute in bangladesh"
  ]
}

Return ONLY valid JSON (no markdown):
{"buyer_role": "...", "queries": ["...", "...", "...", "...", "..."]}`,
      }],
    })

    try {
      const raw = (aiRes.content[0] as { type: string; text: string }).text.trim()
      const jsonStr = raw.startsWith('{') ? raw : raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
      const parsed  = JSON.parse(jsonStr)
      queries   = parsed.queries    ?? []
      buyerRole = parsed.buyer_role ?? ''
    } catch {
      queries = [
        `${product.target_audience ?? product.name} list`,
        `${product.category ?? product.name} in bangladesh`,
      ]
    }
  }

  console.log('[WebSearch] Market:', market, '| Buyer role:', buyerRole)
  console.log('[WebSearch] Queries:', queries)


  // ── STEP 1: Discovery search (broad queries, more results) ───────────────────
  const searchResults = await Promise.allSettled(queries.slice(0, 4).map(q => webSearch(q, 10)))
  const allResults: SearchResult[] = searchResults
    .filter((r): r is PromiseFulfilledResult<SearchResult[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)

  // Dedup by domain (keep up to 20 for AI to filter)
  const seenDomains = new Set<string>()
  const deduped = allResults.filter(r => {
    try {
      const domain = new URL(r.link).hostname.replace('www.', '')
      if (seenDomains.has(domain)) return false
      seenDomains.add(domain)
      return true
    } catch { return false }
  }).slice(0, 20)

  console.log('[WebSearch] Step 1 complete:', deduped.length, 'unique results')

  // ── STEP 2: AI filters results → institutions vs directories ──────────────────
  const { institutions, directories } = await filterWithAI(
    deduped,
    anthropic,
    `${product.name} — ${product.target_audience ?? product.category ?? ''}`,
  )

  console.log('[WebSearch] Step 2 — institutions:', institutions.length, '| directories:', directories.length)

  // ── STEP 3: Extract institution links from directory pages ────────────────────
  const dirResults = await Promise.allSettled(directories.slice(0, 3).map(scrapeDirectoryLinks))
  const dirLinks = dirResults
    .filter((r): r is PromiseFulfilledResult<string[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)

  // Merge institutions + directory-extracted links (dedup, no blacklisted)
  const institutionSet = new Set(institutions)
  const extraLinks = [...new Set(dirLinks)].filter(url => {
    try {
      const domain = new URL(url).hostname.replace('www.', '')
      return !BLACKLISTED.has(domain) && !institutionSet.has(url)
    } catch { return false }
  })

  const allToScrape = [...institutions, ...extraLinks].slice(0, 15)

  console.log('[WebSearch] Step 3 — scraping', allToScrape.length, 'institution URLs')

  // ── STEP 4: Scrape contact info from each institution website ─────────────────
  const leads = await Promise.all(
    allToScrape.map(async url => {
      const contact  = await scrapeContactInfo(url)
      const original = deduped.find(r => r.link === url)
      let domain = ''
      try { domain = new URL(url).hostname.replace('www.', '') } catch {}
      return {
        title:   original?.title   ?? domain,
        website: url,
        domain:  original?.displayLink ?? domain,
        snippet: original?.snippet ?? '',
        emails:  contact.emails,
        phones:  contact.phones,
      }
    })
  )

  const withContact    = leads.filter(l => l.emails.length > 0 || l.phones.length > 0)
  const withoutContact = leads.filter(l => l.emails.length === 0 && l.phones.length === 0)

  console.log('[WebSearch] With contact:', withContact.length, '| Without:', withoutContact.length)

  const sortedLeads = [...withContact, ...withoutContact]

  // Cache results in Supabase for cross-user reuse (7-day expiry)
  try {
    await supabase.from('web_lead_cache').upsert({
      cache_key:  cacheKey,
      leads:      sortedLeads,
      queries:    queries,
      buyer_role: buyerRole,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'cache_key' })
  } catch { /* ignore */ }

  return NextResponse.json({
    leads:              sortedLeads,
    queries_used:       queries,
    buyer_role:         buyerRole,
    total_with_contact: withContact.length,
    product_name:       product.name,
  })
}
