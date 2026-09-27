import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/inquiry/submissions?property_id=X&status=new&page=0
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const propertyId = searchParams.get('property_id')
  const status     = searchParams.get('status')   // new | reviewed | archived
  const page       = parseInt(searchParams.get('page') || '0', 10)
  const PAGE_SIZE  = 50

  if (!propertyId) return NextResponse.json({ error: 'property_id required' }, { status: 400 })

  // Verify ownership
  const { data: prop } = await supabase
    .from('inquiry_properties')
    .select('id')
    .eq('id', propertyId)
    .eq('user_id', user.id)
    .single()
  if (!prop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let q = supabase
    .from('inquiry_submissions')
    .select('id, email, domain, extra_fields, is_read, status, source_url, created_at', { count: 'exact' })
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

  if (status) q = q.eq('status', status)

  const { data, count } = await q

  // Collect all unique extra_field keys for dynamic columns
  const fieldKeys = new Set<string>()
  for (const row of data ?? []) {
    if (row.extra_fields && typeof row.extra_fields === 'object') {
      Object.keys(row.extra_fields).forEach(k => fieldKeys.add(k))
    }
  }

  return NextResponse.json({
    submissions: data ?? [],
    total: count ?? 0,
    dynamic_columns: Array.from(fieldKeys),
  })
}

// PATCH /api/inquiry/submissions — update status / mark read
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status, is_read } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (status   !== undefined) update.status  = status
  if (is_read  !== undefined) update.is_read = is_read

  const { error } = await supabase
    .from('inquiry_submissions')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
