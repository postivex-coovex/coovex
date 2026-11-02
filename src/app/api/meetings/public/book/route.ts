import { NextRequest, NextResponse } from 'next/server'
import { bookRequestSchema } from '@/lib/meetings/schemas'
import { buildSlotContext, db, getActiveEvent, getHostBySlug, publicBooking } from '@/lib/meetings/service'
import { isSlotAvailable } from '@/lib/meetings/slots'
import { isValidTimeZone } from '@/lib/meetings/tz'
import { isOverlapError, resolveLocation } from '@/lib/meetings/ops'
import { notifyBooking } from '@/lib/meetings/notify'
import type { MeetingBooking } from '@/lib/meetings/types'

export async function POST(req: NextRequest) {
  const parsed = bookRequestSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const b = parsed.data

  // Honeypot: bots fill hidden fields. Pretend success.
  if (b.website) return NextResponse.json({ ok: true, token: 'ok' })

  const supabase = db()
  const host = await getHostBySlug(supabase, b.username)
  if (!host) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const event = await getActiveEvent(supabase, host.user_id, b.event)
  if (!event) return NextResponse.json({ error: 'This meeting type is not available' }, { status: 404 })

  const startMs = new Date(b.start).getTime()
  if (!Number.isFinite(startMs)) return NextResponse.json({ error: 'Invalid time' }, { status: 400 })
  const startIso = new Date(startMs).toISOString()
  const endIso = new Date(startMs + event.duration_min * 60000).toISOString()
  const inviteeTz = isValidTimeZone(b.timezone) ? b.timezone : 'UTC'

  // Limit open bookings per invitee email to curb spam
  const { count } = await supabase.from('meeting_bookings').select('id', { count: 'exact', head: true })
    .eq('user_id', host.user_id).eq('invitee_email', b.email.toLowerCase())
    .in('status', ['pending', 'confirmed']).gte('start_at', new Date().toISOString())
  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: 'You already have several upcoming bookings. Please cancel one or contact the host.' }, { status: 429 })
  }

  // Re-validate the slot server-side; never trust the client
  const ctx = await buildSlotContext(supabase, host, event)
  if (!isSlotAvailable(ctx, startIso)) {
    return NextResponse.json({ error: 'That time is no longer available. Please pick another slot.' }, { status: 409 })
  }

  const missing = event.questions.find(q => q.required && !(b.answers[q.id] || '').trim())
  if (missing) return NextResponse.json({ error: `Please answer: ${missing.label}` }, { status: 400 })
  const answers = event.questions
    .map(q => ({ label: q.label, answer: (b.answers[q.id] || '').trim() }))
    .filter(a => a.answer)

  const autoConfirm = !event.requires_confirmation
  const loc = autoConfirm
    ? await resolveLocation(host, event, startIso, b.notes || undefined)
    : { location_type: event.location_type, meeting_url: null, location_details: null, zoom_meeting_id: null }

  const { data, error } = await supabase.from('meeting_bookings').insert({
    user_id: host.user_id,
    event_type_id: event.id,
    event_title: event.title,
    start_at: startIso,
    end_at: endIso,
    invitee_name: b.name,
    invitee_email: b.email.toLowerCase(),
    invitee_phone: b.phone || null,
    invitee_timezone: inviteeTz,
    notes: b.notes || null,
    answers,
    status: autoConfirm ? 'confirmed' : 'pending',
    confirmed_at: autoConfirm ? new Date().toISOString() : null,
    location_type: loc.location_type,
    meeting_url: loc.meeting_url,
    location_details: loc.location_details,
    zoom_meeting_id: loc.zoom_meeting_id,
  }).select('*').single()

  if (error || !data) {
    // Roll back a Zoom meeting we created for a booking that failed to save
    if ('zoom_meeting_id' in loc && loc.zoom_meeting_id) {
      const { syncZoomOnChange } = await import('@/lib/meetings/ops')
      await syncZoomOnChange(host, { zoom_meeting_id: loc.zoom_meeting_id }, { type: 'delete' })
    }
    if (isOverlapError(error)) return NextResponse.json({ error: 'That time was just booked. Please pick another slot.' }, { status: 409 })
    return NextResponse.json({ error: 'Could not save your booking. Please try again.' }, { status: 500 })
  }

  const booking = data as MeetingBooking
  await notifyBooking(supabase, autoConfirm ? 'confirmed' : 'requested', booking, host, { notifyHost: autoConfirm })
  return NextResponse.json({ ok: true, token: booking.manage_token, booking: publicBooking(booking) })
}
