'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Copy, Pencil, Plus, Trash2, Loader2 } from 'lucide-react'
import { LOCATION_LABELS, type LocationType, type MeetingEventType, type MeetingQuestion } from '@/lib/meetings/types'
import type { HostSettings } from './meetings-client'
import { api, btnGhost, btnOutline, btnPrimary, inputCls, labelCls, Modal } from './ui'

const DURATIONS = [15, 20, 30, 45, 60, 90, 120]

interface Draft {
  id?: string
  title: string
  slug: string
  description: string
  duration_min: number
  buffer_before_min: number
  buffer_after_min: number
  min_notice_hours: number
  max_days_ahead: number
  slot_interval_min: number
  location_type: LocationType
  location_value: string
  requires_confirmation: boolean
  questions: MeetingQuestion[]
  color: string
  active: boolean
}

const blank: Draft = {
  title: '', slug: '', description: '', duration_min: 30, buffer_before_min: 0, buffer_after_min: 0,
  min_notice_hours: 4, max_days_ahead: 60, slot_interval_min: 30, location_type: 'zoom', location_value: '',
  requires_confirmation: false, questions: [], color: '#2563eb', active: true,
}

const fromType = (t: MeetingEventType): Draft => ({
  id: t.id, title: t.title, slug: t.slug, description: t.description || '', duration_min: t.duration_min,
  buffer_before_min: t.buffer_before_min, buffer_after_min: t.buffer_after_min, min_notice_hours: t.min_notice_hours,
  max_days_ahead: t.max_days_ahead, slot_interval_min: t.slot_interval_min, location_type: t.location_type,
  location_value: t.location_value || '', requires_confirmation: t.requires_confirmation,
  questions: t.questions ?? [], color: t.color, active: t.active,
})

function NumberField({ label, value, onChange, min, max, suffix }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; suffix: string }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-2">
        <input type="number" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} className={inputCls} />
        <span className="text-xs text-slate-500 shrink-0">{suffix}</span>
      </div>
    </div>
  )
}

