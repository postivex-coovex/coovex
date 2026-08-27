import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('support_property_members')
    .select('*')
    .eq('property_id', id)
    .eq('owner_user_id', user.id)
    .order('invited_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ members: data })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { member_email, role, can_see_credentials } = await req.json()
  if (!member_email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  // Verify ownership
  const { data: prop } = await supabase.from('support_properties').select('id').eq('id', id).eq('user_id', user.id).single()
  if (!prop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Try to find member's user_id
  const { data: profile } = await supabase.from('profiles').select('id').eq('email', member_email.toLowerCase()).single()

  const { data, error } = await supabase
    .from('support_property_members')
    .upsert({
      property_id: id,
      owner_user_id: user.id,
      member_email: member_email.toLowerCase(),
      member_user_id: profile?.id || null,
      role: role || 'member',
      can_see_credentials: can_see_credentials ?? false,
    }, { onConflict: 'property_id,member_email' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { member_id } = await req.json()

  const { error } = await supabase
    .from('support_property_members')
    .delete()
    .eq('id', member_id)
    .eq('property_id', id)
    .eq('owner_user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
