'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarCheck, CalendarClock, Clock, Loader2, MapPin, Video } from 'lucide-react'
import { SlotPicker } from './slot-picker'
import { browserTimeZone, TimezoneSelect } from './timezone-select'
import { formatDateTimeInTz, tzShortName } from '@/lib/meetings/tz'
import type { LocationType, MeetingQuestion } from '@/lib/meetings/types'

interface Props {
  username: string
  hostName: string
  color: string
  event: {
    slug: string
    title: string
    description: string | null
    duration_min: number
    location_type: LocationType
    requires_confirmation: boolean
    questions: MeetingQuestion[]
  }
}

interface Result { token: string; status: string }

const LOCATION_TEXT: Record<LocationType, string> = {
  zoom: 'Zoom video call',
  custom_link: 'Online video call',
  phone: 'Phone call',
  in_person: 'In person',
  host_provides: 'Meeting details sent after confirmation',
}

export function BookingFlow({ username, hostName, color, event }: Props) {
  const [tz, setTz] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '', website: '' })
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)

  // Detect the visitor's timezone in the browser
  useEffect(() => setTz(browserTimeZone()), [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!picked || !tz) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/meetings/public/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, event: event.slug, start: picked, timezone: tz, answers, ...form }),
      })
      const j = await res.json()
      if (!res.ok) {
        setError(j.error || 'Something went wrong')
        if (res.status === 409) setPicked(null)
        return
      }
      setResult({ token: j.token, status: j.booking?.status ?? 'pending' })
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent'
  const ringStyle = { '--tw-ring-color': color } as React.CSSProperties

  if (result && picked && tz) {
    const confirmed = result.status === 'confirmed'
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: color }}>
          <CalendarCheck className="w-7 h-7 text-white" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900">{confirmed ? 'You are booked!' : 'Request sent'}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {confirmed
            ? `A confirmation was sent to ${form.email}.`
            : `${hostName} will review your request. We will email you at ${form.email} once it is confirmed.`}
        </p>
        <div className="mt-5 mx-auto max-w-sm text-left rounded-xl border border-slate-200 p-4 space-y-2 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">{event.title} with {hostName}</p>
          <p className="flex gap-2"><Clock className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />{formatDateTimeInTz(picked, tz)} ({tzShortName(tz, picked)})</p>
          <p className="flex gap-2"><Video className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />{LOCATION_TEXT[event.location_type]}</p>
        </div>
        <Link href={`/booking/${result.token}`} style={{ backgroundColor: color }}
          className="inline-block mt-5 px-5 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90">
          View, reschedule or cancel
        </Link>
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-8">
      <aside className="space-y-3">
        <p className="text-sm text-slate-500">{hostName}</p>
        <h1 className="text-2xl font-bold text-slate-900">{event.title}</h1>
        <div className="space-y-2 text-sm text-slate-600">
          <p className="flex gap-2"><Clock className="w-4 h-4 mt-0.5 text-slate-400" />{event.duration_min} min</p>
          <p className="flex gap-2">
            {event.location_type === 'in_person' ? <MapPin className="w-4 h-4 mt-0.5 text-slate-400" /> : <Video className="w-4 h-4 mt-0.5 text-slate-400" />}
            {LOCATION_TEXT[event.location_type]}
          </p>
          {event.requires_confirmation && (
            <p className="flex gap-2"><CalendarClock className="w-4 h-4 mt-0.5 text-slate-400" />Needs host approval</p>
          )}
        </div>
        {event.description && <p className="text-sm text-slate-600 whitespace-pre-line">{event.description}</p>}
      </aside>

      <section>
        {!tz ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : !picked ? (
          <>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-semibold text-slate-900">Select a date &amp; time</h2>
              <TimezoneSelect value={tz} onChange={setTz} />
            </div>
            <SlotPicker username={username} eventSlug={event.slug} color={color} tz={tz} selected={picked} onPick={setPicked} />
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4 max-w-md">
            <button type="button" onClick={() => setPicked(null)} className="text-sm text-slate-500 hover:text-slate-800">← Change time</button>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">{formatDateTimeInTz(picked, tz)}</p>
              <p className="text-xs text-slate-500 mt-0.5">{tz.replace(/_/g, ' ')} ({tzShortName(tz, picked)}) · {event.duration_min} min</p>
            </div>

            <label className="block text-sm font-medium text-slate-700">Your name *
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={`${input} mt-1`} style={ringStyle} autoComplete="name" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Email *
              <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={`${input} mt-1`} style={ringStyle} autoComplete="email" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Phone (optional)
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={`${input} mt-1`} style={ringStyle} autoComplete="tel" />
            </label>
            {event.questions.map(q => (
              <label key={q.id} className="block text-sm font-medium text-slate-700">{q.label}{q.required ? ' *' : ''}
                <input required={q.required} value={answers[q.id] || ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} className={`${input} mt-1`} style={ringStyle} />
              </label>
            ))}
            <label className="block text-sm font-medium text-slate-700">Anything we should know? (optional)
              <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={`${input} mt-1`} style={ringStyle} />
            </label>
            {/* Honeypot: hidden from people, filled by bots */}
            <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))} className="hidden" name="website" />

            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={submitting} style={{ backgroundColor: color }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {event.requires_confirmation ? 'Request meeting' : 'Confirm booking'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
