'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CalendarX2, Check, Clock, ExternalLink, Link2, Loader2, Mail, Phone, RefreshCw, Video, X } from 'lucide-react'
import type { BookingStatus, MeetingBooking, MeetingEventType } from '@/lib/meetings/types'
import { formatDateTimeInTz, minuteOfDayInTz, tzShortName, ymdInTz, zonedToUtcMs } from '@/lib/meetings/tz'
import type { HostSettings } from './meetings-client'
import { api, btnGhost, btnOutline, btnPrimary, inputCls, labelCls, minutesToTime, Modal, timeToMinutes } from './ui'

type Filter = 'upcoming' | 'pending' | 'past' | 'closed'
type ModalState =
  | { type: 'confirm' | 'decline' | 'cancel' | 'reschedule' | 'link'; booking: MeetingBooking }
  | null

const STATUS_STYLE: Record<BookingStatus, string> = {
  pending: 'bg-amber-500 text-white',
  confirmed: 'bg-emerald-600 text-white',
  declined: 'bg-red-600 text-white',
  cancelled: 'bg-slate-500 text-white',
  completed: 'bg-slate-500 text-white',
  no_show: 'bg-slate-500 text-white',
}

const toLocalInput = (iso: string, tz: string) => {
  const ms = new Date(iso).getTime()
  return `${ymdInTz(ms, tz)}T${minutesToTime(minuteOfDayInTz(ms, tz))}`
}
const fromLocalInput = (v: string, tz: string) => {
  const [d, t] = v.split('T')
  return new Date(zonedToUtcMs(d, timeToMinutes(t), tz)).toISOString()
}

interface Props {
  bookings: MeetingBooking[]
  eventTypes: MeetingEventType[]
  settings: HostSettings
  reload: () => Promise<void>
}

