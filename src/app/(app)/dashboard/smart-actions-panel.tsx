'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ActionItem {
  id: string
  title: string
  description: string
  why: string
  benefit: string
  status: 'connected' | 'partial' | 'missing'
  priority: 'critical' | 'high' | 'medium' | 'low'
  link: string
  icon: string
  category: string
  data_unlocked: string[]
}

interface ContextDB {
  website_metrics: Record<string, unknown> | null
  crm: string[] | null
  social: string[] | null
  goals: number
  trends_cached: boolean
  goals_cached: boolean
}

const PRIORITY_META = {
  critical: { label: 'Critical',  cls: 'text-red-400 bg-red-950/40 border-red-800/50' },
  high:     { label: 'High',      cls: 'text-amber-400 bg-amber-950/40 border-amber-800/50' },
  medium:   { label: 'Medium',    cls: 'text-blue-400 bg-blue-950/40 border-blue-800/50' },
  low:      { label: 'Connected', cls: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50' },
}

function ConnectedDot({ connected }: { connected: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-emerald-400' : 'bg-slate-700'}`} />
  )
}

export function SmartActionsPanel() {
  const [actions, setActions]       = useState<ActionItem[]>([])
  const [contextDB, setContextDB]   = useState<ContextDB | null>(null)
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [showAll, setShowAll]       = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetch('/api/agent/smart-actions')
      .then(r => r.json())
      .then((d: { actions?: ActionItem[]; context_db?: ContextDB }) => {
        setActions(d.actions ?? [])
        setContextDB(d.context_db ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function refresh() {
    setRefreshing(true)
    await fetch('/api/agent/smart-actions', { method: 'POST' })
    const r = await fetch('/api/agent/smart-actions')
    const d = await r.json() as { actions?: ActionItem[]; context_db?: ContextDB }
    setActions(d.actions ?? [])
    setContextDB(d.context_db ?? null)
    setRefreshing(false)
  }

  const pending   = actions.filter(a => a.status !== 'connected')
  const connected = actions.filter(a => a.status === 'connected')
  const shown     = showAll ? pending : pending.slice(0, 3)

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 animate-pulse">
        <div className="h-4 bg-slate-800 rounded w-48 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Action Cards */}
      {pending.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div>
              <h2 className="text-white font-semibold text-sm flex items-center gap-2">
                ⚡ Setup Actions
                <span className="text-xs font-normal px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 rounded-full">
                  {pending.length} pending
                </span>
              </h2>
              <p className="text-slate-500 text-xs mt-0.5">Connect these to unlock accurate AI insights</p>
            </div>
            <button onClick={refresh} disabled={refreshing}
              className="text-slate-600 hover:text-slate-400 text-xs transition-colors disabled:opacity-50">
              {refreshing ? '↻ Refreshing…' : '↻ Refresh'}
            </button>
          </div>

          <div className="divide-y divide-slate-800/50">
            {shown.map(action => {
              const pm = PRIORITY_META[action.priority]
              const isOpen = expanded === action.id
              return (
                <div key={action.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl shrink-0 mt-0.5">{action.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-white text-sm font-medium">{action.title}</p>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${pm.cls}`}>
                          {pm.label}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs leading-relaxed">{action.why}</p>

                      {/* Expandable details */}
                      {isOpen && (
                        <div className="mt-3 space-y-3">
                          <div className="bg-slate-800/50 rounded-lg p-3">
                            <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold mb-1.5">What AI can do once connected</p>
                            <div className="grid grid-cols-2 gap-1">
                              {action.data_unlocked.map((item, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                                  <span className="text-violet-400">✓</span> {item}
                                </div>
                              ))}
                            </div>
                          </div>
                          <p className="text-emerald-400 text-xs">{action.benefit}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-3 mt-2">
                        <button onClick={() => setExpanded(isOpen ? null : action.id)}
                          className="text-slate-600 hover:text-slate-400 text-[11px] transition-colors">
                          {isOpen ? '↑ Less' : '↓ Why this matters'}
                        </button>
                        <Link href={action.link}
                          className="text-[11px] font-medium text-violet-400 hover:text-violet-300 transition-colors">
                          Connect →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {pending.length > 3 && (
            <div className="px-5 py-3 border-t border-slate-800">
              <button onClick={() => setShowAll(v => !v)}
                className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
                {showAll ? '↑ Show less' : `↓ Show ${pending.length - 3} more actions`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* AI Context Database */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold text-sm flex items-center gap-2">
              🧠 AI Knowledge Base
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">What your AI agent knows about your business</p>
          </div>
          {connected.length > 0 && (
            <span className="text-emerald-400 text-xs">{connected.length} connected</span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            {
              label: 'Paying Customers',
              value: contextDB?.website_metrics?.paying_customers?.toLocaleString() ?? null,
              icon: '👥',
              connected: !!(contextDB?.website_metrics?.paying_customers),
              link: '/settings/integrations#ai-context',
            },
            {
              label: 'MRR',
              value: contextDB?.website_metrics?.mrr ? `$${Number(contextDB.website_metrics.mrr).toLocaleString()}` : null,
              icon: '💰',
              connected: !!(contextDB?.website_metrics?.mrr),
              link: '/settings/integrations#ai-context',
            },
            {
              label: 'CRM Connected',
              value: contextDB?.crm ? contextDB.crm.join(', ') : null,
              icon: '🗂️',
              connected: !!(contextDB?.crm),
              link: '/settings/integrations',
            },
            {
              label: 'Social Media',
              value: contextDB?.social ? contextDB.social.join(', ') : null,
              icon: '📱',
              connected: !!(contextDB?.social),
              link: '/settings/integrations',
            },
            {
              label: 'Goals Set',
              value: contextDB?.goals ? `${contextDB.goals} active` : null,
              icon: '🎯',
              connected: !!(contextDB?.goals),
              link: '/goals',
            },
            {
              label: 'Industry Trends',
              value: contextDB?.trends_cached ? 'Cached' : null,
              icon: '📡',
              connected: !!(contextDB?.trends_cached),
              link: '/trends',
            },
          ].map(item => (
            <Link key={item.label} href={item.link}
              className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all ${
                item.connected
                  ? 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                  : 'bg-slate-800/20 border-slate-800 hover:border-slate-700 opacity-60'
              }`}>
              <span className="text-base shrink-0">{item.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <ConnectedDot connected={item.connected} />
                  <p className="text-slate-400 text-[10px] font-medium truncate">{item.label}</p>
                </div>
                <p className={`text-xs font-semibold truncate ${item.connected ? 'text-white' : 'text-slate-600'}`}>
                  {item.value ?? 'Not connected'}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {!contextDB?.website_metrics && !contextDB?.crm && (
          <div className="mt-3 p-3 bg-amber-950/20 border border-amber-800/30 rounded-lg">
            <p className="text-amber-400 text-xs font-medium mb-0.5">⚠️ AI is working with limited data</p>
            <p className="text-slate-500 text-xs">
              Connect your website backend or CRM so AI uses your real numbers — not estimates.
              <Link href="/settings/integrations" className="text-violet-400 hover:underline ml-1">Set up now →</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
