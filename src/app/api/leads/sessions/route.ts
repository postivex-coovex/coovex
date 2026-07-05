import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('current_workspace_id').eq('id', user.id).single()
    const { data: business } = await supabase
      .from('businesses').select('id').eq('workspace_id', profile?.current_workspace_id ?? '').maybeSingle()
    if (!business) return NextResponse.json({ sessions: [] })

    const service = createServiceClient()

    const { data: dbSessions } = await service
      .from('lead_sessions')
      .select('*')
      .eq('business_id', business.id)
      .order('updated_at', { ascending: false })

    if (!dbSessions || dbSessions.length === 0) return NextResponse.json({ sessions: [] })

    const allLeadIds = [...new Set(dbSessions.flatMap(s => s.scraped_lead_ids ?? []))]

    const leadsMap = new Map<string, object>()
    if (allLeadIds.length > 0) {
      const { data: globalLeads } = await service
        .from('scraped_leads_global')
        .select('*')
        .in('id', allLeadIds)

      const domains = (globalLeads ?? []).map((l: { domain?: string }) => l.domain).filter(Boolean)
      const { data: enrichments } = domains.length > 0
        ? await service.from('scraped_lead_details')
            .select('domain, emails, phones, address, brand_name, title, technologies, products_services')
            .in('domain', domains)
        : { data: [] }

      const enrichMap = new Map((enrichments ?? []).map((e: { domain: string }) => [e.domain, e]))

      for (const lead of (globalLeads ?? [])) {
        leadsMap.set(lead.id, {
          ...lead,
          enrichment: lead.domain ? (enrichMap.get(lead.domain) ?? null) : null,
        })
      }
    }

    const sessions = dbSessions.map(s => ({
      id: s.id,
      keyword: s.keyword,
      country: s.country,
      city: s.city,
      leads: (s.scraped_lead_ids ?? []).map((id: string) => leadsMap.get(id)).filter(Boolean),
      savedAt: new Date(s.updated_at).getTime(),
    }))

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('GET /api/leads/sessions error:', error)
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { keyword, country, city, lead_ids } = await request.json()
    if (!keyword) return NextResponse.json({ error: 'keyword required' }, { status: 400 })

    const { data: profile } = await supabase
      .from('profiles').select('current_workspace_id').eq('id', user.id).single()
    const { data: business } = await supabase
      .from('businesses').select('id').eq('workspace_id', profile?.current_workspace_id ?? '').maybeSingle()
    if (!business) return NextResponse.json({ error: 'No business found' }, { status: 400 })

    const service = createServiceClient()

    const { data } = await service
      .from('lead_sessions')
      .upsert({
        business_id: business.id,
        keyword,
        country: country ?? '',
        city: city ?? '',
        scraped_lead_ids: lead_ids ?? [],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'business_id,keyword,country,city' })
      .select('id')
      .single()

    return NextResponse.json({ ok: true, id: data?.id })
  } catch (error) {
    console.error('POST /api/leads/sessions error:', error)
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 })
  }
}
