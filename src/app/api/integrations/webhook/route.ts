/**
 * Generic webhook endpoint for custom CRM / external systems.
 *
 * POST /api/integrations/webhook
 * Header: x-coovex-token: <your_webhook_token>
 *
 * Body (JSON):
 * {
 *   "event": "deal.created" | "deal.updated" | "deal.won" | "deal.lost" | "lead.created",
 *   "deal": {
 *     "id": "your_crm_id",          // used for deduplication
 *     "name": "Contact / Deal Name",
 *     "company": "Company Name",
 *     "email": "contact@email.com",
 *     "value": 2500,
 *     "currency": "USD",            // default USD
 *     "close_date": "2026-07-15",   // YYYY-MM-DD
 *     "probability": 75,            // 0-100
 *     "status": "open" | "won" | "lost",
 *     "stage": "proposal" | "negotiation" | ...
 *   }
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const STAGE_MAP: Record<string, string> = {
  new: 'new', lead: 'new', prospect: 'new',
  contacted: 'contacted', outreach: 'contacted',
  qualified: 'qualified',
  proposal: 'proposal', proposal_sent: 'proposal', demo: 'proposal',
  negotiation: 'negotiation', contract: 'negotiation',
  won: 'won', closed_won: 'won',
  lost: 'lost', closed_lost: 'lost',
}

export async function POST(req: NextRequest) {
  // Accept token from header OR query param (easier for simple CRM webhooks)
  const token = req.headers.get('x-coovex-token') ?? req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token (use x-coovex-token header or ?token= query param)' }, { status: 401 })

  const supabase = createServiceClient()

  // Find the business by webhook token (stored as embed_token on businesses table)
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('embed_token', token)
    .maybeSingle()

  if (!business) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  let body: {
    event?: string
    deal?: {
      id?: string
      name?: string
      company?: string
      email?: string
      phone?: string
      value?: number
      currency?: string
      close_date?: string
      probability?: number
      status?: string
      stage?: string
    }
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const d = body.deal
  if (!d) return NextResponse.json({ error: 'Missing "deal" object in body' }, { status: 400 })

  const crmId   = d.id ? `webhook:${d.id}` : null
  const status  = d.status === 'won' ? 'won' : d.status === 'lost' ? 'lost' : 'open'
  const stage   = STAGE_MAP[d.stage ?? status] ?? (status === 'won' ? 'won' : status === 'lost' ? 'lost' : 'proposal')

  // Find or create lead
  let leadId: string | null = null

  if (crmId) {
    const { data: existing } = await supabase.from('leads')
      .select('id').eq('business_id', business.id).eq('crm_id', crmId).maybeSingle()
    leadId = existing?.id ?? null
  }

  if (!leadId && d.email) {
    const { data: byEmail } = await supabase.from('leads')
      .select('id').eq('business_id', business.id).eq('email', d.email).maybeSingle()
    leadId = byEmail?.id ?? null
  }

  if (!leadId) {
    const { data: newLead } = await supabase.from('leads').insert({
      business_id: business.id,
      name:        d.name ?? 'Unknown',
      company:     d.company ?? null,
      email:       d.email ?? null,
      phone:       d.phone ?? null,
      stage,
      source:      'crm_import',
      score:       50,
      crm_id:      crmId,
    }).select('id').single()
    leadId = newLead?.id ?? null
  } else {
    await supabase.from('leads').update({ stage, company: d.company ?? undefined }).eq('id', leadId)
  }

  if (!leadId) return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })

  // Find or create deal
  let dealId: string | null = null
  if (crmId) {
    const { data: existingDeal } = await supabase.from('deals')
      .select('id').eq('crm_id', crmId).maybeSingle()
    dealId = existingDeal?.id ?? null
  }

  const dealPayload = {
    business_id: business.id,
    lead_id:     leadId,
    value:       d.value ?? 0,
    currency:    d.currency ?? 'USD',
    close_date:  d.close_date ?? null,
    probability: d.probability ?? (status === 'won' ? 100 : status === 'lost' ? 0 : 50),
    status,
    crm_id:      crmId,
  }

  if (dealId) {
    await supabase.from('deals').update(dealPayload).eq('id', dealId)
  } else {
    const { data: newDeal } = await supabase.from('deals').insert(dealPayload).select('id').single()
    dealId = newDeal?.id ?? null
  }

  return NextResponse.json({ ok: true, lead_id: leadId, deal_id: dealId, event: body.event ?? 'received' })
}
