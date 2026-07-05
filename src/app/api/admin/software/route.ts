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

// ─── GET: all software ────────────────────────────────────────────────────────

export async function GET() {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('software_catalog')
    .select('*')
    .order('category')
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ software: data })
}

// ─── POST: add new software ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { name, slug, category, tagline, description, website, pricing_model, price_from, features, integrations, best_for_industries, best_for_sizes, rating, is_coovex_pick, affiliate_url, sort_order } = body

  if (!name || !slug || !category) {
    return NextResponse.json({ error: 'name, slug, and category are required' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('software_catalog')
    .insert({
      name, slug, category, tagline, description, website,
      pricing_model: pricing_model ?? 'paid',
      price_from: price_from ?? 0,
      features: features ?? [],
      integrations: integrations ?? [],
      best_for_industries: best_for_industries ?? [],
      best_for_sizes: best_for_sizes ?? [],
      rating: rating ?? 4.0,
      is_coovex_pick: is_coovex_pick ?? false,
      affiliate_url,
      sort_order: sort_order ?? 0,
      active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ software: data })
}

// ─── PUT: update software ─────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('software_catalog')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ software: data })
}

// ─── DELETE: remove software ──────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const service = createServiceClient()
  const { error } = await service
    .from('software_catalog')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
