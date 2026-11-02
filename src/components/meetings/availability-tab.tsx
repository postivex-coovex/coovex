'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { api, btnGhost, btnOutline, btnPrimary, inputCls, labelCls, minutesToTime, timeToMinutes } from './ui'

interface Interval { start_minute: number; end_minute: number }
interface Override { date: string; start_minute: number | null; end_minute: number | null }

const DAYS: { id: number; label: string }[] = [
  { id: 1, label: 'Monday' }, { id: 2, label: 'Tuesday' }, { id: 3, label: 'Wednesday' }, { id: 4, label: 'Thursday' },
  { id: 5, label: 'Friday' }, { id: 6, label: 'Saturday' }, { id: 0, label: 'Sunday' },
]

export function AvailabilityTab({ hostTz }: { hostTz: string }) {
  const [week, setWeek] = useState<Record<number, Interval[]>>({})
  const [overrides, setOverrides] = useState<Override[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [ov, setOv] = useState<{ date: string; mode: 'off' | 'custom'; start: string; end: string }>({ date: '', mode: 'off', start: '10:00', end: '14:00' })

  useEffect(() => {
    api<{ weekly: (Interval & { weekday: number })[]; overrides: Override[] }>('/api/meetings/availability')
      .then(r => {
        const w: Record<number, Interval[]> = {}
        for (const i of r.weekly) (w[i.weekday] ||= []).push({ start_minute: i.start_minute, end_minute: i.end_minute })
        setWeek(w)
        setOverrides(r.overrides)
      })
      .catch(e => toast.error(e instanceof Error ? e.message : 'Could not load availability'))
      .finally(() => setLoading(false))
  }, [])

  const edit = (fn: () => void) => { fn(); setDirty(true); setError('') }

  const setDay = (day: number, list: Interval[]) => edit(() => setWeek(w => ({ ...w, [day]: list })))

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const weekly = Object.entries(week).flatMap(([d, list]) => list.map(i => ({ weekday: Number(d), ...i })))
      await api('/api/meetings/availability', { method: 'PUT', body: JSON.stringify({ weekly, overrides }) })
      toast.success('Availability saved')
      setDirty(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const addOverride = () => {
    if (!ov.date) return
    const row: Override = ov.mode === 'off'
      ? { date: ov.date, start_minute: null, end_minute: null }
      : { date: ov.date, start_minute: timeToMinutes(ov.start), end_minute: timeToMinutes(ov.end) }
    if (row.start_minute !== null && row.end_minute! <= row.start_minute) { setError('End time must be after start time'); return }
    edit(() => setOverrides(list => [...list, row].sort((a, b) => a.date.localeCompare(b.date))))
    setOv(o => ({ ...o, date: '' }))
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Weekly hours</h2>
            <p className="text-xs text-slate-500">Times are in your timezone: <span className="font-medium">{hostTz.replace(/_/g, ' ')}</span>. Change it in Settings.</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {DAYS.map(({ id, label }) => {
            const list = week[id] ?? []
            return (
              <div key={id} className="py-3 flex gap-4 items-start">
                <label className="flex items-center gap-2 w-32 pt-2 shrink-0 text-sm font-medium text-slate-800 dark:text-slate-200">
                  <input type="checkbox" checked={list.length > 0} className="accent-blue-600"
                    onChange={e => setDay(id, e.target.checked ? [{ start_minute: 540, end_minute: 1020 }] : [])} />
                  {label}
                </label>
                <div className="flex-1 space-y-2">
                  {list.length === 0 && <p className="pt-2 text-sm text-slate-400">Unavailable</p>}
                  {list.map((iv, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="time" value={minutesToTime(iv.start_minute)} className={`${inputCls} !w-32`}
                        onChange={e => setDay(id, list.map((x, j) => j === i ? { ...x, start_minute: timeToMinutes(e.target.value) } : x))} />
                      <span className="text-slate-400">–</span>
                      <input type="time" value={minutesToTime(iv.end_minute === 1440 ? 1439 : iv.end_minute)} className={`${inputCls} !w-32`}
                        onChange={e => setDay(id, list.map((x, j) => j === i ? { ...x, end_minute: timeToMinutes(e.target.value) || 1440 } : x))} />
                      <button className="p-1.5 text-slate-400 hover:text-red-600" aria-label="Remove time range"
                        onClick={() => setDay(id, list.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
                      {i === list.length - 1 && list.length < 4 && (
                        <button className="p-1.5 text-slate-400 hover:text-blue-600" aria-label="Add time range"
                          onClick={() => setDay(id, [...list, { start_minute: Math.min(iv.end_minute + 60, 1380), end_minute: Math.min(iv.end_minute + 180, 1440) }])}><Plus className="w-4 h-4" /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">Date overrides</h2>
        <p className="text-xs text-slate-500 mb-4">Block a holiday or set different hours for a specific date.</p>
        <div className="flex flex-wrap items-end gap-3">
          <div><label className={labelCls}>Date</label>
            <input type="date" value={ov.date} onChange={e => setOv(o => ({ ...o, date: e.target.value }))} className={`${inputCls} !w-44`} /></div>
          <div><label className={labelCls}>Availability</label>
            <select value={ov.mode} onChange={e => setOv(o => ({ ...o, mode: e.target.value as 'off' | 'custom' }))} className={`${inputCls} !w-44`}>
              <option value="off">Unavailable all day</option><option value="custom">Custom hours</option>
            </select></div>
          {ov.mode === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="time" value={ov.start} onChange={e => setOv(o => ({ ...o, start: e.target.value }))} className={`${inputCls} !w-32`} />
              <span className="text-slate-400">–</span>
              <input type="time" value={ov.end} onChange={e => setOv(o => ({ ...o, end: e.target.value }))} className={`${inputCls} !w-32`} />
            </div>
          )}
          <button className={btnOutline} disabled={!ov.date} onClick={addOverride}><Plus className="w-4 h-4" />Add</button>
        </div>
        {overrides.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {overrides.map((o, i) => (
              <li key={`${o.date}-${i}`} className="py-2 flex items-center justify-between">
                <span className="text-slate-800 dark:text-slate-200">
                  {new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${o.date}T00:00:00Z`))}
                  <span className="text-slate-500"> · {o.start_minute === null ? 'Unavailable' : `${minutesToTime(o.start_minute)} – ${minutesToTime(o.end_minute!)}`}</span>
                </span>
                <button className={btnGhost} aria-label="Remove override" onClick={() => edit(() => setOverrides(l => l.filter((_, j) => j !== i)))}><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button className={btnPrimary} disabled={saving || !dirty} onClick={save}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}Save availability
        </button>
      </div>
    </div>
  )
}