export function BookingsTab({ bookings, eventTypes, settings, reload }: Props) {
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [modal, setModal] = useState<ModalState>(null)
  const now = Date.now()

  const groups = useMemo(() => {
    const upcoming: MeetingBooking[] = [], pending: MeetingBooking[] = [], past: MeetingBooking[] = [], closed: MeetingBooking[] = []
    for (const b of bookings) {
      const ended = new Date(b.end_at).getTime() < now
      if (b.status === 'cancelled' || b.status === 'declined') closed.push(b)
      else if (b.status === 'pending' && !ended) pending.push(b)
      else if (b.status === 'confirmed' && !ended) upcoming.push(b)
      else past.push(b)
    }
    past.reverse(); closed.reverse()
    return { upcoming, pending, past, closed }
  }, [bookings, now])

  const list = groups[filter]
  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'upcoming', label: `Upcoming (${groups.upcoming.length})` },
    { id: 'pending', label: `Needs confirmation (${groups.pending.length})` },
    { id: 'past', label: 'Past' },
    { id: 'closed', label: 'Cancelled' },
  ]

  const simple = async (b: MeetingBooking, action: 'complete' | 'no_show') => {
    try {
      await api(`/api/meetings/bookings/${b.id}`, { method: 'PATCH', body: JSON.stringify({ action }) })
      await reload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}>{f.label}</button>
        ))}
        <button onClick={() => reload()} className={`${btnGhost} !py-1.5 ml-auto`} aria-label="Refresh"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{filter === 'pending' ? 'Nothing waiting for confirmation' : 'No bookings here yet'}</p>
          {filter === 'upcoming' && <p className="text-xs mt-1">Share your booking link to get your first meeting.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(b => {
            const ended = new Date(b.end_at).getTime() < now
            return (
              <div key={b.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{b.invitee_name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLE[b.status]}`}>{b.status.replace('_', ' ')}</span>
                    </div>
                    <p className="text-sm text-slate-500">{b.event_title}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{formatDateTimeInTz(b.start_at, settings.timezone)}</p>
                    <p className="text-xs text-slate-500">Your time ({tzShortName(settings.timezone, b.start_at)})</p>
                  </div>
                </div>

                <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" /><a className="hover:underline" href={`mailto:${b.invitee_email}`}>{b.invitee_email}</a></p>
                  {b.invitee_phone && <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" />{b.invitee_phone}</p>}
                  <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" />
                    Their time: {formatDateTimeInTz(b.start_at, b.invitee_timezone)} ({tzShortName(b.invitee_timezone, b.start_at)})</p>
                  {b.meeting_url && (
                    <p className="flex items-center gap-1.5"><Video className="w-3.5 h-3.5 text-slate-400" />
                      <a className="text-blue-600 hover:underline inline-flex items-center gap-1 truncate" href={b.meeting_url} target="_blank" rel="noopener noreferrer">
                        Join link <ExternalLink className="w-3 h-3" /></a></p>
                  )}
                  {b.location_details && <p className="text-slate-500">{b.location_details}</p>}
                </div>
                {(b.notes || b.answers.length > 0) && (
                  <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    {b.answers.map(a => <p key={a.label}><span className="font-medium">{a.label}:</span> {a.answer}</p>)}
                    {b.notes && <p className="whitespace-pre-line"><span className="font-medium">Notes:</span> {b.notes}</p>}
                  </div>
                )}
                {b.cancel_reason && <p className="mt-2 text-xs text-slate-500">Reason: {b.cancel_reason} ({b.cancelled_by})</p>}

                <div className="mt-3 flex flex-wrap gap-2">
                  {b.status === 'pending' && !ended && (
                    <>
                      <button className={btnPrimary} onClick={() => setModal({ type: 'confirm', booking: b })}><Check className="w-4 h-4" />Confirm</button>
                      <button className={btnOutline} onClick={() => setModal({ type: 'decline', booking: b })}><X className="w-4 h-4" />Decline</button>
                    </>
                  )}
                  {b.status === 'confirmed' && !ended && (
                    <>
                      <button className={btnOutline} onClick={() => setModal({ type: 'link', booking: b })}><Link2 className="w-4 h-4" />Edit link</button>
                      <button className={btnOutline} onClick={() => setModal({ type: 'reschedule', booking: b })}><Clock className="w-4 h-4" />Reschedule</button>
                    </>
                  )}
                  {(b.status === 'pending' || b.status === 'confirmed') && !ended && (
                    <button className={`${btnGhost} text-red-600 dark:text-red-400`} onClick={() => setModal({ type: 'cancel', booking: b })}><CalendarX2 className="w-4 h-4" />Cancel</button>
                  )}
                  {b.status === 'confirmed' && ended && (
                    <>
                      <button className={btnOutline} onClick={() => simple(b, 'complete')}>Mark completed</button>
                      <button className={btnOutline} onClick={() => simple(b, 'no_show')}>No-show</button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <BookingModal state={modal} settings={settings} eventTypes={eventTypes}
          onClose={() => setModal(null)} onDone={async () => { setModal(null); await reload() }} />
      )}
    </div>
  )
}

function BookingModal({ state, settings, eventTypes, onClose, onDone }: {
  state: NonNullable<ModalState>
  settings: HostSettings
  eventTypes: MeetingEventType[]
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const { booking: b, type } = state
  const event = eventTypes.find(e => e.id === b.event_type_id)
  const zoomDefault = settings.zoom_connected && (b.location_type === 'zoom' || event?.location_type === 'zoom')
  const prefillUrl = b.meeting_url || (event?.location_type === 'custom_link' && /^https?:\/\//i.test(event.location_value || '') ? event.location_value! : '')

  const [message, setMessage] = useState('')
  const [url, setUrl] = useState(prefillUrl)
  const eventDetails = event?.location_type === 'phone' ? (event.location_value ? `Phone: ${event.location_value}` : '')
    : event?.location_type === 'in_person' ? (event.location_value || '') : ''
  const [details, setDetails] = useState(b.location_details || eventDetails)
  const [useZoom, setUseZoom] = useState(type === 'confirm' && zoomDefault)
  const [when, setWhen] = useState(toLocalInput(b.start_at, settings.timezone))
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const timeChanged = fromLocalInput(when, settings.timezone) !== new Date(b.start_at).toISOString()

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      let body: Record<string, unknown>
      if (type === 'confirm' && !useZoom && !url.trim() && !details.trim() && b.location_type !== 'phone' && b.location_type !== 'in_person') {
        setError('Add a meeting link or some details so the client knows how to join.')
        setBusy(false)
        return
      }
      if (type === 'confirm') {
        body = {
          action: 'confirm', message: message || undefined,
          ...(timeChanged ? { start: fromLocalInput(when, settings.timezone) } : {}),
          ...(useZoom ? { create_zoom: true, location_details: details || undefined } : { meeting_url: url, location_details: details }),
        }
      } else if (type === 'decline') body = { action: 'decline', message: message || undefined }
      else if (type === 'cancel') body = { action: 'cancel', message: message || undefined }
      else if (type === 'reschedule') body = { action: 'reschedule', start: fromLocalInput(when, settings.timezone) }
      else body = { action: 'update_link', meeting_url: url, location_details: details, notify }
      await api(`/api/meetings/bookings/${b.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      toast.success(
        type === 'confirm' ? 'Booking confirmed. The client was emailed.' :
        type === 'decline' ? 'Request declined' : type === 'cancel' ? 'Meeting cancelled' :
        type === 'reschedule' ? 'Meeting rescheduled. The client was emailed.' : 'Link updated',
      )
      await onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const titles = { confirm: 'Confirm booking', decline: 'Decline request', cancel: 'Cancel meeting', reschedule: 'Reschedule meeting', link: 'Edit meeting link' }
  const showTime = type === 'confirm' || type === 'reschedule'
  const showLink = type === 'confirm' || type === 'link'
  const showMsg = type === 'confirm' || type === 'decline' || type === 'cancel'

  return (
    <Modal title={titles[type]} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <span className="font-medium">{b.invitee_name}</span> · {b.event_title}
        </p>

        {showTime && (
          <div>
            <label className={labelCls}>Meeting time ({settings.timezone.replace(/_/g, ' ')})</label>
            <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className={inputCls} />
            <p className="text-xs text-slate-500 mt-1">
              Client sees: {formatDateTimeInTz(fromLocalInput(when, settings.timezone), b.invitee_timezone)} ({tzShortName(b.invitee_timezone)})
            </p>
          </div>
        )}

        {showLink && (
          <>
            {type === 'confirm' && settings.zoom_connected && (
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={useZoom} onChange={e => setUseZoom(e.target.checked)} className="rounded accent-blue-600" />
                Generate a Zoom meeting automatically
              </label>
            )}
            {!useZoom && (
              <div>
                <label className={labelCls}>Meeting link</label>
                <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://meet.google.com/…" className={inputCls} />
              </div>
            )}
            <div>
              <label className={labelCls}>Extra details (optional)</label>
              <input value={details} onChange={e => setDetails(e.target.value)} placeholder="Passcode, phone number, address…" className={inputCls} />
            </div>
          </>
        )}

        {showMsg && (
          <div>
            <label className={labelCls}>{type === 'confirm' ? 'Message to client (optional)' : 'Reason (optional, shared with client)'}</label>
            <textarea rows={3} value={message} onChange={e => setMessage(e.target.value)} className={inputCls} />
          </div>
        )}

        {type === 'link' && (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} className="rounded accent-blue-600" />
            Email the updated details to the client
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnGhost} onClick={onClose}>Close</button>
          <button disabled={busy} onClick={submit}
            className={type === 'decline' || type === 'cancel' ? 'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-60' : btnPrimary}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {type === 'confirm' ? 'Confirm & email client' : type === 'decline' ? 'Decline' : type === 'cancel' ? 'Cancel meeting' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