export function EventTypesTab({ eventTypes, settings, reload }: { eventTypes: MeetingEventType[]; settings: HostSettings; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<MeetingEventType | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const link = (t: MeetingEventType) => `${window.location.origin}/book/${settings.slug}/${t.slug}`

  const copy = async (t: MeetingEventType) => {
    try { await navigator.clipboard.writeText(link(t)); toast.success('Link copied') } catch { toast.error('Could not copy the link') }
  }

  const save = async () => {
    if (!draft) return
    setBusy(true)
    setError('')
    try {
      const { id, ...payload } = draft
      const body = JSON.stringify({ ...payload, slug: payload.slug || undefined })
      await api(id ? `/api/meetings/event-types/${id}` : '/api/meetings/event-types', { method: id ? 'PUT' : 'POST', body })
      toast.success(id ? 'Meeting type updated' : 'Meeting type created')
      setDraft(null)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (t: MeetingEventType) => {
    try {
      const d = fromType(t)
      const { id, ...payload } = { ...d, active: !t.active }
      await api(`/api/meetings/event-types/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      await reload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  const remove = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await api(`/api/meetings/event-types/${deleting.id}`, { method: 'DELETE' })
      toast.success('Meeting type deleted')
      setDeleting(null)
      await reload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false) }
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => (d ? { ...d, [k]: v } : d))

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">Each meeting type has its own link, length and location.</p>
        <button className={btnPrimary} onClick={() => { setDraft({ ...blank, location_type: settings.zoom_connected ? 'zoom' : 'custom_link' }); setError('') }}>
          <Plus className="w-4 h-4" />New meeting type
        </button>
      </div>

      {eventTypes.length === 0 ? (
        <p className="text-center py-16 text-sm text-slate-400">No meeting types yet. Create one to start taking bookings.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {eventTypes.map(t => (
            <div key={t.id} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 rounded-xl p-4 ${t.active ? '' : 'opacity-60'}`} style={{ borderLeftColor: t.color }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{t.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{t.duration_min} min · {LOCATION_LABELS[t.location_type].split(' (')[0]}{t.requires_confirmation ? ' · needs approval' : ''}</p>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0 cursor-pointer">
                  <input type="checkbox" checked={t.active} onChange={() => toggleActive(t)} className="accent-blue-600" />
                  {t.active ? 'Active' : 'Hidden'}
                </label>
              </div>
              {t.location_type === 'zoom' && !settings.zoom_connected && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Connect Zoom in Settings to auto-create links</p>
              )}
              <p className="mt-2 text-xs text-slate-400 truncate">/book/{settings.slug}/{t.slug}</p>
              <div className="mt-3 flex gap-1.5">
                <button className={btnOutline} onClick={() => copy(t)}><Copy className="w-3.5 h-3.5" />Copy link</button>
                <button className={btnGhost} onClick={() => { setDraft(fromType(t)); setError('') }}><Pencil className="w-3.5 h-3.5" />Edit</button>
                <button className={`${btnGhost} text-red-600 dark:text-red-400 ml-auto`} onClick={() => setDeleting(t)} aria-label="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <Modal wide title={draft.id ? 'Edit meeting type' : 'New meeting type'} onClose={() => setDraft(null)}>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Title *</label>
                <input value={draft.title} onChange={e => set('title', e.target.value)} placeholder="30 minute intro call" className={inputCls} />
              </div>
              {draft.id && (
                <div className="sm:col-span-2">
                  <label className={labelCls}>URL</label>
                  <div className="flex items-center gap-1 text-sm text-slate-500">
                    <span className="shrink-0">/book/{settings.slug}/</span>
                    <input value={draft.slug} onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className={inputCls} />
                  </div>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className={labelCls}>Description</label>
                <textarea rows={2} value={draft.description} onChange={e => set('description', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Duration</label>
                <select value={DURATIONS.includes(draft.duration_min) ? draft.duration_min : 'custom'}
                  onChange={e => e.target.value !== 'custom' && set('duration_min', Number(e.target.value))} className={inputCls}>
                  {DURATIONS.map(d => <option key={d} value={d}>{d} minutes</option>)}
                  {!DURATIONS.includes(draft.duration_min) && <option value="custom">{draft.duration_min} minutes</option>}
                </select>
              </div>
              <div>
                <label className={labelCls}>Color</label>
                <input type="color" value={draft.color} onChange={e => set('color', e.target.value)} className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1" />
              </div>
              <div>
                <label className={labelCls}>Location</label>
                <select value={draft.location_type} onChange={e => {
                  const v = e.target.value as LocationType
                  setDraft(d => d && ({ ...d, location_type: v, requires_confirmation: v === 'host_provides' ? true : d.requires_confirmation }))
                }} className={inputCls}>
                  {(Object.keys(LOCATION_LABELS) as LocationType[]).map(l => <option key={l} value={l}>{LOCATION_LABELS[l]}</option>)}
                </select>
              </div>
              {(draft.location_type === 'custom_link' || draft.location_type === 'phone' || draft.location_type === 'in_person') && (
                <div>
                  <label className={labelCls}>{draft.location_type === 'custom_link' ? 'Meeting link' : draft.location_type === 'phone' ? 'Phone number to call' : 'Address'}</label>
                  <input value={draft.location_value} onChange={e => set('location_value', e.target.value)}
                    placeholder={draft.location_type === 'custom_link' ? 'https://meet.google.com/…' : ''} className={inputCls} />
                </div>
              )}
            </div>
            {draft.location_type === 'zoom' && !settings.zoom_connected && (
              <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Zoom is not connected yet. Bookings will be saved, but no link is generated until you connect Zoom in Settings.</p>
            )}
            {draft.location_type === 'host_provides' && (
              <p className="text-xs text-slate-500">Every request waits for your approval. You add the meeting link when you confirm.</p>
            )}

            <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={draft.requires_confirmation} disabled={draft.location_type === 'host_provides'}
                onChange={e => set('requires_confirmation', e.target.checked)} className="mt-0.5 rounded accent-blue-600" />
              <span>Require my confirmation before a booking is final<br />
                <span className="text-xs text-slate-500">Otherwise bookings are confirmed instantly and the client gets the link right away.</span></span>
            </label>

            <details className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
              <summary className="text-sm font-medium cursor-pointer text-slate-700 dark:text-slate-200">Scheduling rules</summary>
              <div className="grid sm:grid-cols-2 gap-4 mt-3">
                <NumberField label="Minimum notice" value={draft.min_notice_hours} min={0} max={720} suffix="hours" onChange={n => set('min_notice_hours', n)} />
                <NumberField label="Book up to" value={draft.max_days_ahead} min={1} max={365} suffix="days ahead" onChange={n => set('max_days_ahead', n)} />
                <NumberField label="Buffer before" value={draft.buffer_before_min} min={0} max={240} suffix="min" onChange={n => set('buffer_before_min', n)} />
                <NumberField label="Buffer after" value={draft.buffer_after_min} min={0} max={240} suffix="min" onChange={n => set('buffer_after_min', n)} />
                <NumberField label="Start times every" value={draft.slot_interval_min} min={5} max={240} suffix="min" onChange={n => set('slot_interval_min', n)} />
              </div>
            </details>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls + ' !mb-0'}>Questions for the client</label>
                {draft.questions.length < 10 && (
                  <button type="button" className="text-xs text-blue-600 hover:underline"
                    onClick={() => set('questions', [...draft.questions, { id: Math.random().toString(36).slice(2, 8), label: '', required: false }])}>+ Add question</button>
                )}
              </div>
              <div className="space-y-2">
                {draft.questions.map((q, i) => (
                  <div key={q.id} className="flex items-center gap-2">
                    <input value={q.label} placeholder="e.g. What would you like to discuss?" className={inputCls}
                      onChange={e => set('questions', draft.questions.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                    <label className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                      <input type="checkbox" checked={q.required} className="accent-blue-600"
                        onChange={e => set('questions', draft.questions.map((x, j) => j === i ? { ...x, required: e.target.checked } : x))} />Required
                    </label>
                    <button type="button" className="text-slate-400 hover:text-red-600" aria-label="Remove question"
                      onClick={() => set('questions', draft.questions.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setDraft(null)}>Close</button>
              <button className={btnPrimary} disabled={busy || draft.title.trim().length < 2} onClick={save}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}{draft.id ? 'Save changes' : 'Create'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal title="Delete meeting type?" onClose={() => setDeleting(null)}>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            “{deleting.title}” will stop accepting bookings and its link will show a not-found page. Existing bookings are kept.
          </p>
          <div className="flex justify-end gap-2 mt-5">
            <button className={btnGhost} onClick={() => setDeleting(null)}>Keep it</button>
            <button disabled={busy} onClick={remove} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-60">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
