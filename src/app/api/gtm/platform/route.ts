import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platform_id, status } = await request.json()
  if (!platform_id) return NextResponse.json({ error: 'platform_id required' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = await supabase.from('businesses')
    .select('id').eq('workspace_id', profile?.current_workspace_id ?? '').maybeSingle()
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const { error } = await supabase.from('launch_tracker_platforms').upsert({
    workspace_id: profile!.current_workspace_id,
    business_id: business.id,
    platform_id,
    status: status ?? 'done',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'business_id,platform_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
