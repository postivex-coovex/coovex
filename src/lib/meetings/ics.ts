import type { MeetingBooking } from './types'

const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

function where(b: MeetingBooking): string {
  return b.meeting_url || b.location_details || ''
}

export function buildIcs(b: MeetingBooking, hostName: string, hostEmail: string | null): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CooVex//Meeting Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${b.id}@coovex.com`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(b.start_at)}`,
    `DTEND:${fmt(b.end_at)}`,
    `SUMMARY:${esc(`${b.event_title} with ${hostName}`)}`,
    `DESCRIPTION:${esc([b.meeting_url ? `Join: ${b.meeting_url}` : '', b.location_details || '', b.notes ? `Notes: ${b.notes}` : ''].filter(Boolean).join('\n'))}`,
    where(b) ? `LOCATION:${esc(where(b))}` : '',
    hostEmail ? `ORGANIZER;CN=${esc(hostName)}:mailto:${hostEmail}` : '',
    `ATTENDEE;CN=${esc(b.invitee_name)}:mailto:${b.invitee_email}`,
    `STATUS:${b.status === 'confirmed' ? 'CONFIRMED' : b.status === 'cancelled' ? 'CANCELLED' : 'TENTATIVE'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)
  return lines.join('\r\n') + '\r\n'
}

export function googleCalendarUrl(b: MeetingBooking, hostName: string): string {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${b.event_title} with ${hostName}`,
    dates: `${fmt(b.start_at)}/${fmt(b.end_at)}`,
    details: [b.meeting_url ? `Join: ${b.meeting_url}` : '', b.location_details || ''].filter(Boolean).join('\n'),
    location: where(b),
  })
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}
