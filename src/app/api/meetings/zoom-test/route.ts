import { NextResponse } from 'next/server'
import { authUser } from '@/lib/meetings/ops'
import { hasZoom, testZoom } from '@/lib/meetings/zoom'

export async function POST() {
  const auth = await authUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await auth.supabase
    .from('meeting_settings').select('zoom_account_id, zoom_client_id, zoom_client_secret')
    .eq('user_id', auth.user.id).maybeSingle()
  if (!hasZoom(data)) return NextResponse.json({ error: 'Save your Zoom Account ID, Client ID and Client Secret first' }, { status: 400 })

  try {
    await testZoom(data)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Zoom test failed' }, { status: 400 })
  }
}
