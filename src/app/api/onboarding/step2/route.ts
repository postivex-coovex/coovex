import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()

  if (!profile?.current_workspace_id)
    return NextResponse.json({ error: 'No active workspace' }, { status: 400 })

  const { data: business } = await supabase
    .from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()

  if (!business) return NextResponse.json({ error: 'No business found' }, { status: 400 })

  const { urls } = await req.json() as { urls: string[] }
  const valid = (urls ?? []).map(u => u.trim()).filter(Boolean)
  if (!valid.length) return NextResponse.json({ ok: true })

  const admin = await createServiceClient()
  const rows = valid.map(url => ({
    business_id: business.id,
    name:        extractDomain(url),
    website:     url,
  }))

  const { error } = await admin.from('competitors').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
