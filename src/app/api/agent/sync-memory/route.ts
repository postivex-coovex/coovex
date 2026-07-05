import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncBusinessMemory } from '@/lib/agent/sync-memory'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const { data: business } = await supabase
    .from('businesses').select('id')
    .eq('workspace_id', profile.current_workspace_id).maybeSingle()
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const context = await syncBusinessMemory(business.id, profile.current_workspace_id, 0)
  return NextResponse.json({ ok: true, synced_at: context?.synced_at ?? new Date().toISOString() })
}
