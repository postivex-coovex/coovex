import { NextResponse } from 'next/server'
import { authUser } from '@/lib/meetings/ops'

export async function GET() {
  const auth = await authUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const since = new Date(Date.now() - 90 * 86400_000).toISOString()
  const { data, error } = await auth.supabase
    .from('meeting_bookings').select('*')
    .eq('user_id', auth.user.id).gte('start_at', since)
    .order('start_at', { ascending: true }).limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bookings: data ?? [] })
}
