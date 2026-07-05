import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ config: null })

  const { data } = await supabase
    .from('integrations')
    .select('config, status')
    .eq('business_id', business.id)
    .eq('type', type)
    .maybeSingle()

  return NextResponse.json({ config: data?.config || null, status: data?.status || 'disconnected' })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { credentials, sync_options } = body

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const config = { credentials, sync_options }
  const hasCredentials = credentials && Object.values(credentials).some(v => !!v)

  const { data: existing } = await supabase
    .from('integrations')
    .select('id')
    .eq('business_id', business.id)
    .eq('type', type)
    .maybeSingle()

  const payload = {
    business_id: business.id,
    type,
    config,
    status: hasCredentials ? 'connected' : 'disconnected',
    connected_at: hasCredentials ? new Date().toISOString() : null,
  }

  if (existing) {
    await supabase.from('integrations').update(payload).eq('id', existing.id)
  } else {
    await supabase.from('integrations').insert(payload)
  }

  return NextResponse.json({ ok: true })
}
