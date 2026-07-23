'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bell, Check, CheckCheck, RefreshCw, AlertTriangle, Zap, TrendingUp, Bot } from 'lucide-react'

interface Notification {
  id: string
  title: string
  body: string | null
  type: string
  priority: string
  read: boolean
  created_at: string
}

const TYPE_META: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  opportunity: { icon: '💡', label: 'Opportunity', color: 'text-blue-400', bg: 'bg-blue-600/10' },
  warning:     { icon: '⚠️', label: 'Warning',     color: 'text-slate-500',   bg: 'bg-slate-600/10'  },
  urgent:      { icon: '❗', label: 'Urgent',      color: 'text-red-400',     bg: 'bg-red-500/10'    },
  alert:       { icon: '🔴', label: 'Alert',       color: 'text-red-400',     bg: 'bg-red-500/10'    },
  action:      { icon: '⚡', label: 'Action',      color: 'text-blue-400',  bg: 'bg-blue-500/10' },
  insight:     { icon: '📊', label: 'Insight',     color: 'text-blue-400',    bg: 'bg-blue-500/10'   },
  info:        { icon: '📌', label: 'Info',        color: 'text-slate-400',   bg: 'bg-slate-800'     },
  done:        { icon: '✅', label: 'Done',        color: 'text-blue-400', bg: 'bg-blue-600/10'},
}

