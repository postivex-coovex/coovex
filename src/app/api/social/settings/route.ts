import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/social/settings — returns social_enabled status per channel
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
    if (!profile?.current_workspace_id) return NextResponse.json({ settings: {} })

    const { data: business } = await supabase
      .from('businesses').select('social_connections')
      .eq('workspace_id', profile.current_workspace_id).maybeSingle()

    return NextResponse.json({ settings: business?.social_connections ?? {} })
  } catch (err) {
    console.error('GET /api/social/settings error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// PATCH /api/social/settings — toggle social_enabled for a channel
// Body: { channel: 'linkedin', enabled: true }
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
    if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    const { data: business } = await supabase
      .from('businesses').select('id, social_connections')
      .eq('workspace_id', profile.current_workspace_id).maybeSingle()
    if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

    const { channel, enabled } = await request.json()
    if (!channel) return NextResponse.json({ error: 'channel required' }, { status: 400 })

    const existing = (business.social_connections as Record<string, object>) ?? {}
    const updated = {
      ...existing,
      [channel]: { ...(existing[channel] ?? {}), social_enabled: !!enabled },
    }

    const { error } = await supabase
      .from('businesses').update({ social_connections: updated }).eq('id', business.id)

    if (error) throw error
    return NextResponse.json({ settings: updated })
  } catch (err) {
    console.error('PATCH /api/social/settings error:', err)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
