'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, RefreshCw, Trash2, Shield, Lock, Globe, Clock, FileText, Search, Bell, Eye, EyeOff, Save, Users, CheckCircle2, XCircle, Minus, Settings } from 'lucide-react'
import Link from 'next/link'
import { StatusBadge } from './status-badge'
import { ResponseTimeChart } from './response-time-chart'
import type { MonitoredWebsite, WebsiteCheck, WebsiteNotification } from '@/lib/monitoring/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(ms: number | null) {
  if (ms === null) return '—'
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

function DaysLeftBadge({ days, label }: { days: number | null; label: string }) {
  if (days === null) return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-sm text-slate-400 italic">Not available</span>
      <span className="text-[10px] text-slate-300 dark:text-slate-600">Run a check to fetch</span>
    </div>
  )
  const color = days <= 10 ? 'text-red-600 dark:text-red-400' : days <= 30 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`font-semibold ${color}`}>{days}d</span>
    </div>
  )
}

function Bool({ v }: { v: boolean | null }) {
  if (v === null) return <Minus className="w-4 h-4 text-slate-400" />
  return v
    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
    : <XCircle className="w-4 h-4 text-red-400" />
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-medium text-slate-700 dark:text-slate-300">{score}/100</span>
      </div>
      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  down: 'Site Down', recovered: 'Recovered', ssl_expiry: 'SSL Expiry',
  domain_expiry: 'Domain Expiry', slow_load: 'Slow Load',
}

const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400',
  warning: 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400',
  critical: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400',
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  site: MonitoredWebsite
  initialChecks: WebsiteCheck[]
  initialNotifications: WebsiteNotification[]
  isOwner: boolean
}

