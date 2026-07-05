import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getContext(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', userId).single()
  const wsId = profile?.current_workspace_id
  if (!wsId) return null
  const { data: biz } = await supabase.from('businesses').select('id').eq('workspace_id', wsId).maybeSingle()
  if (!biz) return null
  return { wsId, bizId: biz.id }
}

// GET — load all execution plans for this business
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ plans: [] })

  const { data: plans } = await supabase
    .from('execution_plans')
    .select('id, product, plan_json, steps_done, updated_at')
    .eq('business_id', ctx.bizId)
    .order('updated_at', { ascending: false })

  return NextResponse.json({ plans: plans ?? [] })
}

// POST — save/update an execution plan (upsert by product)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found' }, { status: 400 })

  const { product, plan_json } = await req.json()
  if (!plan_json) return NextResponse.json({ error: 'plan_json required' }, { status: 400 })

  const productKey = product || 'Overall Business'

  const { data, error } = await supabase
    .from('execution_plans')
    .upsert({
      workspace_id: ctx.wsId,
      business_id: ctx.bizId,
      product: productKey,
      plan_json,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'business_id,product' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

// PATCH — update just the steps_done for a product
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found' }, { status: 400 })

  const { product, steps_done } = await req.json()
  const productKey = product || 'Overall Business'

  const { error } = await supabase
    .from('execution_plans')
    .update({ steps_done, updated_at: new Date().toISOString() })
    .eq('business_id', ctx.bizId)
    .eq('product', productKey)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
