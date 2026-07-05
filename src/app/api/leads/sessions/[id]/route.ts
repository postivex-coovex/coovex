import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('current_workspace_id').eq('id', user.id).single()
    const { data: business } = await supabase
      .from('businesses').select('id').eq('workspace_id', profile?.current_workspace_id ?? '').maybeSingle()
    if (!business) return NextResponse.json({ error: 'No business found' }, { status: 400 })

    const service = createServiceClient()
    await service.from('lead_sessions').delete()
      .eq('id', id)
      .eq('business_id', business.id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/leads/sessions/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 })
  }
}
