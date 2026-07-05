import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, workspace_id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ config: null })

  const { data: config } = await supabase
    .from('white_label_configs')
    .select('*')
    .eq('business_id', business.id)
    .maybeSingle()

  return NextResponse.json({ config, portal_url: `/portal/${business.workspace_id}` })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { brand_name, logo_url, primary_color, custom_domain, portal_enabled, portal_welcome_message, hide_powered_by } = body

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, workspace_id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const payload = { business_id: business.id, brand_name, logo_url, primary_color, custom_domain, portal_enabled, portal_welcome_message, hide_powered_by }

  const { data: existing } = await supabase.from('white_label_configs').select('id').eq('business_id', business.id).maybeSingle()
  if (existing) {
    const { data } = await supabase.from('white_label_configs').update(payload).eq('id', existing.id).select().single()
    return NextResponse.json({ ok: true, config: data || payload })
  }
  const { data } = await supabase.from('white_label_configs').insert(payload).select().single()
  return NextResponse.json({ ok: true, config: data || payload })
}
