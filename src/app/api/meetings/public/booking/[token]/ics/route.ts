import { NextRequest, NextResponse } from 'next/server'
import { db, getHostById, getHostContactEmail } from '@/lib/meetings/service'
import { buildIcs } from '@/lib/meetings/ics'
import type { MeetingBooking } from '@/lib/meetings/types'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = db()
  const { data } = await supabase.from('meeting_bookings').select('*').eq('manage_token', token).maybeSingle()
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const booking = data as MeetingBooking
  const host = await getHostById(supabase, booking.user_id)
  if (!host) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ics = buildIcs(booking, host.display_name || 'Host', await getHostContactEmail(supabase, host))
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="meeting.ics"',
      'Cache-Control': 'no-store',
    },
  })
}
