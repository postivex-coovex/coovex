import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { buildSlotContext, db, getHostById, publicBooking } from '@/lib/meetings/service'
import { isSlotAvailable } from '@/lib/meetings/slots'
import { isOverlapError, syncZoomOnChange } from '@/lib/meetings/ops'
import { notifyBooking } from '@/lib/meetings/notify'
import type { MeetingBooking, MeetingEventType } from '@/lib/meetings/types'

async function load(token: string) {
  const supabase = db()
  const { data } = await supabase.from('meeting_bookings').select('*').eq('manage_token', token).maybeSingle()
  if (!data) return null
  const booking = data as MeetingBooking
  const host = await getHostById(supabase, booking.user_id)
  if (!host) return null
  let event: MeetingEventType | null = null
  if (booking.event_type_id) {
    const { data: ev } = await supabase.from('meeting_event_types').select('*').eq('id', booking.event_type_id).maybeSingle()
    event = (ev as MeetingEventType | null) ?? null
  }
  return { supabase, booking, host, event }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ctx = await load(token)
  if (!ctx) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  return NextResponse.json({
    booking: publicBooking(ctx.booking),
    host: { slug: ctx.host.slug, display_name: ctx.host.display_name, brand_color: ctx.host.brand_color, timezone: ctx.host.timezone },
    event: ctx.event && ctx.event.active ? { slug: ctx.event.slug, title: ctx.event.title } : null,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('cancel'), reason: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal('reschedule'), start: z.string() }),
])

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const body = parsed.data

  const ctx = await load(token)
  if (!ctx) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  const { supabase, booking, host, event } = ctx
  if (!['pending', 'confirmed'].includes(booking.status)) {
    return NextResponse.json({ error: 'This booking can no longer be changed' }, { status: 400 })
  }
  if (new Date(booking.end_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'This meeting has already taken place' }, { status: 400 })
  }

  if (body.action === 'cancel') {
    const { data, error } = await supabase.from('meeting_bookings')
      .update({ status: 'cancelled', cancelled_by: 'invitee', cancel_reason: body.reason || null })
      .eq('id', booking.id).select('*').single()
    if (error || !data) return NextResponse.json({ error: 'Could not cancel. Please try again.' }, { status: 500 })
    await syncZoomOnChange(host, booking, { type: 'delete' })
    await notifyBooking(supabase, 'cancelled', data as MeetingBooking, host)
    return NextResponse.json({ booking: publicBooking(data as MeetingBooking) })
  }

  // Reschedule
  if (!event || !event.active) return NextResponse.json({ error: 'This meeting type is no longer available. Please contact the host.' }, { status: 400 })
  const ms = new Date(body.start).getTime()
  if (!Number.isFinite(ms)) return NextResponse.json({ error: 'Invalid time' }, { status: 400 })
  const startIso = new Date(ms).toISOString()

  const slotCtx = await buildSlotContext(supabase, host, event, booking.id)
  if (!isSlotAvailable(slotCtx, startIso)) {
    return NextResponse.json({ error: 'That time is no longer available. Please pick another slot.' }, { status: 409 })
  }

  const durationMin = Math.round((new Date(booking.end_at).getTime() - new Date(booking.start_at).getTime()) / 60000)
  const { data, error } = await supabase.from('meeting_bookings').update({
    start_at: startIso,
    end_at: new Date(ms + durationMin * 60000).toISOString(),
    // Meetings that need approval go back to the host
    status: event.requires_confirmation ? 'pending' : booking.status,
    reminder_24h_sent: false,
    reminder_1h_sent: false,
  }).eq('id', booking.id).select('*').single()
  if (error || !data) {
    if (isOverlapError(error)) return NextResponse.json({ error: 'That time was just booked. Please pick another slot.' }, { status: 409 })
    return NextResponse.json({ error: 'Could not reschedule. Please try again.' }, { status: 500 })
  }
  await syncZoomOnChange(host, booking, { type: 'update', startIso, durationMin })
  await notifyBooking(supabase, 'rescheduled', data as MeetingBooking, host, { previousStart: booking.start_at })
  return NextResponse.json({ booking: publicBooking(data as MeetingBooking) })
}
