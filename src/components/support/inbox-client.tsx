'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MessageSquare, Mail, Globe, Search, RefreshCw, Plus, Circle, CheckCircle, Clock, AlertOctagon, ChevronRight, Building2, ExternalLink } from 'lucide-react'
import type { SupportConversation } from '@/lib/support/types'
import { createClient } from '@/lib/supabase/client'

interface Property { id: string; name: string; domain: string | null; widget_color: string }

const STATUS_CONFIG = {
  open:    { label: 'Open',    icon: Circle,       color: 'text-blue-500' },
  pending: { label: 'Pending', icon: Clock,         color: 'text-yellow-500' },
  closed:  { label: 'Closed',  icon: CheckCircle,  color: 'text-green-500' },
  spam:    { label: 'Spam',    icon: AlertOctagon, color: 'text-slate-400' },
}

const SOURCE_CONFIG = {
  widget: { label: 'Widget', icon: MessageSquare, color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  email:  { label: 'Email',  icon: Mail,           color: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
  api:    { label: 'API',    icon: Globe,          color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// Sort: unread first, then open/pending before closed/spam, then by last_message_at
function sortConversations(convs: SupportConversation[]) {
  return [...convs].sort((a, b) => {
    // Unread first
    if (!a.is_read && b.is_read) return -1
    if (a.is_read && !b.is_read) return 1
    // Open/pending before closed/spam
    const priority = (s: string) => (s === 'open' ? 0 : s === 'pending' ? 1 : 2)
    const pa = priority(a.status), pb = priority(b.status)
    if (pa !== pb) return pa - pb
    // Most recent last message first
    return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  })
}

export function SupportInbox({ properties }: { properties: Property[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [conversations, setConversations] = useState<SupportConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filterProperty, setFilterProperty] = useState(searchParams.get('property') ?? '')
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') ?? '')
  const [filterSource, setFilterSource] = useState(searchParams.get('source') ?? '')
  const [propCounts, setPropCounts] = useState<Record<string, number>>({})

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const params = new URLSearchParams()
      if (filterProperty) params.set('property_id', filterProperty)
      if (filterStatus)   params.set('status', filterStatus)
      if (filterSource)   params.set('source', filterSource)
      if (search)         params.set('search', search)
      params.set('limit', '200')
      const res = await fetch(`/api/support/conversations?${params}`)
      if (res.ok) {
        const data: SupportConversation[] = await res.json()
        setConversations(data)
        // Count conversations per property
        const counts: Record<string, number> = {}
        data.forEach(c => {
          const pid = (c as any).property_id
          if (pid) counts[pid] = (counts[pid] || 0) + 1
        })
        setPropCounts(counts)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filterProperty, filterStatus, filterSource, search])

  useEffect(() => { load() }, [load])

  // Realtime — refresh on any conversation/message change
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('inbox-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, () => load(true))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, () => load(true))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const sorted = sortConversations(conversations)
  const unreadCount = conversations.filter(c => !c.is_read).length

  return (
    <div className="flex gap-0 h-full">
      {/* ── Left: Conversation list ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Support Inbox
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
              {unreadCount > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">{unreadCount} new</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => load(true)} disabled={refreshing}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, subject…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg focus:outline-none">
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="closed">Closed</option>
              <option value="spam">Spam</option>
            </select>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg focus:outline-none">
              <option value="">All Sources</option>
              <option value="widget">Widget</option>
              <option value="email">Email</option>
              <option value="api">API</option>
            </select>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-400">Loading…</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-16 text-center px-4">
              <MessageSquare className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">No conversations</p>
              <p className="text-xs text-slate-400 mt-1">Install the widget to start receiving messages</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {sorted.map(conv => {
                const statusCfg = STATUS_CONFIG[conv.status]
                const sourceCfg = SOURCE_CONFIG[conv.source as keyof typeof SOURCE_CONFIG] || SOURCE_CONFIG.widget
                const SourceIcon = sourceCfg.icon
                const propName = (conv as any).support_properties?.name || ''
                const propColor = (conv as any).support_properties?.widget_color || '#2563eb'

                return (
                  <button key={conv.id} onClick={() => router.push(`/support/${conv.id}`)}
                    className={`w-full flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group ${!conv.is_read ? 'bg-blue-50/40 dark:bg-blue-950/10' : ''}`}>
                    <div className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: propColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${sourceCfg.color}`}>
                          <SourceIcon className="w-2.5 h-2.5" />{sourceCfg.label}
                        </span>
                        {!conv.is_read && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />}
                      </div>
                      <p className={`text-sm font-semibold truncate ${!conv.is_read ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
                        {conv.customer_name || conv.customer_email || 'Anonymous'}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{conv.subject || 'No subject'}</p>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                      <span className="text-[10px] text-slate-400">{timeAgo(conv.last_message_at)}</span>
                      <div className={`flex items-center gap-0.5 text-[10px] ${statusCfg.color}`}>
                        <statusCfg.icon className="w-2.5 h-2.5" />
                        <span>{statusCfg.label}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Properties sidebar ── */}
      <aside className="w-56 flex-shrink-0 border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Building2 className="w-3.5 h-3.5" />
            Properties
          </div>
          <button onClick={() => router.push('/support/properties/new')}
            title="Add property"
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* "All" option */}
          <button onClick={() => setFilterProperty('')}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-xs transition-colors ${!filterProperty ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800/60'}`}>
            <span>All conversations</span>
            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full font-medium">
              {conversations.length}
            </span>
          </button>

          {properties.length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-400">No properties yet</p>
          ) : (
            properties.map(p => (
              <button key={p.id} onClick={() => setFilterProperty(p.id === filterProperty ? '' : p.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors text-left ${filterProperty === p.id ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800/60'}`}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.widget_color }} />
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                  {propCounts[p.id] || 0}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Manage link */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
          <button onClick={() => router.push('/support/properties')}
            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-blue-600 transition-colors w-full">
            <ExternalLink className="w-3 h-3" />
            Manage properties & SMTP
          </button>
        </div>
      </aside>
    </div>
  )
}
