'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Globe, AlertTriangle, Shield, Clock, TrendingUp, RefreshCw } from 'lucide-react'
import { StatusDot, StatusBadge } from './status-badge'
import { AddWebsiteDialog } from './add-website-dialog'
import { CsvImportDialog } from './csv-import-dialog'
import type { MonitoredWebsite } from '@/lib/monitoring/types'

function fmtMs(ms: number | null) {
  if (ms === null) return '—'
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

function fmtUptime(u: number | null) {
  if (u === null) return '—'
  return `${u.toFixed(1)}%`
}

// SSL: red ≤10d, yellow ≤30d  |  Domain: red ≤30d, yellow ≤60d
function sslColor(days: number | null): string {
  if (days === null) return 'text-slate-400 dark:text-slate-500'
  if (days <= 10) return 'text-red-600 dark:text-red-400 font-semibold'
  if (days <= 30) return 'text-yellow-600 dark:text-yellow-400 font-medium'
  return 'text-slate-500 dark:text-slate-400'
}

function domainColor(days: number | null): string {
  if (days === null) return 'text-slate-400 dark:text-slate-500'
  if (days <= 30) return 'text-red-600 dark:text-red-400 font-semibold'
  if (days <= 60) return 'text-yellow-600 dark:text-yellow-400 font-medium'
  return 'text-slate-500 dark:text-slate-400'
}

// Priority: 0 = critical, 1 = warning, 2 = ok
function sitePriority(site: MonitoredWebsite): number {
  if (site.status === 'down') return 0
  if ((site.ssl_days_left ?? 999) <= 10 || (site.domain_days_left ?? 999) <= 30) return 0
  if ((site.ssl_days_left ?? 999) <= 30 || (site.domain_days_left ?? 999) <= 60) return 1
  return 2
}

function DaysChip({ days, label, type }: { days: number | null; label: string; type: 'ssl' | 'domain' }) {
  if (days === null) return <span className="text-slate-300 dark:text-slate-600 text-xs">{label}: N/A</span>
  const color = type === 'ssl' ? sslColor(days) : domainColor(days)
  return <span className={`text-xs ${color}`}>{label}: {days}d</span>
}

function rowAccent(site: MonitoredWebsite): string {
  const p = sitePriority(site)
  if (p === 0) return 'border-l-2 border-l-red-400 bg-red-50/30 dark:bg-red-950/10'
  if (p === 1) return 'border-l-2 border-l-yellow-400 bg-yellow-50/20 dark:bg-yellow-950/10'
  return 'border-l-2 border-l-transparent'
}

function WebsiteRow({ site }: { site: MonitoredWebsite }) {
  return (
    <Link href={`/monitoring/${site.id}`} className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0 group ${rowAccent(site)}`}>
      {/* Status dot */}
      <StatusDot status={site.status} />

      {/* Name & URL */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">{site.name}</span>
          {site.last_http_status && site.last_http_status >= 400 && (
            <span className="text-xs bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded font-mono">
              {site.last_http_status}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400 truncate">{site.url}</span>
      </div>

      {/* Status badge */}
      <StatusBadge status={site.status} />

      {/* Uptime */}
      <div className="hidden md:flex flex-col items-end w-16">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{fmtUptime(site.uptime_7d)}</span>
        <span className="text-[10px] text-slate-400">7d uptime</span>
      </div>

      {/* Response */}
      <div className="hidden lg:flex flex-col items-end w-16">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{fmtMs(site.avg_load_time_ms)}</span>
        <span className="text-[10px] text-slate-400">avg resp</span>
      </div>

      {/* SSL */}
      <div className="hidden xl:flex flex-col items-end w-20">
        <DaysChip days={site.ssl_days_left} label="SSL" type="ssl" />
        <DaysChip days={site.domain_days_left} label="Domain" type="domain" />
      </div>

      {/* Last check */}
      <div className="hidden sm:block text-[10px] text-slate-400 w-24 text-right">
        {site.last_check_at
          ? new Date(site.last_check_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'Not yet'}
      </div>

      {/* Chevron */}
      <span className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors">›</span>
    </Link>
  )
}

function sortSites(list: MonitoredWebsite[]): MonitoredWebsite[] {
  return [...list].sort((a, b) => sitePriority(a) - sitePriority(b))
}

export function WebsiteList({ initial }: { initial: MonitoredWebsite[] }) {
  const [sites, setSites] = useState(() => sortSites(initial))
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/monitoring/websites')
      if (res.ok) {
        setSites(sortSites(await res.json()))
        setLastRefresh(new Date())
      }
    } finally {
      setRefreshing(false)
    }
  }, [])

  // Auto-refresh every 60s
  useEffect(() => {
    const id = setInterval(refresh, 60000)
    return () => clearInterval(id)
  }, [refresh])

  const upCount    = sites.filter(s => s.status === 'up').length
  const downCount  = sites.filter(s => s.status === 'down').length
  const checkCount = sites.filter(s => s.status === 'checking').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Website Monitoring</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {sites.length} site{sites.length !== 1 ? 's' : ''} ·{' '}
            <span className="text-green-600 dark:text-green-400">{upCount} up</span>
            {downCount > 0 && <span className="text-red-600 dark:text-red-400"> · {downCount} down</span>}
            {checkCount > 0 && <span className="text-yellow-600 dark:text-yellow-400"> · {checkCount} checking</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <CsvImportDialog />
          <AddWebsiteDialog />
        </div>
      </div>

      {/* Stats row */}
      {sites.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Globe,         label: 'Total Sites',    value: sites.length,                                       color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-950/40' },
            { icon: TrendingUp,    label: 'Avg Uptime 7d',  value: `${(sites.reduce((a, s) => a + (s.uptime_7d ?? 0), 0) / Math.max(sites.length, 1)).toFixed(1)}%`, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/40' },
            { icon: Clock,         label: 'Avg Response',   value: fmtMs(Math.round(sites.reduce((a, s) => a + (s.avg_load_time_ms ?? 0), 0) / Math.max(sites.filter(s => s.avg_load_time_ms).length, 1))), color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800' },
            { icon: AlertTriangle, label: 'Issues',         value: sites.filter(s => sitePriority(s) < 2).length, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950/40' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className={`rounded-xl p-4 ${bg}`}>
              <Icon className={`w-4 h-4 ${color} mb-2`} />
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {sites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mb-4">
              <Shield className="w-7 h-7 text-blue-500" />
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">No websites yet</h3>
            <p className="text-sm text-slate-500 mb-5">Add your first website to start monitoring uptime, SSL, domain, and more.</p>
            <AddWebsiteDialog />
          </div>
        ) : (
          <>
            {/* Header row */}
            <div className="flex items-center gap-4 px-5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              <span className="w-2.5" />
              <span className="flex-1">Website</span>
              <span className="w-20">Status</span>
              <span className="hidden md:block w-16 text-right">Uptime</span>
              <span className="hidden lg:block w-16 text-right">Resp.</span>
              <span className="hidden xl:block w-20 text-right">Expiry</span>
              <span className="hidden sm:block w-24 text-right">Last check</span>
              <span className="w-3" />
            </div>
            {sites.map(site => <WebsiteRow key={site.id} site={site} />)}
          </>
        )}
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        Auto-refreshes every 60s · Last: {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Checks run every 30 minutes
      </p>
    </div>
  )
}
