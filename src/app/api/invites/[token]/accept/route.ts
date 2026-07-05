import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decodeToken } from '../../route'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const payload = decodeToken(token)
  if (!payload) return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Must be logged in to accept invite' }, { status: 401 })

  // Check not already a member
  const { data: existing } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', payload.w)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    // Already a member — just switch workspace
    await supabase.from('profiles').update({ current_workspace_id: payload.w }).eq('id', user.id)
    return NextResponse.json({ ok: true, message: 'Already a member — workspace switched' })
  }

  // Add to workspace_members
  const { error } = await supabase.from('workspace_members').insert({
    workspace_id: payload.w,
    user_id: user.id,
    role: payload.r,
    joined_at: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Switch to this workspace
  await supabase.from('profiles').update({ current_workspace_id: payload.w }).eq('id', user.id)

  return NextResponse.json({ ok: true, message: 'Joined workspace successfully' })
}
