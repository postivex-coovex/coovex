import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET: catalog + user's stack ─────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()
    if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    const [catalogResult, stackResult] = await Promise.all([
      supabase
        .from('software_catalog')
        .select('*')
        .eq('active', true)
        .order('is_coovex_pick', { ascending: false })
        .order('sort_order'),
      supabase
        .from('workspace_software_stack')
        .select('*, software:software_catalog(*)')
        .eq('workspace_id', profile.current_workspace_id),
    ])

    return NextResponse.json({
      catalog: catalogResult.data ?? [],
      stack: stackResult.data ?? [],
    })
  } catch (error) {
    console.error('GET /api/software error:', error)
    return NextResponse.json({ error: 'Failed to load software' }, { status: 500 })
  }
}

// ─── POST: add to stack ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()
    if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const { software_id, status = 'using', notes } = body

    if (!software_id) return NextResponse.json({ error: 'software_id is required' }, { status: 400 })
    if (!['using', 'interested', 'not_relevant'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('workspace_software_stack')
      .upsert(
        { workspace_id: profile.current_workspace_id, software_id, status, notes: notes ?? null },
        { onConflict: 'workspace_id,software_id' }
      )
      .select('*, software:software_catalog(*)')
      .single()

    if (error) throw error
    return NextResponse.json({ record: data })
  } catch (error) {
    console.error('POST /api/software error:', error)
    return NextResponse.json({ error: 'Failed to update stack' }, { status: 500 })
  }
}

// ─── DELETE: remove from stack ────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()
    if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const { software_id } = body
    if (!software_id) return NextResponse.json({ error: 'software_id is required' }, { status: 400 })

    const { error } = await supabase
      .from('workspace_software_stack')
      .delete()
      .eq('workspace_id', profile.current_workspace_id)
      .eq('software_id', software_id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/software error:', error)
    return NextResponse.json({ error: 'Failed to remove from stack' }, { status: 500 })
  }
}
