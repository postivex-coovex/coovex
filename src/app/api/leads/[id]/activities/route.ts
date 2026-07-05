import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: activities, error } = await supabase
      .from('lead_activities')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ activities: activities || [] })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { type, data_json } = await request.json()
    if (!type) return NextResponse.json({ error: 'type is required' }, { status: 400 })

    const { data: activity, error } = await supabase.from('lead_activities').insert({
      lead_id: id,
      type,
      data_json: data_json || null,
      created_by: user.id,
    }).select().single()

    if (error) throw error
    return NextResponse.json({ activity }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 })
  }
}
