import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncBusinessMemory } from '@/lib/agent/sync-memory'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: lead, error } = await supabase.from('leads').select('*').eq('id', id).single()
    if (error || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    return NextResponse.json({ lead })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const allowed = ['name', 'email', 'phone', 'company', 'job_title', 'source', 'stage', 'score', 'notes', 'tags', 'assigned_to', 'research_data', 'website']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    const { data: lead, error } = await supabase.from('leads').update(updates).eq('id', id).select('*, business_id').single()
    if (error) throw error

    // Auto-sync AI memory after lead update (fire-and-forget)
    if (lead?.business_id) {
      const { data: biz } = await supabase.from('businesses').select('workspace_id').eq('id', lead.business_id).maybeSingle()
      if (biz?.workspace_id) syncBusinessMemory(lead.business_id, biz.workspace_id, 0).catch(() => {})
    }

    return NextResponse.json({ lead })
  } catch {
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
