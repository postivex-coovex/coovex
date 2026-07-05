import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Maps external CRM stages → our stages
const HUBSPOT_STAGE_MAP: Record<string, string> = {
  appointmentscheduled:  'contacted',
  qualifiedtobuy:        'qualified',
  presentationscheduled: 'qualified',
  decisionmakerboughtin: 'proposal',
  contractsent:          'negotiation',
  closedwon:             'won',
  closedlost:            'lost',
}
const PIPEDRIVE_STAGE_MAP: Record<string, string> = {
  won:  'won',
  lost: 'lost',
  open: 'proposal',
}

async function syncHubSpot(apiKey: string, businessId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  let after: string | null = null
  let total = 0
  const synced: string[] = []

  while (true) {
    const url = new URL('https://api.hubapi.com/crm/v3/objects/deals')
    url.searchParams.set('limit', '100')
    url.searchParams.set('properties', 'dealname,amount,closedate,dealstage,pipeline,hs_lastmodifieddate,hubspot_owner_id')
    if (after) url.searchParams.set('after', after)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    })
    if (!res.ok) throw new Error(`HubSpot API error: ${res.status} ${await res.text()}`)
    const json = await res.json() as {
      results: { id: string; properties: Record<string, string | null> }[]
      paging?: { next?: { after: string } }
    }

    for (const deal of json.results) {
      const p       = deal.properties
      const stage   = HUBSPOT_STAGE_MAP[p.dealstage ?? ''] ?? 'new'
      const status  = stage === 'won' ? 'won' : stage === 'lost' ? 'lost' : 'open'
      const crmId   = `hubspot:deal:${deal.id}`
      const value   = parseFloat(p.amount ?? '0') || 0
      const company = p.dealname ?? 'HubSpot Deal'

      // Upsert lead
      const { data: existingLead } = await supabase.from('leads')
        .select('id').eq('business_id', businessId).eq('crm_id', `hubspot:contact:${deal.id}`).maybeSingle()

      let leadId = existingLead?.id
      if (!leadId) {
        const { data: newLead } = await supabase.from('leads').insert({
          business_id: businessId,
          name:        company,
          company:     company,
          stage:       stage === 'won' || stage === 'lost' ? stage : stage,
          source:      'crm_import',
          score:       50,
          crm_id:      `hubspot:contact:${deal.id}`,
        }).select('id').single()
        leadId = newLead?.id
      } else {
        await supabase.from('leads').update({ stage }).eq('id', leadId)
      }

      if (!leadId) continue

      // Check-then-insert/update deal (avoids partial index upsert issues)
      const { data: existingDeal } = await supabase.from('deals')
        .select('id').eq('crm_id', crmId).maybeSingle()

      const dealPayload = {
        business_id: businessId,
        lead_id:     leadId,
        value:       value,
        currency:    'USD',
        close_date:  p.closedate ? p.closedate.slice(0, 10) : null,
        probability: status === 'won' ? 100 : status === 'lost' ? 0 : 50,
        status:      status,
        crm_id:      crmId,
      }
      if (existingDeal?.id) {
        await supabase.from('deals').update(dealPayload).eq('id', existingDeal.id)
      } else {
        await supabase.from('deals').insert(dealPayload)
      }

      synced.push(crmId)
      total++
    }

    if (!json.paging?.next?.after) break
    after = json.paging.next.after
    if (total >= 500) break // safety cap
  }

  return total
}

