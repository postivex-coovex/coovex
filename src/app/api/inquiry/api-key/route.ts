import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as serviceClient } from '@supabase/supabase-js'

function svc() {
  return serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// GET — return (or auto-create) user's inquiry API key
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = svc()
  const { data: existing } = await sb
    .from('inquiry_api_keys')
    .select('api_key, created_at')
    .eq('user_id', user.id)
    .single()

  if (existing) return NextResponse.json({ api_key: existing.api_key })

  // Auto-create
  const { data: created } = await sb
    .from('inquiry_api_keys')
    .insert({ user_id: user.id })
    .select('api_key')
    .single()

  return NextResponse.json({ api_key: created?.api_key })
}

// POST — regenerate key
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = svc()
  // Delete old, insert new (simpler than updating to trigger default)
  await sb.from('inquiry_api_keys').delete().eq('user_id', user.id)
  const { data } = await sb
    .from('inquiry_api_keys')
    .insert({ user_id: user.id })
    .select('api_key')
    .single()

  return NextResponse.json({ api_key: data?.api_key })
}
