'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MessageSquare, Mail, Globe, Search, Filter, RefreshCw, Plus, Circle, CheckCircle, Clock, AlertOctagon, ChevronRight } from 'lucide-react'
import type { SupportConversation } from '@/lib/support/types'

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

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const params = new URLSearchParams()
      if (filterProperty) params.set('property_id', filterProperty)
      if (filterStatus)   params.set('status', filterStatus)
      if (filterSource)   params.set('source', filterSource)
      if (search)         params.set('search', search)
      params.set('limit', '100')
      const res = await fetch(`/api/support/conversations?${params}`)
      if (res.ok) setConversations(await res.json())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filterProperty, filterStatus, filterSource, search])

  useEffect(() => { load() }, [load])

  const unreadCount = conversations.filter(c => !c.is_read).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-600" />
            Support Inbox
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
            {unreadCount > 0 && <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-bold">{unreadCount} new</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(true)} disabled={refreshing}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => router.push('/support/properties/new')}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            New Property
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, subject…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={filterProperty} onChange={e => setFilterProperty(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Properties</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="closed">Closed</option>
          <option value="spam">Spam</option>
        </select>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Sources</option>
          <option value="widget">Widget</option>
          <option value="email">Email</option>
          <option value="api">API</option>
        </select>
      </div>

      {/* Property quick-filter pills */}
      {properties.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterProperty('')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${!filterProperty ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'}`}>
            All
          </button>
          {properties.map(p => (
            <button key={p.id} onClick={() => setFilterProperty(p.id === filterProperty ? '' : p.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${filterProperty === p.id ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'}`}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Conversation list */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Loading conversations…</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="py-16 text-center">
            <MessageSquare className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">No conversations yet</p>
            <p className="text-xs text-slate-400 mt-1">Install the widget on your website to start receiving messages</p>
            <button onClick={() => router.push('/support/properties')}
              className="mt-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
              Manage properties →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {conversations.map(conv => {
              const statusCfg = STATUS_CONFIG[conv.status]
              const sourceCfg = SOURCE_CONFIG[conv.source as keyof typeof SOURCE_CONFIG] || SOURCE_CONFIG.widget
              const SourceIcon = sourceCfg.icon
              const propName = (conv as any).support_properties?.name || 'Unknown'
              const propColor = (conv as any).support_properties?.widget_color || '#2563eb'

              return (
                <button
                  key={conv.id}
                  onClick={() => router.push(`/support/${conv.id}`)}
                  className={`w-full flex items-start gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group ${!conv.is_read ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''}`}
                >
                  {/* Property color dot */}
                  <div className="flex-shrink-0 mt-1 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: propColor }} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {/* Source badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${sourceCfg.color}`}>
                        <SourceIcon className="w-2.5 h-2.5" />
                        {sourceCfg.label}
                      </span>
                      {/* Property name */}
                      <span className="text-[11px] text-slate-400 font-medium">{propName}</span>
                      {!conv.is_read && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />}
                    </div>
                    <p className={`text-sm font-semibold truncate ${!conv.is_read ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
                      {conv.customer_name || conv.customer_email || 'Anonymous'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{conv.subject || 'No subject'}</p>
                  </div>

                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <span className="text-xs text-slate-400">{timeAgo(conv.last_message_at)}</span>
                    <div className={`flex items-center gap-1 text-xs ${statusCfg.color}`}>
                      <statusCfg.icon className="w-3 h-3" />
                      <span>{statusCfg.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Properties sidebar link */}
      <div className="flex justify-end">
        <button onClick={() => router.push('/support/properties')}
          className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1 transition-colors">
          <Filter className="w-3 h-3" />
          Manage Properties & SMTP
        </button>
      </div>
    </div>
  )
}
