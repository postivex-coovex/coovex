import { sendEmail, type EmailSettings } from '@/lib/send-email'
import type { SupabaseClient } from '@supabase/supabase-js'
import { APP_URL, type MeetingBooking, type MeetingSettings } from './types'
import { formatDateTimeInTz, tzShortName } from './tz'
import { googleCalendarUrl } from './ics'
import { getHostContactEmail, getHostEmailSettings } from './service'

export type NotifyKind =
  | 'requested' | 'confirmed' | 'declined' | 'cancelled' | 'rescheduled' | 'reminder_24h' | 'reminder_1h'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function layout(color: string, heading: string, body: string, cta?: { label: string; url: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
<div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
<div style="background:${esc(color)};padding:20px 28px;"><h1 style="margin:0;font-size:18px;color:#ffffff;">${esc(heading)}</h1></div>
<div style="padding:24px 28px;color:#0f172a;font-size:14px;line-height:1.6;">${body}
${cta ? `<p style="margin:24px 0 0;"><a href="${esc(cta.url)}" style="display:inline-block;background:${esc(color)};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;">${esc(cta.label)}</a></p>` : ''}
</div>
<div style="padding:14px 28px;background:#f8fafc;color:#64748b;font-size:12px;">Sent via CooVex Meeting Calendar</div>
</div></body></html>`
}

function detailsTable(rows: [string, string][]): string {
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0;">${rows
    .filter(r => r[1])
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:#64748b;width:110px;vertical-align:top;">${esc(k)}</td><td style="padding:6px 0;font-weight:500;">${v}</td></tr>`)
    .join('')}</table>`
}

function whereHtml(b: MeetingBooking): string {
  const parts: string[] = []
  if (b.meeting_url) parts.push(`<a href="${esc(b.meeting_url)}" style="color:#2563eb;">${esc(b.meeting_url)}</a>`)
  if (b.location_details) parts.push(esc(b.location_details))
  return parts.join('<br>')
}

interface Msg { to: string; subject: string; html: string; text: string; audience: 'invitee' | 'host' }

export interface NotifyExtra { previousStart?: string; notifyHost?: boolean }

function build(kind: NotifyKind, b: MeetingBooking, host: MeetingSettings, hostEmail: string | null, extra?: NotifyExtra): Msg[] {
  const hostName = host.display_name || 'Your host'
  const color = host.brand_color || '#2563eb'
  const when = (tz: string) => `${formatDateTimeInTz(b.start_at, tz)} (${tzShortName(tz, b.start_at)})`
  const manageUrl = `${APP_URL}/booking/${b.manage_token}`
  const msgs: Msg[] = []

  const inviteeRows = (): [string, string][] => [
    ['What', esc(b.event_title)],
    ['When', esc(when(b.invitee_timezone))],
    ['With', esc(hostName)],
    ['Where', whereHtml(b)],
  ]
  const hostRows = (): [string, string][] => [
    ['What', esc(b.event_title)],
    ['When', esc(when(host.timezone))],
    ['Who', `${esc(b.invitee_name)} (${esc(b.invitee_email)})`],
    ['Phone', esc(b.invitee_phone || '')],
    ['Notes', esc(b.notes || '')],
    ...b.answers.map(a => [a.label, esc(a.answer)] as [string, string]),
    ['Invitee time', esc(`${formatDateTimeInTz(b.start_at, b.invitee_timezone)} (${tzShortName(b.invitee_timezone, b.start_at)})`)],
  ]
  const push = (audience: 'invitee' | 'host', subject: string, heading: string, intro: string, rows: [string, string][], cta?: { label: string; url: string }) => {
    const to = audience === 'invitee' ? b.invitee_email : hostEmail
    if (!to) return
    const html = layout(color, heading, `<p style="margin:0 0 8px;">${intro}</p>${detailsTable(rows)}`, cta)
    const text = `${heading}\n\n${intro.replace(/<[^>]+>/g, '')}\n\n${rows.filter(r => r[1]).map(([k, v]) => `${k}: ${v.replace(/<[^>]+>/g, '')}`).join('\n')}${cta ? `\n\n${cta.label}: ${cta.url}` : ''}`
    msgs.push({ to, subject, html, text, audience })
  }

  switch (kind) {
    case 'requested':
      push('invitee', `Request received: ${b.event_title} with ${hostName}`, 'Request received',
        `Hi ${esc(b.invitee_name)}, your request was sent to ${esc(hostName)}. You will get an email once it is confirmed.`,
        inviteeRows(), { label: 'View or cancel request', url: manageUrl })
      push('host', `New booking request: ${b.invitee_name}`, 'New booking request',
        `${esc(b.invitee_name)} requested a meeting. Confirm it from your Meeting Calendar.`,
        hostRows(), { label: 'Review request', url: `${APP_URL}/meetings` })
      break
    case 'confirmed':
      push('invitee', `Confirmed: ${b.event_title} with ${hostName}`, 'Your meeting is confirmed',
        `Hi ${esc(b.invitee_name)}, you are booked with ${esc(hostName)}.${b.host_message ? `<br><br><em>${esc(b.host_message)}</em>` : ''}`,
        [...inviteeRows(), ['Calendar', `<a href="${esc(googleCalendarUrl(b, hostName))}" style="color:#2563eb;">Add to Google Calendar</a> · <a href="${APP_URL}/api/meetings/public/booking/${b.manage_token}/ics" style="color:#2563eb;">Download .ics</a>`]],
        { label: 'Reschedule or cancel', url: manageUrl })
      if (extra?.notifyHost) {
        push('host', `New booking: ${b.invitee_name} – ${b.event_title}`, 'New booking confirmed',
          `${esc(b.invitee_name)} booked a meeting with you.`, hostRows(), { label: 'Open Meeting Calendar', url: `${APP_URL}/meetings` })
      }
      break
    case 'declined':
      push('invitee', `Update on your request: ${b.event_title}`, 'Request declined',
        `Hi ${esc(b.invitee_name)}, unfortunately ${esc(hostName)} cannot take this meeting.${b.host_message ? `<br><br><em>${esc(b.host_message)}</em>` : ''}`,
        inviteeRows())
      break
    case 'cancelled':
      if (b.cancelled_by === 'invitee') {
        push('host', `Cancelled: ${b.invitee_name} – ${b.event_title}`, 'Meeting cancelled',
          `${esc(b.invitee_name)} cancelled this meeting.${b.cancel_reason ? `<br><br><em>${esc(b.cancel_reason)}</em>` : ''}`, hostRows())
        push('invitee', `Cancelled: ${b.event_title} with ${hostName}`, 'Your meeting was cancelled',
          'This is a confirmation that your meeting was cancelled.', inviteeRows())
      } else {
        push('invitee', `Cancelled: ${b.event_title} with ${hostName}`, 'Your meeting was cancelled',
          `${esc(hostName)} cancelled this meeting.${b.cancel_reason ? `<br><br><em>${esc(b.cancel_reason)}</em>` : ''}`, inviteeRows())
      }
      break
    case 'rescheduled': {
      const prev = extra?.previousStart ? `Previously: ${formatDateTimeInTz(extra.previousStart, b.invitee_timezone)}. ` : ''
      push('invitee', `Rescheduled: ${b.event_title} with ${hostName}`, 'Your meeting was rescheduled',
        `${esc(prev)}Here are the new details.`, inviteeRows(), { label: 'Manage booking', url: manageUrl })
      push('host', `Rescheduled: ${b.invitee_name} – ${b.event_title}`, 'Meeting rescheduled', 'The meeting time changed.', hostRows(), { label: 'Open Meeting Calendar', url: `${APP_URL}/meetings` })
      break
    }
    case 'reminder_24h':
    case 'reminder_1h': {
      const lead = kind === 'reminder_24h' ? 'tomorrow' : 'in about an hour'
      push('invitee', `Reminder: ${b.event_title} ${lead}`, 'Meeting reminder',
        `Hi ${esc(b.invitee_name)}, your meeting with ${esc(hostName)} starts ${lead}.`, inviteeRows(), { label: 'Manage booking', url: manageUrl })
      if (kind === 'reminder_1h') {
        push('host', `Starting soon: ${b.invitee_name} – ${b.event_title}`, 'Meeting starts soon',
          `Your meeting with ${esc(b.invitee_name)} starts ${lead}.`, hostRows())
      }
      break
    }
  }
  return msgs
}

/** Sends the emails for a booking event. Never throws; returns the number of failures. */
export async function notifyBooking(
  supabase: SupabaseClient,
  kind: NotifyKind,
  booking: MeetingBooking,
  host: MeetingSettings,
  extra?: NotifyExtra,
): Promise<number> {
  const [hostEmail, base] = await Promise.all([
    getHostContactEmail(supabase, host),
    getHostEmailSettings(supabase, host.user_id),
  ])
  let failures = 0
  for (const m of build(kind, booking, host, hostEmail, extra)) {
    const settings: EmailSettings = {
      ...base,
      from_name: m.audience === 'invitee' ? (host.display_name || base.from_name) : 'CooVex Meetings',
      reply_to: m.audience === 'invitee' ? (hostEmail || base.reply_to) : booking.invitee_email,
    }
    const res = await sendEmail({ to: m.to, subject: m.subject, html: m.html, text: m.text }, settings)
    if (!res.ok) { failures++; console.error('[meetings] email failed:', kind, m.audience, res.error) }
  }
  return failures
}