const PRIORITY_BADGE: Record<string, string> = {
  high:   'text-red-400   bg-red-950/40   border-red-800/30',
  medium: 'text-slate-500 bg-slate-950/40 border-slate-700/30',
  low:    'text-slate-400 bg-slate-800    border-slate-700',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  const today = new Date(); today.setHours(0,0,0,0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d >= today) return 'Today'
  if (d >= yesterday) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [dismissingAll, setDismissingAll] = useState(false)

  function load() {
    setLoading(true)
    fetch('/api/notifications')
      .then(r => r.json())
      .then(d => {
        setNotifications(d.notifications ?? [])
        setUnread(d.unread ?? 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function markRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnread(u => Math.max(0, u - 1))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  async function markAllRead() {
    setDismissingAll(true)
    await fetch('/api/notifications', { method: 'DELETE' })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnread(0)
    setDismissingAll(false)
  }

  const visible = filter === 'unread' ? notifications.filter(n => !n.read) : notifications
  const highCount = notifications.filter(n => n.priority === 'high' && !n.read).length

  // Group by day
  const groups: { label: string; items: Notification[] }[] = []
  for (const n of visible) {
    const label = fmtDate(n.created_at)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(n)
    else groups.push({ label, items: [n] })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Bell className="w-5 h-5 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            {unread > 0 && (
              <span className="text-xs text-white bg-blue-600 px-2 py-0.5 rounded-full font-semibold">{unread}</span>
            )}
          </div>
          <p className="text-slate-400 text-sm">Agent signals and alerts from your AI</p>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              onClick={markAllRead}
              disabled={dismissingAll}
              className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
          <button onClick={load} disabled={loading} className="p-2 text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-lg disabled:opacity-50 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && notifications.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total',         value: notifications.length,                   color: 'text-white',       bg: 'bg-slate-900' },
            { label: 'Unread',        value: unread,                                 color: 'text-blue-400',  bg: 'bg-blue-500/10' },
            { label: 'High Priority', value: highCount,                              color: highCount > 0 ? 'text-red-400' : 'text-slate-500', bg: highCount > 0 ? 'bg-red-500/10' : 'bg-slate-900' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border border-slate-800 rounded-xl p-4 text-center`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-slate-500 text-xs mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {(['all', 'unread'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-sm px-4 py-2 rounded-lg capitalize font-medium transition-colors ${
              filter === f ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {f === 'unread' ? `Unread${unread > 0 ? ` (${unread})` : ''}` : 'All'}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center h-40 text-slate-600">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          Loading…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="space-y-6">
          {groups.map(group => (
            <div key={group.label}>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">{group.label}</p>
              <div className="space-y-2">
                {group.items.map(n => {
                  const meta = TYPE_META[n.type] ?? { icon: '📌', label: n.type, color: 'text-slate-400', bg: 'bg-slate-800' }
                  return (
                    <div
                      key={n.id}
                      className={`bg-slate-900 border rounded-2xl p-4 transition-all ${
                        n.read ? 'border-slate-800 opacity-60' : 'border-slate-700 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Unread dot */}
                        <div className="flex-shrink-0 mt-1.5">
                          {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                          {n.read  && <div className="w-2 h-2 rounded-full bg-transparent" />}
                        </div>

                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center flex-shrink-0 text-xl`}>
                          {meta.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <p className={`text-sm font-semibold leading-tight ${n.read ? 'text-slate-400' : 'text-white'}`}>
                              {n.title}
                            </p>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium capitalize ${PRIORITY_BADGE[n.priority] ?? PRIORITY_BADGE.low}`}>
                                {n.priority}
                              </span>
                              {!n.read && (
                                <button
                                  onClick={() => markRead(n.id)}
                                  className="w-6 h-6 rounded-full bg-slate-800 hover:bg-blue-600/20 border border-slate-700 hover:border-blue-500/50 flex items-center justify-center transition-colors group"
                                  title="Mark as read"
                                >
                                  <Check className="w-3 h-3 text-slate-500 group-hover:text-blue-400" />
                                </button>
                              )}
                            </div>
                          </div>

                          {n.body && (
                            <p className="text-slate-400 text-sm mt-1 leading-relaxed">{n.body}</p>
                          )}

                          <div className="flex items-center gap-2 mt-2">
                            <span className={`text-xs font-medium capitalize ${meta.color}`}>{meta.label}</span>
                            <span className="text-slate-700 text-xs">·</span>
                            <span className="text-slate-500 text-xs">{timeAgo(n.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <p className="text-slate-600 text-xs text-center pt-2">
            {visible.length} notification{visible.length !== 1 ? 's' : ''} ·{' '}
            <Link href="/dashboard" className="text-blue-500 hover:text-blue-400 transition-colors">
              Open Agent Inbox
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}

function EmptyState({ filter }: { filter: 'all' | 'unread' }) {
  const COMING = [
    { icon: <Zap className="w-4 h-4 text-blue-400" />,      title: 'AI Signals',         desc: 'Business insights and opportunities detected by your AI agent' },
    { icon: <AlertTriangle className="w-4 h-4 text-slate-500" />, title: 'Priority Alerts', desc: 'Urgent issues like review drops, lead churn, or campaign failures' },
    { icon: <TrendingUp className="w-4 h-4 text-blue-400" />, title: 'Growth Insights',  desc: 'Lead score changes, content performance spikes, proposal views' },
    { icon: <Bot className="w-4 h-4 text-blue-400" />,          title: 'Agent Actions',     desc: 'What your AI completed — posts drafted, audits run, briefs generated' },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
          <Bell className="w-6 h-6 text-blue-400" />
        </div>
        <h3 className="text-white font-semibold text-base mb-1">
          {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
        </h3>
        <p className="text-slate-400 text-sm max-w-xs">
          {filter === 'unread'
            ? 'You have no unread notifications. Your AI agent will alert you when something needs attention.'
            : 'Your AI agent will send notifications here as it monitors your business and detects signals.'}
        </p>
        <Link
          href="/dashboard"
          className="mt-4 text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium"
        >
          → Go to Agent Inbox
        </Link>
      </div>

      {filter === 'all' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <p className="text-white font-semibold text-sm">What you&apos;ll see here</p>
            <p className="text-slate-500 text-xs mt-0.5">Notifications are generated automatically by your AI agent</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {COMING.map((item, i) => (
              <div
                key={item.title}
                className={`flex items-start gap-3.5 p-5 ${i % 2 === 0 ? 'sm:border-r border-slate-800' : ''} ${i < 2 ? 'border-b border-slate-800' : ''}`}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm text-white font-medium">{item.title}</p>
                  <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
