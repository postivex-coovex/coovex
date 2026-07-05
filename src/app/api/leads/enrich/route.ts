import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const VPS_ENRICHER_URL = 'http://82.29.160.236:8091/scraper.php'
const VPS_ENRICHER_KEY = '8677f8f9dd94477206c81bbfe060ed6c91fa5addbddcbe4b'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { domain, website_url } = body as { domain?: string; website_url?: string }

    const target = domain || website_url
    if (!target) return NextResponse.json({ error: 'domain or website_url required' }, { status: 400 })

    const cleanDomain = target.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]

    // Return cached enrichment if fresh (< 7 days)
    const service = createServiceClient()
    const { data: existing } = await service
      .from('scraped_lead_details')
      .select('*')
      .eq('domain', cleanDomain)
      .maybeSingle()

    if (existing) {
      const age = Date.now() - new Date(existing.enriched_at).getTime()
      if (age < 7 * 24 * 60 * 60 * 1000) {
        return NextResponse.json({ enrichment: existing, cached: true })
      }
    }

    const res = await fetch(VPS_ENRICHER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': VPS_ENRICHER_KEY,
      },
      body: JSON.stringify({ domain: cleanDomain }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Enricher error: ${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    if (!data.success) {
      return NextResponse.json({ error: data.error ?? 'Scrape failed' }, { status: 200 })
    }

    const row = {
      domain: cleanDomain,
      website_url: website_url || `https://${cleanDomain}`,
      emails: data.emails ?? [],
      phones: data.phones ?? [],
      address: data.address || null,
      brand_name: data.brand_name || null,
      title: data.title || null,
      description: data.description || null,
      technologies: data.technologies ?? [],
      products_services: data.products_services ?? [],
      pain_points: data.pain_points ?? [],
      solutions_offered: data.solutions_offered ?? [],
      social_links: data.social_links ?? [],
      enriched_at: new Date().toISOString(),
    }

    const { data: upserted } = await service
      .from('scraped_lead_details')
      .upsert(row, { onConflict: 'domain' })
      .select()
      .single()

    return NextResponse.json({ enrichment: upserted ?? row, cached: false })
  } catch (error) {
    console.error('POST /api/leads/enrich error:', error)
    return NextResponse.json({ error: 'Failed to enrich lead' }, { status: 500 })
  }
}
