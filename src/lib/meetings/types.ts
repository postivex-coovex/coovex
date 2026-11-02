export type LocationType = 'zoom' | 'custom_link' | 'phone' | 'in_person' | 'host_provides'
export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed' | 'no_show'

export interface MeetingQuestion { id: string; label: string; required: boolean }

export interface MeetingSettings {
  user_id: string
  slug: string
  display_name: string | null
  bio: string | null
  timezone: string
  host_email: string | null
  brand_color: string
  zoom_account_id: string | null
  zoom_client_id: string | null
  zoom_client_secret: string | null
}

export interface MeetingEventType {
  id: string
  user_id: string
  slug: string
  title: string
  description: string | null
  duration_min: number
  buffer_before_min: number
  buffer_after_min: number
  min_notice_hours: number
  max_days_ahead: number
  slot_interval_min: number
  location_type: LocationType
  location_value: string | null
  requires_confirmation: boolean
  questions: MeetingQuestion[]
  color: string
  active: boolean
  created_at: string
}

export interface MeetingBooking {
  id: string
  user_id: string
  event_type_id: string | null
  event_title: string
  start_at: string
  end_at: string
  invitee_name: string
  invitee_email: string
  invitee_phone: string | null
  invitee_timezone: string
  notes: string | null
  answers: { label: string; answer: string }[]
  status: BookingStatus
  location_type: LocationType | null
  meeting_url: string | null
  location_details: string | null
  zoom_meeting_id: string | null
  host_message: string | null
  cancel_reason: string | null
  cancelled_by: 'host' | 'invitee' | null
  manage_token: string
  reminder_24h_sent: boolean
  reminder_1h_sent: boolean
  confirmed_at: string | null
  created_at: string
}

export const LOCATION_LABELS: Record<LocationType, string> = {
  zoom: 'Zoom (auto-generated)',
  custom_link: 'Custom link (Meet, Teams, etc.)',
  phone: 'Phone call',
  in_person: 'In person',
  host_provides: 'I will add the link when confirming',
}

export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.coovex.com').replace(/\/$/, '')

/** Fields never sent to the browser on public pages. */
export function publicHost(s: MeetingSettings) {
  return { slug: s.slug, display_name: s.display_name, bio: s.bio, timezone: s.timezone, brand_color: s.brand_color }
}
