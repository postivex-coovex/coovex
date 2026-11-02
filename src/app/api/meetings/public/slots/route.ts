import { NextRequest, NextResponse } from 'next/server'
import { buildSlotContext, db, getActiveEvent, getHostBySlug } from '@/lib/meetings/service'
import { computeSlots } from '@/lib/meetings/slots'
import { addDaysYmd } from '@/lib/meetings/tz'

const YMD = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const username = q.get('username') || ''
  const eventSlug = q.get('event') || ''
  const from = q.get('from') || ''
  const to = q.get('to') || ''
  const exclude = q.get('exclude') // manage token of a booking being rescheduled

  if (!username || !eventSlug || !YMD.test(from) || !YMD.test(to) || to < from || to > addDaysYmd(from, 62)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = db()
  const host = await getHostBySlug(supabase, username)
  if (!host) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const event = await getActiveEvent(supabase, host.user_id, eventSlug)
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let excludeId: string | undefined
  if (exclude) {
    const { data } = await supabase.from('meeting_bookings').select('id').eq('manage_token', exclude).eq('user_id', host.user_id).maybeSingle()
    excludeId = (data as { id: string } | null)?.id
  }

  const ctx = await buildSlotContext(supabase, host, event, excludeId)
  return NextResponse.json(
    { slots: computeSlots(ctx, from, to), host_timezone: host.timezone, duration_min: event.duration_min },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
