import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: site, error } = await supabase
    .from('monitored_websites')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Notes visibility check for non-owners
  const isOwner = site.user_id === user.id
  if (!isOwner) {
    if (site.notes_visibility !== 'team') {
      site.credential_notes = null
    } else {
      // Verify same workspace
      const [ownerP, viewerP] = await Promise.all([
        supabase.from('profiles').select('current_workspace_id').eq('id', site.user_id).single(),
        supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single(),
      ])
      const sameWs = ownerP.data?.current_workspace_id === viewerP.data?.current_workspace_id
      if (!sameWs) site.credential_notes = null
    }
    // Non-owners can't see alert email list
    site.alert_emails = []
  }

  return NextResponse.json(site)
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: site } = await supabase.from('monitored_websites').select('user_id').eq('id', id).single()
  if (!site || site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const allowed = ['name','url','is_active','alert_emails','alert_on_down','alert_on_ssl_expiry','alert_on_domain_expiry','alert_on_slow_load','slow_load_threshold_ms','credential_notes','notes_visibility']
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  for (const key of allowed) {
    if (key in body) {
      if (key === 'alert_emails' && typeof body[key] === 'string') {
        patch[key] = body[key].split(',').map((e: string) => e.trim()).filter(Boolean)
      } else {
        patch[key] = body[key]
      }
    }
  }

  const { data, error } = await supabase
    .from('monitored_websites')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: site } = await supabase.from('monitored_websites').select('user_id').eq('id', id).single()
  if (!site || site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await supabase.from('monitored_websites').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
