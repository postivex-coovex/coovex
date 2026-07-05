import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  if (!profile?.current_workspace_id) return NextResponse.json({ proposals: [] })

  const { data: business } = await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
  if (!business) return NextResponse.json({ proposals: [] })

  const { data: proposals, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ proposals: [] })
  return NextResponse.json({ proposals: proposals ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { client_name, client_company, title, sections, footer, budget, timeline } = await req.json()
  if (!client_name || !title) return NextResponse.json({ error: 'client_name and title required' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business found' }, { status: 404 })

  const { data: proposal, error } = await supabase
    .from('proposals')
    .insert({
      business_id: business.id,
      client_name,
      client_company: client_company || null,
      title,
      sections_json: JSON.stringify(sections),
      footer,
      budget: budget || null,
      timeline: timeline || null,
      status: 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ proposal })
}
