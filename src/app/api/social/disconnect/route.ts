import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platform } = await request.json()
  if (!platform) return NextResponse.json({ error: 'platform required' }, { status: 400 })

  const { data: prof } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: biz } = await supabase
    .from('businesses').select('id, social_connections')
    .eq('workspace_id', prof?.current_workspace_id ?? '').maybeSingle()

  if (!biz) return NextResponse.json({ error: 'No business' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = ((biz as any).social_connections as Record<string, unknown>) ?? {}
  const { [platform]: _removed, ...rest } = existing
  void _removed

  await supabase.from('businesses').update({ social_connections: rest } as Record<string, unknown>).eq('id', biz.id)

  return NextResponse.json({ ok: true })
}
