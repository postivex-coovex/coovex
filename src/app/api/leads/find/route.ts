import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

interface LeadCandidate {
  name: string
  company: string
  title?: string
  website?: string
  email?: string
  phone?: string
  all_emails?: string[]
  all_phones?: string[]
  fit_score: number
  fit_reason: string
  source?: string
  is_real: boolean
}

interface ICP {
  company_types: string[]
  company_size: string
  decision_maker_titles: string[]
  industries: string[]
  pain_points: string[]
  search_queries: string[]
}

interface TavilyResult {
  title: string
  url: string
  content: string
  score?: number
}

// ── Self-hosted search service (VPS) ─────────────────────────────────────────
async function searchSelfHosted(query: string, serviceUrl: string, secret: string): Promise<TavilyResult[]> {
  try {
    const url = new URL('/search', serviceUrl)
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'json')  // SearXNG requires this for JSON output
    url.searchParams.set('categories', 'general')
    const res = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        ...(secret ? { 'X-Service-Secret': secret } : {}),
      },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return []
    const data = await res.json()
    // SearXNG returns { results: [{ title, url, content, score }] }
    return ((data.results ?? []) as TavilyResult[]).slice(0, 5)
  } catch {
    return []
  }
}

// ── Tavily Search (fallback if self-hosted not configured) ────────────────────
async function searchTavily(query: string, apiKey: string): Promise<TavilyResult[]> {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: false,
        include_raw_content: false,
        include_domains: [],
        exclude_domains: ['wikipedia.org', 'reddit.com', 'youtube.com', 'facebook.com'],
      }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results as TavilyResult[]) || []
  } catch {
    return []
  }
}

