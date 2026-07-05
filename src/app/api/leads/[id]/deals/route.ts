import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: deals } = await supabase
    .from('deals')
    .select('id, value, currency, close_date, probability, status, created_at')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ deals: deals ?? [] })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    value: number
    currency?: string
    close_date?: string
    probability?: number
    status?: string
  }

  const { data: lead } = await supabase.from('leads').select('business_id, stage').eq('id', id).single()
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const { data: deal, error } = await supabase.from('deals').insert({
    lead_id:     id,
    business_id: lead.business_id,
    value:       body.value,
    currency:    body.currency ?? 'USD',
    close_date:  body.close_date ?? null,
    probability: body.probability ?? 50,
    status:      body.status ?? 'open',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deal })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { deal_id: string; value?: number; currency?: string; close_date?: string; probability?: number; status?: string }
  const { deal_id, ...updates } = body

  const { data: deal, error } = await supabase
    .from('deals').update(updates).eq('id', deal_id).eq('lead_id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deal })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { deal_id } = await req.json() as { deal_id: string }
  await supabase.from('deals').delete().eq('id', deal_id).eq('lead_id', id)
  return NextResponse.json({ ok: true })
}
