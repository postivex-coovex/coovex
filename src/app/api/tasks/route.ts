import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const status     = searchParams.get('status')
  const level      = searchParams.get('level')
  const department = searchParams.get('department')
  const search     = searchParams.get('search')

  let q = supabase
    .from('tasks')
    .select('*')
    .or(`user_id.eq.${user.id},assigned_to_user_id.eq.${user.id}`)
    .order('level', { ascending: false }) // emergency first
    .order('created_at', { ascending: false })

  if (status)     q = q.eq('status', status)
  if (level)      q = q.eq('level', level)
  if (department) q = q.eq('department', department)
  if (search)     q = q.ilike('title', `%${search}%`)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tasks: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, description, level, department, source, source_conversation_id,
          source_label, assigned_to_email, due_date } = body

  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  // Resolve assigned_to_user_id from email via profiles
  let assigned_to_user_id: string | null = null
  if (assigned_to_email) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', assigned_to_email)
      .single()
    if (profile) assigned_to_user_id = profile.id
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: user.id,
      title: title.trim(),
      description: description || null,
      level: level || 'normal',
      department: department || 'general',
      source: source || 'manual',
      source_conversation_id: source_conversation_id || null,
      source_label: source_label || null,
      assigned_to_email: assigned_to_email || null,
      assigned_to_user_id,
      due_date: due_date || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data })
}
