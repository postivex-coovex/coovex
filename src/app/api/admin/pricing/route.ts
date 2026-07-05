import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')) return null
  return user
}

// GET — fetch all plans + credit costs
export async function GET() {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const [{ data: plans }, { data: costs }] = await Promise.all([
    service.from('pricing_plans').select('*').order('sort_order'),
    service.from('credit_cost_settings').select('*').order('tier').order('cost'),
  ])
  return NextResponse.json({ plans: plans ?? [], costs: costs ?? [] })
}

// POST — update a plan or credit cost
export async function POST(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const service = createServiceClient()

  // Update pricing plan
  if (body.type === 'plan') {
    const { id, ...fields } = body.data
    const { error } = await service
      .from('pricing_plans')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Update credit cost
  if (body.type === 'cost') {
    const { id, ...fields } = body.data
    const { error } = await service
      .from('credit_cost_settings')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}

// PUT — add a new credit cost row
export async function PUT(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const service = createServiceClient()

  const { error, data } = await service
    .from('credit_cost_settings')
    .insert({ ...body, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}

// DELETE — remove a credit cost row
export async function DELETE(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const service = createServiceClient()

  const { error } = await service.from('credit_cost_settings').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