export function WebsiteDetail({ site: initialSite, initialChecks, initialNotifications, isOwner }: Props) {
  const router = useRouter()
  const [site, setSite]     = useState(initialSite)
  const [checks, setChecks] = useState(initialChecks)
  const [notifications, setNotifications] = useState(initialNotifications)
  const [checking, setChecking] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'security' | 'seo' | 'notifications' | 'credentials' | 'settings'>('overview')
  const [notes, setNotes]   = useState(site.credential_notes ?? '')
  const [notesVisibility, setNotesVisibility] = useState(site.notes_visibility)
  const [savingNotes, setSavingNotes] = useState(false)
  const [showNotes, setShowNotes]   = useState(false)
  const [deleting, setDeleting]     = useState(false)

  // Settings edit state
  const [editName, setEditName]           = useState(site.name)
  const [editUrl, setEditUrl]             = useState(site.url)
  const [editEmails, setEditEmails]       = useState((site.alert_emails ?? []).join(', '))
  const [editThreshold, setEditThreshold] = useState(site.slow_load_threshold_ms ?? 3000)
  const [editAlertDown, setEditAlertDown]           = useState(site.alert_on_down ?? true)
  const [editAlertSsl, setEditAlertSsl]             = useState(site.alert_on_ssl_expiry ?? true)
  const [editAlertDomain, setEditAlertDomain]       = useState(site.alert_on_domain_expiry ?? true)
  const [editAlertSlow, setEditAlertSlow]           = useState(site.alert_on_slow_load ?? false)
  const [savingSettings, setSavingSettings]         = useState(false)

  async function saveSettings() {
    setSavingSettings(true)
    try {
      const res = await fetch(`/api/monitoring/websites/${site.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          url: editUrl.trim(),
          alert_emails: editEmails,
          slow_load_threshold_ms: editThreshold,
          alert_on_down: editAlertDown,
          alert_on_ssl_expiry: editAlertSsl,
          alert_on_domain_expiry: editAlertDomain,
          alert_on_slow_load: editAlertSlow,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      const updated = await res.json()
      setSite(updated)
      toast.success('Settings saved')
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setSavingSettings(false)
    }
  }

  const latestCheck = checks[0]

  const runCheck = useCallback(async () => {
    setChecking(true)
    try {
      const res = await fetch(`/api/monitoring/websites/${site.id}/check`, { method: 'POST' })
      if (!res.ok) throw new Error('Check failed')
      const { result } = await res.json()
      toast.success(`Check complete — site is ${result.isUp ? 'UP' : 'DOWN'}`)
      // Refresh data
      const [siteRes, checksRes] = await Promise.all([
        fetch(`/api/monitoring/websites/${site.id}`),
        fetch(`/api/monitoring/websites/${site.id}/checks?limit=96`),
      ])
      if (siteRes.ok) setSite(await siteRes.json())
      if (checksRes.ok) setChecks(await checksRes.json())
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setChecking(false)
    }
  }, [site.id])

  async function saveNotes() {
    setSavingNotes(true)
    try {
      const res = await fetch(`/api/monitoring/websites/${site.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential_notes: notes, notes_visibility: notesVisibility }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Notes saved')
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setSavingNotes(false)
    }
  }

  async function deleteSite() {
    if (!confirm(`Delete "${site.name}" and all its data? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await fetch(`/api/monitoring/websites/${site.id}`, { method: 'DELETE' })
      toast.success('Website removed')
      router.push('/monitoring')
    } catch {
      toast.error('Delete failed')
      setDeleting(false)
    }
  }

  // Mark notifications read on visit
  useEffect(() => {
    const unread = notifications.some(n => !n.is_read)
    if (unread) {
      fetch(`/api/monitoring/websites/${site.id}/notifications`, { method: 'PATCH' }).catch(() => {})
    }
  }, [site.id, notifications])

  const unreadCount = notifications.filter(n => !n.is_read).length
  const tabs = [
    { id: 'overview',     label: 'Overview' },
    { id: 'security',     label: 'Security' },
    { id: 'seo',          label: 'SEO' },
    { id: 'notifications',label: `Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
    ...(isOwner ? [{ id: 'credentials', label: 'Credentials' }] : []),
    ...(isOwner ? [{ id: 'settings', label: 'Settings' }] : []),
  ] as const

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/monitoring" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Monitoring
          </Link>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="text-slate-700 dark:text-slate-300 font-medium">{site.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runCheck}
            disabled={checking}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking...' : 'Check Now'}
          </button>
          {isOwner && (
            <button onClick={deleteSite} disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Header card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
              <Globe className="w-6 h-6 text-slate-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{site.name}</h1>
              <a href={site.url} target="_blank" rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{site.url}</a>
              {site.last_check_at && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Last checked {new Date(site.last_check_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <StatusBadge status={site.status} size="lg" />
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-xs text-slate-400">7-day Uptime</span>
            <div className={`text-xl font-bold mt-0.5 ${(site.uptime_7d ?? 100) >= 99 ? 'text-green-600 dark:text-green-400' : (site.uptime_7d ?? 100) >= 95 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
              {site.uptime_7d !== null ? `${site.uptime_7d.toFixed(2)}%` : '—'}
            </div>
          </div>
          <div>
            <span className="text-xs text-slate-400">Avg Response</span>
            <div className="text-xl font-bold mt-0.5 text-slate-800 dark:text-slate-200">
              {fmtMs(site.avg_load_time_ms)}
            </div>
          </div>
          <DaysLeftBadge days={site.ssl_days_left} label="SSL Expiry" />
          <DaysLeftBadge days={site.domain_days_left} label="Domain Expiry" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto pb-px">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${activeTab === tab.id
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview ──────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Response time chart */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Response Time (recent checks)</h3>
            <ResponseTimeChart checks={checks} threshold={site.slow_load_threshold_ms} />
          </div>

          {/* Latest check details */}
          {latestCheck && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Last Check Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                {[
                  { label: 'HTTP Status', value: latestCheck.http_status ?? '—' },
                  { label: 'Load Time',   value: fmtMs(latestCheck.load_time_ms) },
                  { label: 'HTTPS',       value: <Bool v={latestCheck.has_https} /> },
                  { label: 'robots.txt',  value: <Bool v={latestCheck.has_robots_txt} /> },
                  { label: 'sitemap.xml', value: <Bool v={latestCheck.has_sitemap} /> },
                  { label: 'SSL Valid',   value: <Bool v={latestCheck.ssl_valid} /> },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-xs text-slate-400">{label}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center">{value}</span>
                  </div>
                ))}
              </div>
              {latestCheck.error_message && (
                <div className="mt-3 px-3 py-2 bg-red-50 dark:bg-red-950/30 rounded-lg text-sm text-red-700 dark:text-red-400 font-mono">
                  {latestCheck.error_message}
                </div>
              )}
            </div>
          )}

          {/* Check history table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Check History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-500 uppercase tracking-wide">
                    {['Time', 'Status', 'HTTP', 'Load time', 'SSL (d)', 'Domain (d)'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {checks.slice(0, 48).map(c => (
                    <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 text-xs">{new Date(c.checked_at).toLocaleString()}</td>
                      <td className="px-4 py-2.5"><Bool v={c.is_up} /></td>
                      <td className="px-4 py-2.5 font-mono text-xs">{c.http_status ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs">{fmtMs(c.load_time_ms)}</td>
                      <td className="px-4 py-2.5 text-xs">{c.ssl_days_left ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs">{c.domain_days_left ?? '—'}</td>
                    </tr>
                  ))}
                  {!checks.length && (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400 text-sm">No checks yet — click "Check Now" to run the first one.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Security ─────────────────────────────────────────────────────────── */}
      {activeTab === 'security' && latestCheck && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Security Headers</h3>
            <span className="ml-auto">
              <ScoreBar score={latestCheck.security_score ?? 0} label="" />
            </span>
          </div>
          <ScoreBar score={latestCheck.security_score ?? 0} label="Security Score" />
          <div className="space-y-3">
            {[
              { key: 'hsts',              label: 'Strict-Transport-Security (HSTS)', desc: 'Forces HTTPS connections' },
              { key: 'xFrame',            label: 'X-Frame-Options',                  desc: 'Prevents clickjacking' },
              { key: 'xContentType',      label: 'X-Content-Type-Options',           desc: 'Prevents MIME sniffing' },
              { key: 'csp',               label: 'Content-Security-Policy',          desc: 'Controls allowed resources' },
              { key: 'referrerPolicy',    label: 'Referrer-Policy',                  desc: 'Controls referrer information' },
              { key: 'permissionsPolicy', label: 'Permissions-Policy',               desc: 'Controls browser features' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-start gap-3 py-2 border-t border-slate-100 dark:border-slate-800 first:border-0">
                <Bool v={(latestCheck.security_headers as Record<string, boolean>)?.[key] ?? false} />
                <div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</div>
                  <div className="text-xs text-slate-400">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* SSL details */}
          <div className="mt-4 pt-5 border-t border-slate-200 dark:border-slate-700">
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-4">
              <Lock className="w-4 h-4 text-blue-500" /> SSL Certificate
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-xs text-slate-400">Valid</span>
                <div className="mt-0.5"><Bool v={latestCheck.ssl_valid} /></div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Expiry</span>
                <div className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                  {latestCheck.ssl_expiry_date ? new Date(latestCheck.ssl_expiry_date).toLocaleDateString() : '—'}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Days Left</span>
                <div className={`font-bold mt-0.5 ${(latestCheck.ssl_days_left ?? 999) <= 10 ? 'text-red-500' : (latestCheck.ssl_days_left ?? 999) <= 30 ? 'text-yellow-500' : 'text-green-500'}`}>
                  {latestCheck.ssl_days_left ?? '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SEO ──────────────────────────────────────────────────────────────── */}
      {activeTab === 'seo' && latestCheck && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">SEO Analysis</h3>
          </div>
          <ScoreBar score={latestCheck.seo_score ?? 0} label="SEO Score" />
          <div className="space-y-3">
            {[
              { key: 'hasTitle',           label: 'Page Title',           value: latestCheck.seo_data?.title },
              { key: 'hasMetaDescription', label: 'Meta Description',     value: latestCheck.seo_data?.metaDescription },
              { key: 'hasOgTitle',         label: 'Open Graph Tags',      value: null },
              { key: 'hasCanonical',       label: 'Canonical URL',        value: null },
              { key: 'has_robots_txt',     label: 'robots.txt',           value: null, boolKey: 'has_robots_txt' as keyof WebsiteCheck },
              { key: 'has_sitemap',        label: 'sitemap.xml',          value: null, boolKey: 'has_sitemap' as keyof WebsiteCheck },
            ].map(({ key, label, value, boolKey }) => (
              <div key={key} className="flex items-start gap-3 py-2 border-t border-slate-100 dark:border-slate-800 first:border-0">
                <Bool v={boolKey ? !!(latestCheck[boolKey]) : !!(latestCheck.seo_data as Record<string, unknown>)?.[key]} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</div>
                  {value && typeof value === 'string' && (
                    <div className="text-xs text-slate-400 truncate mt-0.5">{value}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Notifications ────────────────────────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Bell className="w-4 h-4" /> Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-400">No notifications yet</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.map(n => (
                <div key={n.id} className={`flex items-start gap-4 px-5 py-4 ${!n.is_read ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''}`}>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0 mt-0.5 ${SEVERITY_STYLES[n.severity]}`}>
                    {ALERT_TYPE_LABELS[n.type] ?? n.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{n.message}</div>
                  </div>
                  <span className="text-[10px] text-slate-400 flex-shrink-0 mt-0.5">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Settings ─────────────────────────────────────────────────────────── */}
      {activeTab === 'settings' && isOwner && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Website Settings</h3>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Name</label>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">URL</label>
            <input
              type="url"
              value={editUrl}
              onChange={e => setEditUrl(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          {/* Alert emails */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Alert Emails <span className="font-normal text-slate-400">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={editEmails}
              onChange={e => setEditEmails(e.target.value)}
              placeholder="you@example.com, team@example.com"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Slow load threshold */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Slow Load Threshold: <span className="text-blue-600 dark:text-blue-400">{editThreshold}ms</span>
            </label>
            <input
              type="range" min={500} max={10000} step={500}
              value={editThreshold}
              onChange={e => setEditThreshold(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>500ms</span><span>10s</span>
            </div>
          </div>

          {/* Alert toggles */}
          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3">Alert Triggers</p>
            <div className="space-y-3">
              {([
                { label: 'Site Down',     desc: 'Alert when site is unreachable',       val: editAlertDown,   set: setEditAlertDown },
                { label: 'SSL Expiry',    desc: 'Alert 30 days & 7 days before expiry', val: editAlertSsl,    set: setEditAlertSsl },
                { label: 'Domain Expiry', desc: 'Alert 30 days & 7 days before expiry', val: editAlertDomain, set: setEditAlertDomain },
                { label: 'Slow Load',     desc: 'Alert when response exceeds threshold', val: editAlertSlow,   set: setEditAlertSlow },
              ] as const).map(({ label, desc, val, set }) => (
                <div key={label} className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-800 first:border-0">
                  <div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</div>
                    <div className="text-xs text-slate-400">{desc}</div>
                  </div>
                  <button
                    onClick={() => set((v: boolean) => !v)}
                    className={`relative rounded-full transition-colors flex-shrink-0 ${val ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                    style={{ width: 40, height: 22 }}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 bg-white rounded-full shadow transition-transform ${val ? 'translate-x-[18px]' : ''}`}
                      style={{ width: 18, height: 18 }}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={saveSettings}
            disabled={savingSettings}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Save className="w-4 h-4" />
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}

      {/* ── Credentials ──────────────────────────────────────────────────────── */}
      {activeTab === 'credentials' && isOwner && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Credentials & Notes</h3>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
              <Lock className="w-3 h-3" /> Secure, encrypted at rest
            </span>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300">
            Store credentials, admin passwords, hosting details, notes — anything you need to remember about this site.
            This data is private to you unless you share it with your team.
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              <Users className="inline w-3.5 h-3.5 mr-1" /> Who can see these notes
            </label>
            <div className="flex gap-3">
              {[
                { value: 'private', label: 'Only me', icon: Lock,  desc: 'Owner only' },
                { value: 'team',    label: 'My team', icon: Users, desc: 'Same workspace members' },
              ].map(({ value, label, icon: Icon, desc }) => (
                <button
                  key={value}
                  onClick={() => setNotesVisibility(value as 'private' | 'team')}
                  className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                    notesVisibility === value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${notesVisibility === value ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div>
                    <div className={`text-sm font-medium ${notesVisibility === value ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>{label}</div>
                    <div className="text-[11px] text-slate-400">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Notes textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes</label>
              <button
                onClick={() => setShowNotes(v => !v)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                {showNotes ? <><EyeOff className="w-3 h-3" /> Hide</> : <><Eye className="w-3 h-3" /> Show</>}
              </button>
            </div>
            <textarea
              value={showNotes ? notes : (notes ? '••••••••••••••••' : '')}
              onChange={e => { if (showNotes) setNotes(e.target.value) }}
              placeholder={showNotes ? 'Admin URL: https://...\nUsername: admin\nPassword: ...' : 'Click "Show" to view or edit'}
              rows={8}
              readOnly={!showNotes}
              className={`w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${!showNotes ? 'cursor-not-allowed text-slate-400' : ''}`}
            />
          </div>

          <button
            onClick={saveNotes}
            disabled={savingNotes}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Save className="w-4 h-4" />
            {savingNotes ? 'Saving...' : 'Save Notes'}
          </button>
        </div>
      )}
    </div>
  )
}
