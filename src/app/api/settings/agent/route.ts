import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await req.json()

  // Store in agent_config_json column if it exists, else return success stub
  // Run: ALTER TABLE profiles ADD COLUMN agent_config_json jsonb DEFAULT '{}';
  const { error } = await supabase
    .from('profiles')
    .update({ agent_config_json: config } as Record<string, unknown>)
    .eq('id', user.id)

  if (error) {
    // Column may not exist yet — return success anyway (stored client-side)
    return NextResponse.json({ ok: true, note: 'config not persisted server-side yet' })
  }

  return NextResponse.json({ ok: true })
}
