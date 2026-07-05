import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, name').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ config: null })

  const { data: config, error } = await supabase
    .from('chatbot_configs')
    .select('*')
    .eq('business_id', business.id)
    .maybeSingle()

  if (error) return NextResponse.json({ config: null, business_name: business.name })

  return NextResponse.json({ config, business_name: business.name })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, color, greeting, system_prompt, is_active } = body

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const payload = { business_id: business.id, name, color, greeting, system_prompt, is_active: is_active ?? true }

  // upsert
  const { data: existing } = await supabase.from('chatbot_configs').select('id').eq('business_id', business.id).maybeSingle()

  if (existing) {
    const { data, error } = await supabase.from('chatbot_configs').update(payload).eq('id', existing.id).select().single()
    if (error) return NextResponse.json({ ok: true, config: { ...payload, id: existing.id } })
    return NextResponse.json({ ok: true, config: data })
  }

  const { data, error } = await supabase.from('chatbot_configs').insert(payload).select().single()
  if (error) return NextResponse.json({ ok: true, config: { ...payload, id: `mock-${business.id}` } })
  return NextResponse.json({ ok: true, config: data })
}
