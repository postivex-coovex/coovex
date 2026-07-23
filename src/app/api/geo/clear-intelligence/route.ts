import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single()

  const { data: business } = profile?.current_workspace_id
    ? await supabase
        .from('businesses')
        .select('id')
        .eq('workspace_id', profile.current_workspace_id)
        .maybeSingle()
    : { data: null }

  if (!business?.id) return NextResponse.json({ ok: true })

  const service = createServiceClient()
  await service.from('agent_memory')
    .delete()
    .eq('business_id', business.id)
    .eq('key', 'geo_intelligence')

  return NextResponse.json({ ok: true })
}
