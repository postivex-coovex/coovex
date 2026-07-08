import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { deductCredits, getWorkspaceId } from '@/lib/credits'

export const maxDuration = 300

const VPS_SCRAPER_URL = 'http://82.29.160.236:8000'
const VPS_SCRAPER_KEY = '88a112be6c56b840c3d8eee98c55fe7a9f7423ab1e2af5e6'

interface ScrapeResult {
  business_unique_id: string
  keyword: string
  country: string
  city: string
  google_rank_title: string
  website_url: string
  scrapping_date: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { keyword, country, city } = body as { keyword?: string; country?: string; city?: string }

    if (!keyword?.trim()) {
      return NextResponse.json({ error: 'keyword is required' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles').select('current_workspace_id').eq('id', user.id).single()
    const { data: business } = await supabase
      .from('businesses').select('id').eq('workspace_id', profile?.current_workspace_id ?? '').maybeSingle()
    if (!business) return NextResponse.json({ error: 'No business found' }, { status: 400 })

    // Deduct 10 credits per search
    const workspaceId = await getWorkspaceId(user.id)
    let creditBalance: number | undefined
    if (workspaceId) {
      const credit = await deductCredits(workspaceId, 'keyword_lead_scrape', `Lead scrape: ${keyword}`)
      if (!credit.ok) return NextResponse.json({ error: credit.error ?? 'Insufficient credits' }, { status: 402 })
      creditBalance = credit.balance
    }

    const res = await fetch(`${VPS_SCRAPER_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': VPS_SCRAPER_KEY,
      },
      body: JSON.stringify({
        business_unique_id: business.id,
        keyword: keyword.trim(),
        country: country || '',
        city: city || '',
        limit: 20,
      }),
      signal: AbortSignal.timeout(240_000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return NextResponse.json({ error: `Scraper error: ${res.status} ${errText}` }, { status: 502 })
    }

    const results: ScrapeResult[] = await res.json()

    if (results.length === 0) {
      return NextResponse.json({ leads: [], message: 'No new leads found for this combination.' })
    }

    // Store in global table (upsert — same keyword+url won't duplicate)
    const service = createServiceClient()
    const rows = results.map(r => ({
      keyword: r.keyword,
      country: r.country || null,
      city: r.city || null,
      google_rank_title: r.google_rank_title || null,
      website_url: r.website_url,
      domain: (() => { try { return new URL(r.website_url).hostname.replace(/^www\./, '') } catch { return r.website_url } })(),
      scrapping_date: r.scrapping_date || new Date().toISOString().split('T')[0],
    }))

    const { data: inserted, error: dbErr } = await service
      .from('scraped_leads_global')
      .upsert(rows, { onConflict: 'keyword,website_url' })
      .select('id, keyword, country, city, google_rank_title, website_url, domain, scrapping_date')

    if (dbErr) {
      console.error('scraped_leads_global upsert error:', dbErr)
    }

    const leads = inserted ?? rows.map(r => ({ ...r, id: null }))

    // Attach any existing enrichment data
    const domains = leads.map(l => l.domain).filter(Boolean)
    const { data: enrichments } = await service
      .from('scraped_lead_details')
      .select('domain, emails, phones, address, brand_name, title, technologies, products_services')
      .in('domain', domains)

    const enrichMap = new Map(enrichments?.map(e => [e.domain, e]) ?? [])
    const leadsWithEnrichment = leads.map(l => ({
      ...l,
      enrichment: l.domain ? enrichMap.get(l.domain) ?? null : null,
    }))

    return NextResponse.json({ leads: leadsWithEnrichment }, creditBalance !== undefined ? { headers: { 'X-Credits-Remaining': String(creditBalance) } } : undefined)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('POST /api/leads/scrape error:', msg)
    return NextResponse.json({ error: 'Failed to find leads', detail: msg }, { status: 500 })
  }
}
