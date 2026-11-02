import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authUser, isOverlapError, syncZoomOnChange } from '@/lib/meetings/ops'
import { createZoomMeeting, hasZoom } from '@/lib/meetings/zoom'
import { notifyBooking } from '@/lib/meetings/notify'
import { db } from '@/lib/meetings/service'
import type { MeetingBooking, MeetingSettings } from '@/lib/meetings/types'

const url = z.union([z.literal(''), z.string().trim().url('Meeting link must be a full URL starting with https://')])

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('confirm'),
    meeting_url: url.optional(),
    location_details: z.string().trim().max(500).optional(),
    create_zoom: z.boolean().optional(),
    message: z.string().trim().max(1000).optional(),
    start: z.string().optional(),
  }),
  z.object({ action: z.literal('decline'), message: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal('cancel'), message: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal('reschedule'), start: z.string() }),
  z.object({ action: z.literal('update_link'), meeting_url: url.optional(), location_details: z.string().trim().max(500).optional(), notify: z.boolean().optional() }),
  z.object({ action: z.literal('complete') }),
  z.object({ action: z.literal('no_show') }),
])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const body = parsed.data

  const { supabase, user } = auth
  const { data: bookingRow } = await supabase.from('meeting_bookings').select('*').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!bookingRow) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  const booking = bookingRow as MeetingBooking
  const { data: hostRow } = await supabase.from('meeting_settings').select('*').eq('user_id', user.id).single()
  const host = hostRow as MeetingSettings
  const admin = db()
  const durationMin = Math.round((new Date(booking.end_at).getTime() - new Date(booking.start_at).getTime()) / 60000)

  const save = async (patch: Record<string, unknown>) => {
    const { data, error } = await supabase.from('meeting_bookings').update(patch).eq('id', id).eq('user_id', user.id).select('*').single()
    if (error) {
      if (isOverlapError(error)) return { error: 'That time overlaps another booking', status: 409 }
      return { error: error.message, status: 500 }
    }
    return { booking: data as MeetingBooking }
  }
  const fail = (r: { error?: string; status?: number }) => NextResponse.json({ error: r.error }, { status: r.status })

  switch (body.action) {
    case 'confirm': {
      if (booking.status !== 'pending') return NextResponse.json({ error: 'Only pending bookings can be confirmed' }, { status: 400 })
      const patch: Record<string, unknown> = {
        status: 'confirmed', confirmed_at: new Date().toISOString(), host_message: body.message || null,
      }
      let startIso = booking.start_at
      if (body.start && new Date(body.start).getTime() !== new Date(booking.start_at).getTime()) {
        const ms = new Date(body.start).getTime()
        if (!Number.isFinite(ms) || ms < Date.now() - 60_000) return NextResponse.json({ error: 'Choose a valid future time' }, { status: 400 })
        startIso = new Date(ms).toISOString()
        patch.start_at = startIso
        patch.end_at = new Date(ms + durationMin * 60000).toISOString()
      }
      if (body.create_zoom) {
        if (!hasZoom(host)) return NextResponse.json({ error: 'Connect Zoom in Settings first' }, { status: 400 })
        try {
          const z = await createZoomMeeting(host, { topic: `${booking.event_title} with ${booking.invitee_name}`, startIso, durationMin })
          patch.meeting_url = z.join_url
          patch.zoom_meeting_id = z.id
          patch.location_details = z.password ? `Passcode: ${z.password}` : body.location_details || null
        } catch (e) {
          return NextResponse.json({ error: e instanceof Error ? e.message : 'Zoom failed' }, { status: 502 })
        }
      } else {
        if (body.meeting_url !== undefined) patch.meeting_url = body.meeting_url || null
        else if (booking.meeting_url) patch.meeting_url = booking.meeting_url
        if (body.location_details !== undefined) patch.location_details = body.location_details || null
      }
      const r = await save(patch)
      if (!r.booking) return fail(r)
      await notifyBooking(admin, 'confirmed', r.booking, host)
      return NextResponse.json({ booking: r.booking })
    }
    case 'decline': {
      if (booking.status !== 'pending') return NextResponse.json({ error: 'Only pending bookings can be declined' }, { status: 400 })
      const r = await save({ status: 'declined', host_message: body.message || null })
      if (!r.booking) return fail(r)
      await notifyBooking(admin, 'declined', r.booking, host)
      return NextResponse.json({ booking: r.booking })
    }
    case 'cancel': {
      if (!['pending', 'confirmed'].includes(booking.status)) return NextResponse.json({ error: 'This booking is already closed' }, { status: 400 })
      const r = await save({ status: 'cancelled', cancelled_by: 'host', cancel_reason: body.message || null })
      if (!r.booking) return fail(r)
      await syncZoomOnChange(host, booking, { type: 'delete' })
      await notifyBooking(admin, 'cancelled', r.booking, host)
      return NextResponse.json({ booking: r.booking })
    }
    case 'reschedule': {
      if (!['pending', 'confirmed'].includes(booking.status)) return NextResponse.json({ error: 'This booking is already closed' }, { status: 400 })
      const ms = new Date(body.start).getTime()
      if (!Number.isFinite(ms) || ms < Date.now() - 60_000) return NextResponse.json({ error: 'Choose a valid future time' }, { status: 400 })
      const startIso = new Date(ms).toISOString()
      const r = await save({
        start_at: startIso, end_at: new Date(ms + durationMin * 60000).toISOString(),
        reminder_24h_sent: false, reminder_1h_sent: false,
      })
      if (!r.booking) return fail(r)
      await syncZoomOnChange(host, booking, { type: 'update', startIso, durationMin })
      await notifyBooking(admin, 'rescheduled', r.booking, host, { previousStart: booking.start_at })
      return NextResponse.json({ booking: r.booking })
    }
    case 'update_link': {
      if (booking.status !== 'confirmed') return NextResponse.json({ error: 'Only confirmed bookings can be edited' }, { status: 400 })
      const r = await save({
        ...(body.meeting_url !== undefined ? { meeting_url: body.meeting_url || null } : {}),
        ...(body.location_details !== undefined ? { location_details: body.location_details || null } : {}),
      })
      if (!r.booking) return fail(r)
      if (body.notify) await notifyBooking(admin, 'confirmed', r.booking, host)
      return NextResponse.json({ booking: r.booking })
    }
    case 'complete':
    case 'no_show': {
      const r = await save({ status: body.action === 'complete' ? 'completed' : 'no_show' })
      if (!r.booking) return fail(r)
      return NextResponse.json({ booking: r.booking })
    }
  }
}
