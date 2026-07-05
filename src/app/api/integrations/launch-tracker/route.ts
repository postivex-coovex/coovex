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

// GET — returns { data: Record<platformId, { status, url, notes }> }
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ data: {} })

  const { data: rows } = await supabase
    .from('launch_tracker_platforms')
    .select('platform_id, status, url, notes')
    .eq('business_id', ctx.bizId)

  const data: Record<string, { status: string; url: string; notes: string }> = {}
  for (const r of rows ?? []) {
    data[r.platform_id] = { status: r.status, url: r.url ?? '', notes: r.notes ?? '' }
  }

  return NextResponse.json({ data })
}

// PATCH — body: Record<platformId, { status, url, notes }> (partial update)
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const body = await req.json().catch(() => ({})) as Record<string, { status?: string; url?: string; notes?: string }>

  const upserts = Object.entries(body).map(([platform_id, vals]) => ({
    workspace_id: ctx.wsId,
    business_id: ctx.bizId,
    platform_id,
    status: vals.status ?? 'not_started',
    url: vals.url ?? null,
    notes: vals.notes ?? null,
    updated_at: new Date().toISOString(),
  }))

  if (upserts.length === 0) return NextResponse.json({ ok: true })

  const { error } = await supabase
    .from('launch_tracker_platforms')
    .upsert(upserts, { onConflict: 'business_id,platform_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
