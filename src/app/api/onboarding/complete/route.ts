import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single()

  if (!profile?.current_workspace_id) {
    return NextResponse.json({ error: 'No active workspace' }, { status: 400 })
  }

  const admin = await createServiceClient()

  await Promise.all([
    admin.from('workspaces')
      .update({ onboarding_completed: true })
      .eq('id', profile.current_workspace_id),
    admin.from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id),
  ])

  return NextResponse.json({ ok: true })
}
