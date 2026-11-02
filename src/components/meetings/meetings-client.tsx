'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CalendarClock, Check, Copy, ExternalLink, Loader2 } from 'lucide-react'
import type { MeetingBooking, MeetingEventType } from '@/lib/meetings/types'
import { api } from './ui'
import { BookingsTab } from './bookings-tab'
import { EventTypesTab } from './event-types-tab'
import { AvailabilityTab } from './availability-tab'
import { SettingsTab } from './settings-tab'
import { browserTimeZone } from './timezone-select'

export interface HostSettings {
  slug: string
  display_name: string | null
  bio: string | null
  timezone: string
  host_email: string | null
  brand_color: string
  zoom_account_id: string | null
  zoom_client_id: string | null
  zoom_client_secret: string
  zoom_connected: boolean
}

type Tab = 'bookings' | 'types' | 'availability' | 'settings'

export function MeetingsClient() {
  const [tab, setTab] = useState<Tab>('bookings')
  const [settings, setSettings] = useState<HostSettings | null>(null)
  const [eventTypes, setEventTypes] = useState<MeetingEventType[]>([])
  const [bookings, setBookings] = useState<MeetingBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const loadBookings = useCallback(async () => {
    const r = await api<{ bookings: MeetingBooking[] }>('/api/meetings/bookings')
    setBookings(r.bookings)
  }, [])
  const loadTypes = useCallback(async () => {
    const r = await api<{ eventTypes: MeetingEventType[] }>('/api/meetings/event-types')
    setEventTypes(r.eventTypes)
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const s = await api<{ settings: HostSettings; is_new: boolean }>('/api/meetings/settings')
        let current = s.settings
        // First visit: default the host timezone to the browser's
        if (s.is_new) {
          const tz = browserTimeZone()
          if (tz !== current.timezone) {
            current = (await api<{ settings: HostSettings }>('/api/meetings/settings', { method: 'PUT', body: JSON.stringify({ timezone: tz }) })).settings
          }
        }
        setSettings(current)
        await Promise.all([loadTypes(), loadBookings()])
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not load Meeting Calendar. Has the database migration been applied?')
      } finally {
        setLoading(false)
      }
    })()
  }, [loadBookings, loadTypes])

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
  if (!settings) return <p className="p-8 text-center text-sm text-slate-500">Meeting Calendar is not available. Please refresh the page.</p>

  const pendingCount = bookings.filter(b => b.status === 'pending').length
  const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/book/${settings.slug}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.')
    }
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'bookings', label: 'Bookings', badge: pendingCount },
    { id: 'types', label: 'Meeting Types' },
    { id: 'availability', label: 'Availability' },
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-blue-600" /> Meeting Calendar
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Share your booking link. Clients pick a time in their own timezone.</p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-1 py-1 max-w-full">
          <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[260px]">{publicUrl}</span>
          <button onClick={copy} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300" aria-label="Copy booking link">
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300" aria-label="Open booking page">
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}>
            {t.label}
            {!!t.badge && <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">{t.badge}</span>}
          </button>
        ))}
      </div>

      {tab === 'bookings' && <BookingsTab bookings={bookings} eventTypes={eventTypes} settings={settings} reload={loadBookings} />}
      {tab === 'types' && <EventTypesTab eventTypes={eventTypes} settings={settings} reload={loadTypes} />}
      {tab === 'availability' && <AvailabilityTab hostTz={settings.timezone} />}
      {tab === 'settings' && <SettingsTab settings={settings} onSaved={setSettings} />}
    </div>
  )
}
