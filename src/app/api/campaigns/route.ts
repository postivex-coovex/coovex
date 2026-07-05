import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  if (!profile?.current_workspace_id) return NextResponse.json({ campaigns: [] })

  const { data: business } = await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
  if (!business) return NextResponse.json({ campaigns: [] })

  const { data: campaigns } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ campaigns: campaigns ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, subject, from_name, content, segment, scheduled_at, lead_ids } = await req.json()
  if (!name || !subject) return NextResponse.json({ error: 'name and subject required' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business found' }, { status: 404 })

  // Count recipients
  let recipientCount = 0
  if (Array.isArray(lead_ids) && lead_ids.length > 0) {
    recipientCount = lead_ids.length
  } else {
    const q = supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id)
    if (segment && segment !== 'all') q.eq('stage', segment)
    const { count } = await q
    recipientCount = count ?? 0
  }

  const { data: campaign, error } = await supabase
    .from('email_campaigns')
    .insert({
      business_id:     business.id,
      name,
      subject,
      from_name:       from_name || 'The Team',
      content:         content || '',
      segment:         lead_ids?.length > 0 ? 'selected' : (segment || 'all'),
      lead_ids:        lead_ids ?? [],
      status:          scheduled_at ? 'scheduled' : 'draft',
      recipient_count: recipientCount,
      scheduled_at:    scheduled_at || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaign })
}
