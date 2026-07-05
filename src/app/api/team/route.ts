import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  if (!profile?.current_workspace_id) return NextResponse.json({ members: [] })

  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', profile.current_workspace_id)

  if (!members?.length) return NextResponse.json({ members: [] })

  const userIds = members.map(m => m.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, email')
    .in('id', userIds)

  const result = members.map(m => {
    const p = profiles?.find(pr => pr.id === m.user_id)
    return { id: m.user_id, name: p?.name || p?.email || 'Unknown', email: p?.email || '', role: m.role }
  })

  return NextResponse.json({ members: result })
}
