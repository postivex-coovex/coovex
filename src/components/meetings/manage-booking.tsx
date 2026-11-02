'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck, CalendarX2, Clock, ExternalLink, Loader2, MapPin, Video } from 'lucide-react'
import { SlotPicker } from './slot-picker'
import { browserTimeZone, TimezoneSelect } from './timezone-select'
import { formatDateTimeInTz, tzShortName } from '@/lib/meetings/tz'

interface BookingView {
  event_title: string
  start_at: string
  end_at: string
  invitee_name: string
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed' | 'no_show'
  meeting_url: string | null
  location_details: string | null
  host_message: string | null
  cancel_reason: string | null
}
interface Data {
  booking: BookingView
  host: { slug: string; display_name: string | null; brand_color: string }
  event: { slug: string; title: string } | null
}

const STATUS_TEXT: Record<BookingView['status'], { label: string; tone: string }> = {
  pending: { label: 'Waiting for host confirmation', tone: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmed', tone: 'bg-emerald-100 text-emerald-800' },
  declined: { label: 'Declined', tone: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Cancelled', tone: 'bg-slate-200 text-slate-700' },
  completed: { label: 'Completed', tone: 'bg-slate-200 text-slate-700' },
  no_show: { label: 'Missed', tone: 'bg-slate-200 text-slate-700' },
}

export function ManageBooking({ token }: { token: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [tz, setTz] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'cancel' | 'reschedule'>('view')
  const [reason, setReason] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => setTz(browserTimeZone()), [])

  const load = useCallback(async () => {
    const res = await fetch(`/api/meetings/public/booking/${token}`)
    if (!res.ok) { setNotFound(true); return }
    setData(await res.json())
  }, [token])
  useEffect(() => { load() }, [load])

  const act = async (body: Record<string, unknown>) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/meetings/public/booking/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const j = await res.json()
      if (!res.ok) { setError(j.error || 'Something went wrong'); if (res.status === 409) setPicked(null); return }
      setMode('view'); setPicked(null); setReason('')
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (notFound) return <p className="text-center py-10 text-slate-600">We could not find this booking. The link may be wrong or expired.</p>
  if (!data || !tz) return <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>

  const { booking: b, host, event } = data
  const color = host.brand_color
  const hostName = host.display_name || host.slug
  const status = STATUS_TEXT[b.status]
  const open = (b.status === 'pending' || b.status === 'confirmed') && new Date(b.end_at).getTime() > Date.now()

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-slate-500">Meeting with {hostName}</p>
          <h1 className="text-2xl font-bold text-slate-900">{b.event_title}</h1>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.tone}`}>{status.label}</span>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 p-4 space-y-2.5 text-sm text-slate-700">
        <p className="flex gap-2"><Clock className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
          <span>{formatDateTimeInTz(b.start_at, tz)} ({tzShortName(tz, b.start_at)})</span></p>
        {b.meeting_url && (
          <p className="flex gap-2"><Video className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
            <a href={b.meeting_url} target="_blank" rel="noopener noreferrer" style={{ color }} className="font-semibold hover:underline inline-flex items-center gap-1 break-all">
              Join meeting <ExternalLink className="w-3.5 h-3.5" />
            </a></p>
        )}
        {b.location_details && <p className="flex gap-2"><MapPin className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />{b.location_details}</p>}
        {b.host_message && <p className="italic text-slate-600 border-l-2 border-slate-200 pl-3">“{b.host_message}”</p>}
        {b.cancel_reason && <p className="text-slate-600">Reason: {b.cancel_reason}</p>}
      </div>

      {b.status === 'confirmed' && (
        <p className="mt-3 text-sm">
          <a href={`/api/meetings/public/booking/${token}/ics`} style={{ color }} className="font-semibold hover:underline inline-flex items-center gap-1">
            <CalendarCheck className="w-4 h-4" /> Add to calendar (.ics)
          </a>
        </p>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {open && mode === 'view' && (
        <div className="mt-6 flex gap-3 flex-wrap">
          {event && (
            <button onClick={() => { setMode('reschedule'); setError('') }} style={{ backgroundColor: color }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90">Reschedule</button>
          )}
          <button onClick={() => { setMode('cancel'); setError('') }}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5">
            <CalendarX2 className="w-4 h-4" />Cancel meeting
          </button>
        </div>
      )}

      {mode === 'cancel' && (
        <div className="mt-6 space-y-3 max-w-md">
          <label className="block text-sm font-medium text-slate-700">Reason (optional)
            <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:border-transparent" />
          </label>
          <div className="flex gap-3">
            <button disabled={busy} onClick={() => act({ action: 'cancel', reason })}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">
              {busy ? 'Cancelling…' : 'Yes, cancel meeting'}
            </button>
            <button onClick={() => setMode('view')} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100">Keep it</button>
          </div>
        </div>
      )}

      {mode === 'reschedule' && event && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-semibold text-slate-900">Pick a new time</h2>
            <TimezoneSelect value={tz} onChange={setTz} />
          </div>
          <SlotPicker username={host.slug} eventSlug={event.slug} color={color} tz={tz} excludeToken={token} selected={picked} onPick={setPicked} />
          {picked && (
            <div className="mt-5 rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-slate-700">New time: <strong>{formatDateTimeInTz(picked, tz)}</strong> ({tzShortName(tz, picked)})</p>
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => act({ action: 'reschedule', start: picked })} style={{ backgroundColor: color }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                  {busy ? 'Saving…' : 'Confirm new time'}
                </button>
                <button onClick={() => { setMode('view'); setPicked(null) }} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100">Back</button>
              </div>
            </div>
          )}
          {!picked && <button onClick={() => setMode('view')} className="mt-4 text-sm text-slate-500 hover:text-slate-800">← Back</button>}
        </div>
      )}
    </div>
  )
}