// ── Self-hosted deep crawler — emails + phones from all pages ─────────────────
async function crawlSelfHosted(
  domain: string,
  serviceUrl: string,
  secret: string,
): Promise<{ emails: string[]; phones: string[]; pages_crawled: number } | null> {
  try {
    const url = new URL('/crawl', serviceUrl)
    url.searchParams.set('domain', domain)
    url.searchParams.set('max_pages', '12')
    const res = await fetch(url.toString(), {
      headers: secret ? { 'X-Service-Secret': secret } : {},
      signal: AbortSignal.timeout(30000), // crawling takes longer
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ── Batch crawl — all candidates at once ──────────────────────────────────────
async function batchCrawlSelfHosted(
  domains: string[],
  serviceUrl: string,
  secret: string,
): Promise<Record<string, { emails: string[]; phones: string[] }>> {
  try {
    const res = await fetch(new URL('/batch-crawl', serviceUrl).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'X-Service-Secret': secret } : {}),
      },
      body: JSON.stringify({ domains }),
      signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) return {}
    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map: Record<string, { emails: string[]; phones: string[] }> = {}
    for (const r of (data.results ?? []) as any[]) {
      map[r.domain] = { emails: r.emails ?? [], phones: r.phones ?? [] }
    }
    return map
  } catch {
    return {}
  }
}

// ── Hunter.io Domain Search (fallback — 25 free/month) ────────────────────────
async function hunterDomainSearch(domain: string, apiKey: string): Promise<{ email: string; name: string; title: string } | null> {
  try {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0]
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(cleanDomain)}&limit=3&api_key=${apiKey}`,
      { signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const emails: Array<{ value: string; first_name?: string; last_name?: string; position?: string }> = data?.data?.emails || []
    if (emails.length === 0) return null
    // Prefer non-generic emails (personal over info@, hello@)
    const personal = emails.find(e => e.first_name && !['info', 'hello', 'contact', 'support', 'admin'].includes(e.value.split('@')[0]))
    const best = personal || emails[0]
    const firstName = best.first_name || ''
    const lastName = best.last_name || ''
    return {
      email: best.value,
      name: [firstName, lastName].filter(Boolean).join(' ') || '',
      title: best.position || '',
    }
  } catch {
    return null
  }
}

// ── Contact page email scraper (fallback, no key needed) ──────────────────────
async function scrapeContactEmail(website: string): Promise<string | null> {
  try {
    const base = website.startsWith('http') ? website : `https://${website}`
    for (const path of ['/contact', '/contact-us', '/about', '']) {
      try {
        const res = await fetch(`${base}${path}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CooVex/1.0 lead-finder)' },
          signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) continue
        const html = await res.text()
        const match = html.match(/\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/)
        if (match && !match[0].includes('example.com') && !match[0].includes('sentry')) {
          return match[0]
        }
      } catch { continue }
    }
  } catch { /* ignore */ }
  return null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
    const { data: business } = await supabase.from('businesses')
      .select('id').eq('workspace_id', profile?.current_workspace_id ?? '').maybeSingle()
    if (!business) return NextResponse.json({ search: null })

    const { data: search } = await supabase
      .from('lead_searches')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ search })
  } catch {
    return NextResponse.json({ search: null })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { audit_id } = await request.json().catch(() => ({}))

    // Fetch selected audit
    const { data: audit } = audit_id
      ? await supabase.from('audits').select('report_json').eq('id', audit_id).single()
      : { data: null }

    // Business profile
    const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
    const { data: business } = await supabase.from('businesses')
      .select('id, name, industry, target_customer, website_intel')
      .eq('workspace_id', profile?.current_workspace_id ?? '')
      .maybeSingle()

    if (!business) return NextResponse.json({ error: 'No business found' }, { status: 400 })

    const anthropicKey = process.env.ANTHROPIC_API_KEY
    const tavilyKey = process.env.TAVILY_API_KEY
    const hunterKey = process.env.HUNTER_API_KEY
    const searchServiceUrl = process.env.SEARCH_SERVICE_URL  // e.g. http://123.45.67.89:8080
    const searchServiceSecret = process.env.SEARCH_SERVICE_SECRET ?? ''

    const hasSelfHosted = !!(searchServiceUrl)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const auditIntel = (audit?.report_json as any)?.intel ?? null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bizIntel = (business.website_intel as any) ?? null
    const intel = auditIntel ?? bizIntel ?? {}

    const hasTavily = !hasSelfHosted && !!(tavilyKey && tavilyKey !== 'your_tavily_api_key')
    const hasHunter = !hasSelfHosted && !!(hunterKey && hunterKey !== 'your_hunter_api_key')

    // No Claude key → return mock
    if (!anthropicKey || anthropicKey === 'your_anthropic_api_key') {
      return NextResponse.json({
        icp: mockICP(business, intel),
        candidates: mockCandidates(),
        has_real_results: false,
        setup: { self_hosted: hasSelfHosted, tavily: hasTavily, hunter: hasHunter },
      })
    }

    const client = new Anthropic({ apiKey: anthropicKey })

    // ── Step 1: Generate ICP ─────────────────────────────────────────────────
    const icpMsg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages: [{
        role: 'user',
        content: `Generate an Ideal Customer Profile (ICP) and 4 targeted search queries to find companies that would buy this service.

Business: ${business.name}
Services: ${intel.services?.join(', ') || business.industry || '—'}
Target market: ${intel.target_market || business.target_customer || '—'}
Unique value: ${intel.unique_value_proposition || '—'}
Pricing: ${intel.pricing_model || '—'}

Search queries should find REAL COMPANY WEBSITES (not blogs, not Wikipedia). E.g. "marketing agency case studies linkedin content" or "B2B software company content team".

Return JSON only:
{
  "company_types": ["type1", "type2", "type3"],
  "company_size": "e.g. 10–200 employees",
  "decision_maker_titles": ["Title1", "Title2", "Title3"],
  "industries": ["industry1", "industry2"],
  "pain_points": ["pain1", "pain2", "pain3"],
  "search_queries": ["query1", "query2", "query3", "query4"]
}`,
      }],
    })

    const icpText = icpMsg.content[0].type === 'text' ? icpMsg.content[0].text : ''
    const icpMatch = icpText.match(/\{[\s\S]*\}/)
    let icp: ICP
    try { icp = icpMatch ? JSON.parse(icpMatch[0]) : mockICP(business, intel) }
    catch { icp = mockICP(business, intel) }

    // ── Step 2: Search ───────────────────────────────────────────────────────
    let allResults: TavilyResult[] = []
    let hasRealResults = false

    if (hasSelfHosted) {
      // Self-hosted VPS search service — free, no API key
      const searchPromises = icp.search_queries.slice(0, 3).map(q =>
        searchSelfHosted(q, searchServiceUrl!, searchServiceSecret)
      )
      const searchResults = await Promise.all(searchPromises)
      allResults = searchResults.flat()
      hasRealResults = allResults.length > 0
    } else if (hasTavily) {
      const searchPromises = icp.search_queries.slice(0, 3).map(q => searchTavily(q, tavilyKey!))
      const searchResults = await Promise.all(searchPromises)
      allResults = searchResults.flat()
      hasRealResults = allResults.length > 0
    }

    // ── Step 3: Extract or generate candidates ───────────────────────────────
    let candidates: LeadCandidate[] = []

    if (hasRealResults) {
      // Claude extracts leads from real search results
      const extractMsg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Extract potential B2B leads from these search results. We are selling: ${intel.services?.join(', ') || business.industry} to ${intel.target_market || 'businesses'}.

Search results:
${allResults.slice(0, 10).map((r, i) => `${i + 1}. ${r.title}\n${r.content?.slice(0, 200)}\nURL: ${r.url}`).join('\n\n')}

Rules:
- Only extract actual companies (not directories, Wikipedia, news articles)
- Infer company name from URL/title if not explicit
- Estimate fit score: how likely do they need "${intel.services?.[0] || 'this service'}"?

Return JSON array (5–8 items max):
[
  {
    "name": "FirstName LastName (if found) OR Company + ' Team'",
    "company": "Company Name",
    "title": "Job title or null",
    "website": "domain.com (no https://)",
    "email": null,
    "phone": null,
    "fit_score": 78,
    "fit_reason": "One sentence why they need this service",
    "source": "full URL",
    "is_real": true
  }
]
Return [] if no good candidates.`,
        }],
      })

      const extractText = extractMsg.content[0].type === 'text' ? extractMsg.content[0].text : '[]'
      const extractMatch = extractText.match(/\[[\s\S]*\]/)
      try { if (extractMatch) candidates = JSON.parse(extractMatch[0]) }
      catch { candidates = [] }
    }

    // Fallback: Claude generates realistic fictional profiles from ICP
    if (candidates.length === 0) {
      const profileMsg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        messages: [{
          role: 'user',
          content: `Generate 6 realistic lead profiles for companies that would buy: "${intel.services?.join(', ') || business.industry}".

ICP: ${icp.company_types.slice(0, 2).join(', ')}, ${icp.company_size}, targeting ${icp.decision_maker_titles.slice(0, 2).join(', ')}.
Pain points: ${icp.pain_points.join('; ')}

Use real-sounding but FICTIONAL names and companies. Vary industries and company sizes.
Return JSON array:
[
  {
    "name": "FirstName LastName",
    "company": "Company Name",
    "title": "Specific Job Title",
    "website": "companyname.com",
    "email": null,
    "phone": null,
    "fit_score": 82,
    "fit_reason": "Specific, concrete reason they need this service",
    "source": null,
    "is_real": false
  }
]`,
        }],
      })

      const profileText = profileMsg.content[0].type === 'text' ? profileMsg.content[0].text : '[]'
      const profileMatch = profileText.match(/\[[\s\S]*\]/)
      try { if (profileMatch) candidates = JSON.parse(profileMatch[0]) }
      catch { candidates = [] }

      if (candidates.length === 0) candidates = mockCandidates()
    }

    // ── Step 4: Contact enrichment (email + phone) ──────────────────────────
    const realCandidates = candidates.slice(0, 8).filter(c => c.is_real && c.website)
    const otherCandidates = candidates.slice(0, 8).filter(c => !c.is_real || !c.website)

    let enriched: LeadCandidate[] = [...candidates.slice(0, 8)]

    if (hasSelfHosted && realCandidates.length > 0) {
      // Batch crawl all real candidate websites at once — emails + phones
      const domains = realCandidates.map(c => c.website!.replace(/^https?:\/\//, '').split('/')[0])
      const crawlMap = await batchCrawlSelfHosted(domains, searchServiceUrl!, searchServiceSecret)

      enriched = candidates.slice(0, 8).map((c): LeadCandidate => {
        if (!c.is_real || !c.website) return c
        const domain = c.website.replace(/^https?:\/\//, '').split('/')[0]
        const crawled = crawlMap[domain]
        if (!crawled) return c
        return {
          ...c,
          email: c.email || crawled.emails[0] || undefined,
          phone: c.phone || crawled.phones[0] || undefined,
          all_emails: crawled.emails,
          all_phones: crawled.phones,
        }
      })
    } else {
      // Fallback: Hunter.io or direct scrape per candidate
      enriched = await Promise.all(
        candidates.slice(0, 8).map(async (c) => {
          if (c.email || !c.website || !c.is_real) return c

          if (hasHunter) {
            const hunterResult = await hunterDomainSearch(c.website, hunterKey!)
            if (hunterResult?.email) {
              return {
                ...c,
                email: hunterResult.email,
                name: hunterResult.name && !c.name.includes('@') ? hunterResult.name : c.name,
                title: hunterResult.title || c.title,
              }
            }
          }

          const email = await scrapeContactEmail(c.website)
          if (email) return { ...c, email }
          return c
        })
      )
    }
    void otherCandidates // consumed via enriched above

    // Save to DB (best-effort, requires lead_searches migration)
    try {
      await supabase.from('lead_searches').insert({
        business_id: business.id,
        audit_id: audit_id || null,
        icp,
        candidates: enriched,
        has_real_results: hasRealResults,
      })
    } catch { /* table may not exist yet */ }

    return NextResponse.json({
      icp,
      candidates: enriched,
      has_real_results: hasRealResults,
      setup: { self_hosted: hasSelfHosted, tavily: hasTavily, hunter: hasHunter },
    })

  } catch (error) {
    console.error('POST /api/leads/find error:', error)
    return NextResponse.json({ error: 'Failed to find leads' }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockICP(business: any, intel: any): ICP {
  return {
    company_types: ['B2B SaaS', 'Marketing Agency', 'Consulting Firm'],
    company_size: '10–200 employees',
    decision_maker_titles: ['CEO', 'Marketing Director', 'Head of Growth'],
    industries: [business.industry || 'Technology', 'Professional Services'],
    pain_points: [
      `Struggling to scale ${intel.services?.[0] || 'marketing'} efficiently`,
      'No dedicated team for digital presence',
      'Difficulty measuring content ROI',
    ],
    search_queries: [
      `${business.industry || 'B2B'} companies marketing automation`,
      `small business ${business.industry || 'software'} growth`,
    ],
  }
}

function mockCandidates(): LeadCandidate[] {
  return [
    { name: 'Sarah Chen', company: 'GrowthEdge Agency', title: 'Founder', website: 'growthedge.io', fit_score: 88, fit_reason: 'Marketing agency actively seeking AI tools for client content workflows', is_real: false },
    { name: 'Marcus Webb', company: 'TechFlow Solutions', title: 'Head of Marketing', website: 'techflowsolutions.com', fit_score: 82, fit_reason: 'B2B SaaS company needing scalable lead generation', is_real: false },
    { name: 'Priya Nair', company: 'Nexus Consulting', title: 'CEO', website: 'nexusconsulting.com', fit_score: 79, fit_reason: 'Consulting firm expanding digital presence', is_real: false },
    { name: 'David Lim', company: 'ScaleUp Labs', title: 'Growth Director', website: 'scaleuplabs.co', fit_score: 74, fit_reason: 'Startup accelerator managing marketing for portfolio companies', is_real: false },
  ]
}
