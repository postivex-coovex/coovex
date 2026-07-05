import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/social/select-page
// Body: { platform: 'linkedin' | 'facebook', page_id: string | null }
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platform, page_id } = await req.json() as { platform: string; page_id: string | null }
  if (!platform) return NextResponse.json({ error: 'platform required' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: biz } = await supabase
    .from('businesses').select('id, social_connections')
    .eq('workspace_id', profile?.current_workspace_id ?? '').maybeSingle()

  if (!biz) return NextResponse.json({ error: 'No business' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = ((biz as any).social_connections as Record<string, unknown>) ?? {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const platformConn = (existing[platform] as Record<string, unknown>) ?? {}

  const updated = {
    ...existing,
    [platform]: { ...platformConn, selected_page_id: page_id },
  }

  const { error } = await supabase
    .from('businesses')
    .update({ social_connections: updated } as Record<string, unknown>)
    .eq('id', (biz as { id: string }).id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
