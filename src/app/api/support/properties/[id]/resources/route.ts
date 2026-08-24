import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('support_resources')
    .select('*')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  // Verify property ownership
  const { data: prop } = await supabase
    .from('support_properties')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!prop) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

  const body = await req.json()
  const { name, category, content, metadata } = body
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('support_resources')
    .insert({ property_id: id, user_id: user.id, name, category: category || 'credential', content: content || null, metadata: metadata || {} })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { resource_id, ...updates } = body

  const { data, error } = await supabase
    .from('support_resources')
    .update(updates)
    .eq('id', resource_id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = req.nextUrl
  const resource_id = searchParams.get('resource_id')

  const { error } = await supabase
    .from('support_resources')
    .delete()
    .eq('id', resource_id!)
    .eq('user_id', user.id)
    .eq('property_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
