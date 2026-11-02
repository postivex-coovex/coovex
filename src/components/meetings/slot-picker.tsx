'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { addDaysYmd, formatTimeInTz, ymdInTz } from '@/lib/meetings/tz'

interface Props {
  username: string
  eventSlug: string
  color: string
  /** Invitee timezone: all dates and times are shown in this zone. */
  tz: string
  excludeToken?: string
  selected: string | null
  onPick: (startIso: string) => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function SlotPicker({ username, eventSlug, color, tz, excludeToken, selected, onPick }: Props) {
  const [month, setMonth] = useState(() => ymdInTz(Date.now(), tz).slice(0, 7)) // YYYY-MM
  const [slots, setSlots] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [day, setDay] = useState<string | null>(null)

  const [year, mon] = month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate()
  const firstWeekday = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay()
  const todayYmd = ymdInTz(Date.now(), tz)
  const currentMonth = todayYmd.slice(0, 7)

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError('')
    // Ask for one extra day on each side: host dates and invitee dates can differ by a day
    const from = addDaysYmd(`${month}-01`, -1)
    const to = addDaysYmd(`${month}-${String(daysInMonth).padStart(2, '0')}`, 1)
    const q = new URLSearchParams({ username, event: eventSlug, from, to })
    if (excludeToken) q.set('exclude', excludeToken)
    fetch(`/api/meetings/public/slots?${q}`, { signal: ctrl.signal })
      .then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Could not load times')
        setSlots(j.slots as string[])
      })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message || 'Could not load times') })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [month, username, eventSlug, excludeToken, daysInMonth])

  const byDay = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const iso of slots) {
      const key = ymdInTz(new Date(iso).getTime(), tz)
      ;(map[key] ||= []).push(iso)
    }
    return map
  }, [slots, tz])

  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(year, mon - 1 + delta, 1))
    setMonth(d.toISOString().slice(0, 7))
    setDay(null)
  }

  const daySlots = day ? byDay[day] ?? [] : []
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  return (
    <div className="grid md:grid-cols-[1fr_200px] gap-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">{MONTH_NAMES[mon - 1]} {year}</h3>
          <div className="flex gap-1">
            <button type="button" onClick={() => shiftMonth(-1)} disabled={month <= currentMonth} aria-label="Previous month"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-400 mb-1">
          {WEEKDAYS.map(w => <div key={w}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((n, i) => {
            if (n === null) return <div key={`e${i}`} />
            const ymd = `${month}-${String(n).padStart(2, '0')}`
            const available = !!byDay[ymd]?.length
            const isSel = day === ymd
            return (
              <button key={ymd} type="button" disabled={!available} onClick={() => setDay(ymd)}
                style={isSel ? { backgroundColor: color, color: '#ffffff' } : available ? { color } : undefined}
                className={`aspect-square rounded-full text-sm font-medium transition-colors ${
                  isSel ? '' : available ? 'bg-slate-100 hover:bg-slate-200' : 'text-slate-300 cursor-default'
                } ${ymd === todayYmd && !isSel ? 'ring-1 ring-slate-300' : ''}`}>
                {n}
              </button>
            )
          })}
        </div>
        {loading && <p className="mt-3 text-xs text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Loading available times…</p>}
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        {!loading && !error && Object.keys(byDay).filter(k => k.startsWith(month)).length === 0 && (
          <p className="mt-3 text-xs text-slate-500">No times available this month. Try the next month.</p>
        )}
      </div>

      <div>
        {day ? (
          <>
            <p className="text-sm font-semibold text-slate-900 mb-2">
              {new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))}
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {daySlots.map(iso => (
                <button key={iso} type="button" onClick={() => onPick(iso)}
                  style={selected === iso ? { backgroundColor: color, borderColor: color, color: '#ffffff' } : { borderColor: color, color }}
                  className="w-full py-2 rounded-lg border text-sm font-semibold transition-colors hover:bg-slate-50">
                  {formatTimeInTz(iso, tz)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400 md:mt-8">Select a date to see available times.</p>
        )}
      </div>
    </div>
  )
}