async function syncPipedrive(apiKey: string, businessId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  let start = 0
  let total = 0

  while (true) {
    const url = `https://api.pipedrive.com/api/v1/deals?api_token=${apiKey}&status=all&limit=100&start=${start}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Pipedrive API error: ${res.status}`)
    const json = await res.json() as {
      success: boolean
      data: null | { id: number; title: string; value: number; currency: string; stage_id: number; status: string; won_time: string | null; close_time: string | null; expected_close_date: string | null }[]
      additional_data: { pagination?: { has_more_items: boolean; next_start: number } }
    }

    if (!json.success || !json.data) break

    for (const deal of json.data) {
      const stage  = PIPEDRIVE_STAGE_MAP[deal.status] ?? 'proposal'
      const status = deal.status === 'won' ? 'won' : deal.status === 'lost' ? 'lost' : 'open'
      const crmId  = `pipedrive:deal:${deal.id}`
      const closeDate = deal.won_time ?? deal.close_time ?? deal.expected_close_date

      const { data: existingLead } = await supabase.from('leads')
        .select('id').eq('business_id', businessId).eq('crm_id', `pipedrive:deal:${deal.id}`).maybeSingle()

      let leadId = existingLead?.id
      if (!leadId) {
        const { data: newLead } = await supabase.from('leads').insert({
          business_id: businessId,
          name:        deal.title,
          company:     deal.title,
          stage,
          source:      'crm_import',
          score:       50,
          crm_id:      `pipedrive:deal:${deal.id}`,
        }).select('id').single()
        leadId = newLead?.id
      } else {
        await supabase.from('leads').update({ stage }).eq('id', leadId)
      }

      if (!leadId) continue

      const { data: existingDealP } = await supabase.from('deals')
        .select('id').eq('crm_id', crmId).maybeSingle()

      const dealPayloadP = {
        business_id: businessId,
        lead_id:     leadId,
        value:       deal.value || 0,
        currency:    deal.currency || 'USD',
        close_date:  closeDate ? closeDate.slice(0, 10) : null,
        probability: status === 'won' ? 100 : status === 'lost' ? 0 : 50,
        status,
        crm_id:      crmId,
      }
      if (existingDealP?.id) {
        await supabase.from('deals').update(dealPayloadP).eq('id', existingDealP.id)
      } else {
        await supabase.from('deals').insert(dealPayloadP)
      }

      total++
    }

    if (!json.additional_data.pagination?.has_more_items) break
    start = json.additional_data.pagination.next_start
    if (total >= 500) break
  }

  return total
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { crm_type } = await req.json() as { crm_type: 'hubspot' | 'pipedrive' }
  if (!['hubspot', 'pipedrive'].includes(crm_type)) {
    return NextResponse.json({ error: 'Unsupported CRM type' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, integrations').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  // Fetch integration record
  const { data: integration } = await supabase.from('integrations')
    .select('id, meta_json, status').eq('business_id', business.id).eq('type', crm_type).maybeSingle()

  const apiKey = (integration?.meta_json as Record<string, unknown>)?.api_key as string | null

  // Fallback: check business.integrations jsonb (used by other-integrations.tsx)
  const bizIntegrations = (business.integrations as Record<string, Record<string, unknown>> | null) ?? {}
  const fallbackKey = bizIntegrations[crm_type]?.api_key as string | null

  const key = apiKey ?? fallbackKey
  if (!key) {
    return NextResponse.json({ error: `No API key found for ${crm_type}. Connect it in Settings → Integrations first.` }, { status: 400 })
  }

  try {
    let count = 0
    if (crm_type === 'hubspot') {
      count = await syncHubSpot(key, business.id, supabase)
    } else if (crm_type === 'pipedrive') {
      count = await syncPipedrive(key, business.id, supabase)
    }

    // Update integration sync metadata
    const now = new Date().toISOString()
    const existingMeta = (integration?.meta_json as Record<string, unknown>) ?? {}
    const newMeta = { ...existingMeta, last_sync: now, sync_count: count }

    if (integration?.id) {
      await supabase.from('integrations').update({ meta_json: newMeta, status: 'connected', connected_at: now }).eq('id', integration.id)
    } else {
      await supabase.from('integrations').insert({
        business_id: business.id,
        type: crm_type,
        status: 'connected',
        meta_json: { ...newMeta, api_key: key },
        connected_at: now,
      })
    }

    return NextResponse.json({ ok: true, synced: count, last_sync: now })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
