import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: prof } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: biz } = await supabase
    .from('businesses').select('id, integrations')
    .eq('workspace_id', prof?.current_workspace_id ?? '').maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json({ integrations: (biz as any)?.integrations ?? {} })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platform, settings } = await request.json()
  if (!platform) return NextResponse.json({ error: 'platform required' }, { status: 400 })

  const { data: prof } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: biz } = await supabase
    .from('businesses').select('id, integrations')
    .eq('workspace_id', prof?.current_workspace_id ?? '').maybeSingle()

  if (!biz) return NextResponse.json({ error: 'No business' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = ((biz as any).integrations as Record<string, unknown>) ?? {}
  const updated = { ...existing, [platform]: settings }

  const { error } = await supabase
    .from('businesses').update({ integrations: updated } as Record<string, unknown>).eq('id', biz.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
