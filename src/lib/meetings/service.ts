import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import type { EmailSettings } from '@/lib/send-email'
import type { MeetingBooking, MeetingEventType, MeetingSettings } from './types'
import type { SlotContext } from './slots'
import { addDaysYmd, ymdInTz } from './tz'

export function db(): SupabaseClient {
  return createServiceClient() as unknown as SupabaseClient
}

export async function getHostBySlug(supabase: SupabaseClient, slug: string): Promise<MeetingSettings | null> {
  const { data } = await supabase.from('meeting_settings').select('*').eq('slug', slug.toLowerCase()).maybeSingle()
  return (data as MeetingSettings | null) ?? null
}

export async function getHostById(supabase: SupabaseClient, userId: string): Promise<MeetingSettings | null> {
  const { data } = await supabase.from('meeting_settings').select('*').eq('user_id', userId).maybeSingle()
  return (data as MeetingSettings | null) ?? null
}

export async function getActiveEvent(supabase: SupabaseClient, userId: string, slug: string): Promise<MeetingEventType | null> {
  const { data } = await supabase
    .from('meeting_event_types').select('*')
    .eq('user_id', userId).eq('slug', slug).eq('active', true).maybeSingle()
  return (data as MeetingEventType | null) ?? null
}

/** Loads everything needed to compute slots for one host + event type. */
export async function buildSlotContext(
  supabase: SupabaseClient,
  host: MeetingSettings,
  event: MeetingEventType,
  excludeBookingId?: string,
): Promise<SlotContext> {
  const today = ymdInTz(Date.now(), host.timezone)
  const [weekly, overrides, bookings] = await Promise.all([
    supabase.from('meeting_availability').select('weekday, start_minute, end_minute').eq('user_id', host.user_id),
    supabase.from('meeting_date_overrides').select('date, start_minute, end_minute')
      .eq('user_id', host.user_id).gte('date', addDaysYmd(today, -1)),
    supabase.from('meeting_bookings').select('id, start_at, end_at')
      .eq('user_id', host.user_id).in('status', ['pending', 'confirmed'])
      .gte('end_at', new Date(Date.now() - 86400_000).toISOString()),
  ])
  const busy = ((bookings.data ?? []) as { id: string; start_at: string; end_at: string }[])
    .filter(b => b.id !== excludeBookingId)
    .map(b => ({ start: new Date(b.start_at).getTime(), end: new Date(b.end_at).getTime() }))
  return {
    hostTz: host.timezone,
    weekly: (weekly.data ?? []) as SlotContext['weekly'],
    overrides: ((overrides.data ?? []) as { date: string; start_minute: number | null; end_minute: number | null }[]),
    busy,
    event,
  }
}

/** Email settings of the host's current workspace; falls back to the platform sender. */
export async function getHostEmailSettings(supabase: SupabaseClient, userId: string): Promise<EmailSettings> {
  try {
    const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', userId).maybeSingle()
    if (profile?.current_workspace_id) {
      const { data: business } = await supabase
        .from('businesses').select('email_settings').eq('workspace_id', profile.current_workspace_id).maybeSingle()
      const s = (business as { email_settings?: EmailSettings } | null)?.email_settings
      if (s?.method) return s
    }
  } catch { /* fall through */ }
  return { method: 'reply_to' }
}

export async function getHostContactEmail(supabase: SupabaseClient, host: MeetingSettings): Promise<string | null> {
  if (host.host_email) return host.host_email
  const { data } = await supabase.from('profiles').select('email').eq('id', host.user_id).maybeSingle()
  return (data as { email?: string } | null)?.email ?? null
}

/** Strip server-only fields before a booking is returned to an invitee. */
export function publicBooking(b: MeetingBooking) {
  return {
    event_title: b.event_title,
    start_at: b.start_at,
    end_at: b.end_at,
    invitee_name: b.invitee_name,
    invitee_email: b.invitee_email,
    invitee_timezone: b.invitee_timezone,
    status: b.status,
    location_type: b.location_type,
    meeting_url: b.status === 'confirmed' ? b.meeting_url : null,
    location_details: b.status === 'confirmed' ? b.location_details : null,
    host_message: b.host_message,
    cancel_reason: b.cancel_reason,
  }
}

export function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

export const RESERVED_SLUGS = new Set(['api', 'manage', 'admin', 'app', 'new', 'settings', 'login', 'signup'])
