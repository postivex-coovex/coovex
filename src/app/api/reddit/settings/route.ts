import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface RedditSettings {
  enabled: boolean
  subreddits: string[]
  keywords: string[]
  brand_keywords: string[]
  last_scan_at?: string
}

async function getBusiness(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', userId).single()
  if (!profile?.current_workspace_id) return null

  const { data: biz } = await supabase
    .from('businesses').select('id, integrations')
    .eq('workspace_id', profile.current_workspace_id).maybeSingle()
  return biz
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const biz = await getBusiness(supabase, user.id)
  if (!biz) return NextResponse.json({ error: 'No business' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const integrations = (biz.integrations as any) ?? {}
  const settings: RedditSettings = integrations.reddit ?? {
    enabled: false,
    subreddits: [],
    keywords: [],
    brand_keywords: [],
  }

  return NextResponse.json({ settings })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const biz = await getBusiness(supabase, user.id)
  if (!biz) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const body = await req.json() as Partial<RedditSettings>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = (biz.integrations as any) ?? {}
  const updated = {
    ...existing,
    reddit: {
      ...(existing.reddit ?? {}),
      enabled:        body.enabled ?? existing.reddit?.enabled ?? false,
      subreddits:     body.subreddits ?? existing.reddit?.subreddits ?? [],
      keywords:       body.keywords ?? existing.reddit?.keywords ?? [],
      brand_keywords: body.brand_keywords ?? existing.reddit?.brand_keywords ?? [],
    },
  }

  await supabase.from('businesses')
    .update({ integrations: updated } as Record<string, unknown>)
    .eq('id', biz.id)

  return NextResponse.json({ ok: true, settings: updated.reddit })
}
