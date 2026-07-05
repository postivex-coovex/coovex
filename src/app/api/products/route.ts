import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ products: [] })

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', business.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  // Lead counts per product
  const { data: leadCounts } = await supabase
    .from('leads')
    .select('product_id')
    .eq('business_id', business.id)
    .not('product_id', 'is', null)

  const countMap: Record<string, number> = {}
  for (const l of leadCounts ?? []) {
    if (l.product_id) countMap[l.product_id] = (countMap[l.product_id] ?? 0) + 1
  }

  return NextResponse.json({
    products: (products ?? []).map(p => ({ ...p, lead_count: countMap[p.id] ?? 0 })),
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, type, tagline, description, price, price_unit, currency, category, target_audience, key_benefits, status } = body

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const { data: product, error } = await supabase.from('products').insert({
    business_id: business.id,
    name, type: type || 'service', tagline, description,
    price: price || null, price_unit: price_unit || 'one-time', currency: currency || 'USD',
    category, target_audience, key_benefits, status: status || 'active',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ product })
}
