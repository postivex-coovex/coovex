import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SECRET_KEYS = [
  'smtp_pass', 'resend_api_key', 'sendgrid_api_key',
  'mailgun_api_key', 'brevo_api_key', 'postmark_api_key',
] as const

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('*').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ settings: null })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (business as any).email_settings as Record<string, unknown> ?? {}

  // Mask all secret fields before sending to client
  const settings: Record<string, unknown> = { ...raw }
  for (const k of SECRET_KEYS) {
    settings[k] = raw[k] ? '••••••••' : ''
  }

  return NextResponse.json({ settings })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('*').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = (business as any).email_settings as Record<string, unknown> ?? {}
  const merged: Record<string, unknown> = { ...existing, ...body }

  // If masked values sent back, keep the real stored values
  for (const k of SECRET_KEYS) {
    if (body[k] === '••••••••') merged[k] = existing[k]
  }

  const { error } = await supabase.from('businesses')
    .update({ email_settings: merged })
    .eq('id', (business as { id: string }).id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
