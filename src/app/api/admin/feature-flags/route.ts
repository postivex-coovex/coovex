import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (!ADMIN_EMAILS.includes((user.email || '').toLowerCase())) return null
  return user
}

export async function GET() {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const supabase = await createServiceClient()
  const { data: flags, error } = await supabase
    .from('feature_flags')
    .select('flag_key, description, enabled_globally, enabled_for_plans, enabled_for_workspace_ids')
    .order('flag_key')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ flags })
}

export async function PATCH(req: Request) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { flag_key, enabled_globally } = await req.json()
  if (!flag_key) return NextResponse.json({ error: 'flag_key required' }, { status: 400 })

  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('feature_flags')
    .update({ enabled_globally })
    .eq('flag_key', flag_key)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
