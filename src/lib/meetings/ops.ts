import { createClient } from '@/lib/supabase/server'
import { createZoomMeeting, deleteZoomMeeting, hasZoom, updateZoomMeeting } from './zoom'
import type { LocationType, MeetingBooking, MeetingEventType, MeetingSettings } from './types'

export async function authUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ? { supabase, user } : null
}

export interface ResolvedLocation {
  location_type: LocationType
  meeting_url: string | null
  location_details: string | null
  zoom_meeting_id: string | null
  zoomError?: string
}

const isUrl = (v: string) => /^https?:\/\//i.test(v)

/** Works out the meeting link / location text for a booking, creating a Zoom meeting when needed. */
export async function resolveLocation(
  host: MeetingSettings,
  event: Pick<MeetingEventType, 'location_type' | 'location_value' | 'title' | 'duration_min'>,
  startIso: string,
  agenda?: string,
): Promise<ResolvedLocation> {
  const base: ResolvedLocation = { location_type: event.location_type, meeting_url: null, location_details: null, zoom_meeting_id: null }
  const value = event.location_value?.trim() || ''
  switch (event.location_type) {
    case 'zoom': {
      if (!hasZoom(host)) return { ...base, location_details: 'Zoom link will be sent shortly', zoomError: 'Zoom is not connected' }
      try {
        const z = await createZoomMeeting(host, { topic: `${event.title} with ${host.display_name || 'host'}`, startIso, durationMin: event.duration_min, agenda })
        return { ...base, meeting_url: z.join_url, zoom_meeting_id: z.id, location_details: z.password ? `Passcode: ${z.password}` : null }
      } catch (e) {
        return { ...base, location_details: 'Zoom link will be sent shortly', zoomError: e instanceof Error ? e.message : String(e) }
      }
    }
    case 'custom_link':
      return isUrl(value) ? { ...base, meeting_url: value } : { ...base, location_details: value || 'Link will be shared by the host' }
    case 'phone':
      return { ...base, location_details: value ? `Phone: ${value}` : 'The host will call you' }
    case 'in_person':
      return { ...base, location_details: value || 'Location will be shared by the host' }
    default:
      return base
  }
}

/** Best-effort Zoom cleanup/update; failures are logged, not thrown. */
export async function syncZoomOnChange(
  host: MeetingSettings,
  booking: Pick<MeetingBooking, 'zoom_meeting_id'>,
  change: { type: 'delete' } | { type: 'update'; startIso: string; durationMin: number },
) {
  if (!booking.zoom_meeting_id || !hasZoom(host)) return
  try {
    if (change.type === 'delete') await deleteZoomMeeting(host, booking.zoom_meeting_id)
    else await updateZoomMeeting(host, booking.zoom_meeting_id, { startIso: change.startIso, durationMin: change.durationMin })
  } catch (e) {
    console.error('[meetings] zoom sync failed:', e)
  }
}

/** Postgres exclusion-constraint violation = the slot was taken a moment ago. */
export const isOverlapError = (err: { code?: string } | null) => err?.code === '23P01'
