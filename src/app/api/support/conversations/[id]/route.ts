import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data: conv, error } = await supabase
    .from('support_conversations')
    .select(`*, support_properties(*)`)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: messages } = await supabase
    .from('support_messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  // Mark as read
  await supabase
    .from('support_conversations')
    .update({ is_read: true })
    .eq('id', id)

  await supabase
    .from('support_messages')
    .update({ is_read: true })
    .eq('conversation_id', id)
    .eq('sender_type', 'customer')

  return NextResponse.json({ conversation: conv, messages: messages ?? [] })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const { data, error } = await supabase
    .from('support_conversations')
    .update(body)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { error } = await supabase
    .from('support_conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
