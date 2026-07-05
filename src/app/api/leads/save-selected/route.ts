import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

interface LeadToSave {
  scraped_lead_id?: string
  website_url: string
  domain: string
  google_rank_title?: string
  keyword?: string
  country?: string
  city?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { business_id, leads } = body as { business_id: string; leads: LeadToSave[] }

    if (!business_id || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'business_id and leads[] required' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles').select('current_workspace_id').eq('id', user.id).single()
    const { data: business } = await supabase
      .from('businesses').select('id')
      .eq('id', business_id)
      .eq('workspace_id', profile?.current_workspace_id ?? '')
      .single()
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

    const service = createServiceClient()

    // Fetch any enrichment data for these domains
    const domains = leads.map(l => l.domain).filter(Boolean)
    const { data: enrichments } = await service
      .from('scraped_lead_details')
      .select('domain, emails, phones, address, brand_name')
      .in('domain', domains)

    const enrichMap = new Map(enrichments?.map(e => [e.domain, e]) ?? [])

    let saved = 0
    let duplicates = 0
    const errors: string[] = []

    for (const lead of leads) {
      const enrichment = lead.domain ? enrichMap.get(lead.domain) : null
      const name = enrichment?.brand_name || lead.google_rank_title || lead.domain || 'Unknown'
      const email = enrichment?.emails?.[0] ?? null
      const phone = enrichment?.phones?.[0] ?? null
      const address = enrichment?.address ?? null

      // Check for duplicate by website
      const { data: dup } = await supabase
        .from('leads')
        .select('id')
        .eq('business_id', business_id)
        .eq('website', lead.website_url)
        .maybeSingle()

      if (dup) {
        duplicates++
        continue
      }

      const { error: insertErr } = await supabase.from('leads').insert({
        business_id,
        name,
        email,
        phone,
        website: lead.website_url,
        source: 'keyword_scraper',
        stage: 'new',
        notes: [
          lead.keyword ? `Keyword: ${lead.keyword}` : '',
          lead.country ? `Location: ${[lead.city, lead.country].filter(Boolean).join(', ')}` : '',
          address ? `Address: ${address}` : '',
        ].filter(Boolean).join('\n') || null,
      })

      if (insertErr) {
        console.error('Lead insert error:', insertErr.message, lead.domain)
        errors.push(lead.domain)
      } else {
        saved++
      }
    }

    return NextResponse.json({ saved, duplicates, errors })
  } catch (error) {
    console.error('POST /api/leads/save-selected error:', error)
    return NextResponse.json({ error: 'Failed to save leads' }, { status: 500 })
  }
}
