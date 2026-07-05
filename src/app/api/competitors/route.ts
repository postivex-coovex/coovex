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
  if (!business) return NextResponse.json({ competitors: [] })

  const { data: competitors } = await supabase
    .from('competitors')
    .select('*')
    .eq('business_id', business.id)
    .order('intelligence_score', { ascending: false })

  return NextResponse.json({ competitors: competitors ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const { name, website, linkedin_url, facebook_url } = await request.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data: competitor, error } = await supabase
    .from('competitors')
    .insert({
      business_id:  business.id,
      name:         name.trim(),
      website:      website?.trim() || null,
      linkedin_url: linkedin_url?.trim() || null,
      facebook_url: facebook_url?.trim() || null,
      crawl_status: 'pending',
      auto_discovered: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ competitor }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await supabase.from('competitor_insights').delete().eq('competitor_id', id)
  await supabase.from('competitors').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
