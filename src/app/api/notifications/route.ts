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

  if (!business) return NextResponse.json({ notifications: [], unread: 0 })

  const { data: signals } = await supabase
    .from('agent_signals')
    .select('id, title, description, signal_type, priority, status, created_at')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const notifications = (signals ?? []).map(s => ({
    id: s.id,
    title: s.title,
    body: s.description,
    type: s.signal_type,
    priority: s.priority,
    read: s.status === 'dismissed',
    created_at: s.created_at,
  }))

  const unread = notifications.filter(n => !n.read).length

  return NextResponse.json({ notifications, unread })
}

export async function PATCH(req: NextRequest) {
  const { id } = await req.json()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase.from('agent_signals').update({ status: 'dismissed' }).eq('id', id).then(() => null)
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (business) {
    await supabase.from('agent_signals').update({ status: 'dismissed' }).eq('business_id', business.id).eq('status', 'active').then(() => null)
  }

  return NextResponse.json({ ok: true })
}
