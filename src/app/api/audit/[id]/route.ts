import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH — update audit purpose (stored in report_json.purpose)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { purpose } = await req.json()
  if (!purpose) return NextResponse.json({ error: 'purpose required' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = await supabase.from('businesses').select('id').eq('workspace_id', profile?.current_workspace_id).maybeSingle()
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  // Fetch existing report_json and merge purpose into it
  const { data: audit } = await supabase.from('audits').select('report_json').eq('id', id).eq('business_id', business.id).single()
  if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = { ...(audit.report_json as object), purpose }
  const { error } = await supabase.from('audits').update({ report_json: updated }).eq('id', id).eq('business_id', business.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, purpose })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = await supabase.from('businesses').select('id').eq('workspace_id', profile?.current_workspace_id).maybeSingle()
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const { error } = await supabase.from('audits').delete().eq('id', id).eq('business_id', business.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
