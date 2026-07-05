'use client'

import { useState, useTransition, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  AlertCircle, AlertTriangle, Lightbulb, CheckCircle2, BarChart2,
  X, ChevronRight, RefreshCw, Play, CheckSquare, Square,
  Zap, Clock, Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { AgentSignal, SignalActionType } from '@/types'

// ── helpers ────────────────────────────────────────────────────────────────

function resolveActionUrl(type: SignalActionType, data?: Record<string, unknown>): string | null {
  switch (type) {
    case 'approve_post':   return '/content'
    case 'respond_review': return '/reviews'
    case 'view_lead':      return data?.lead_id ? `/leads/${data.lead_id}` : '/leads'
    case 'view_report':    return '/audit'
    case 'open_chat':      return '/chat'
    case 'open_url':       return typeof data?.url === 'string' ? data.url : null
    default:               return null
  }
}

const EXECUTABLE: SignalActionType[] = ['approve_post', 'respond_review', 'view_lead']
function isExecutable(type: SignalActionType) { return EXECUTABLE.includes(type) }

function execLabel(type: SignalActionType): string {
  switch (type) {
    case 'approve_post':   return 'Publish Post'
    case 'respond_review': return 'Publish Response'
    case 'view_lead':      return 'Send Follow-up'
    default:               return 'Execute'
  }
}

const SIGNAL_CONFIG = {
  urgent:      { icon: AlertCircle,   color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',        badge: 'bg-red-500/20 text-red-400',        label: 'Urgent' },
  warning:     { icon: AlertTriangle, color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',    badge: 'bg-amber-500/20 text-amber-400',    label: 'Warning' },
  opportunity: { icon: Lightbulb,     color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',      badge: 'bg-blue-500/20 text-blue-400',      label: 'Opportunity' },
  done:        { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20',badge: 'bg-emerald-500/20 text-emerald-400', label: 'Done' },
  insight:     { icon: BarChart2,     color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20',  badge: 'bg-violet-500/20 text-violet-400',  label: 'Insight' },
}

// ── chain helpers ─────────────────────────────────────────────────────────

function isOrchestrationSignal(signal: AgentSignal): boolean {
  return signal.action_data_json?.chain_source === 'orchestration'
}

function getChainId(signal: AgentSignal): string | null {
  return (signal.action_data_json?.chain_id as string | undefined) ?? null
}

function getChainLength(signal: AgentSignal): number {
  return (signal.action_data_json?.chain_length as number | undefined) ?? 0
}

/** Groups signals into chains (orchestration) + singles, preserving time order. */
function groupSignals(signals: AgentSignal[]): Array<AgentSignal | AgentSignal[]> {
  const groups: Array<AgentSignal | AgentSignal[]> = []
  const seen = new Set<string>()
  const chainMap = new Map<string, AgentSignal[]>()

  for (const s of signals) {
    const chainId = getChainId(s)
    if (chainId && isOrchestrationSignal(s)) {
      if (!chainMap.has(chainId)) {
        chainMap.set(chainId, [])
        groups.push(chainMap.get(chainId)!)
      }
      chainMap.get(chainId)!.push(s)
      seen.add(s.id)
    }
  }
  for (const s of signals) {
    if (!seen.has(s.id)) groups.push(s)
  }
  return groups
}

// ── confidence score breakdown tooltip ─────────────────────────────────────
// How confidence is derived per action type (shown in tooltip)
const CONFIDENCE_MODEL: Record<string, { factors: string[]; note: string }> = {
  respond_review: {
    factors: ['Tone match vs brand voice (40)', 'Response length ≈ review length (20)', 'Sentiment alignment (20)', 'No blocked words (20)'],
    note: 'Max 100. Score calibrated against historical accuracy.',
  },
  approve_post: {
    factors: ['Topic relevance to your industry (40)', 'Brand voice match (30)', 'Estimated engagement (30)'],
    note: 'Max 100. Engagement estimate from similar posts in your niche.',
  },
  view_lead: {
    factors: ['Lead score / 100 (40)', 'Days since last contact (30)', 'Message personalization quality (30)'],
    note: 'Max 100. Lead score from CRM is the primary driver.',
  },
}

// ── types ──────────────────────────────────────────────────────────────────

interface ExecutedSignal extends AgentSignal {
  executed_at?: string
}

interface PendingDismiss {
  ids: string[]
  signals: AgentSignal[]
}

interface AgentInboxProps {
  signals: AgentSignal[]
  businessId?: string
}

type TabId = 'queue' | 'executed' | 'signals'

// ── ChainGroup ─────────────────────────────────────────────────────────────
// Renders signals from one orchestration rule as a collapsible chain card.

interface ChainGroupProps {
  signals:        AgentSignal[]
  chainId:        string
  chainLength:    number
  selected:       Set<string>
  executing:      Set<string>
  onToggleSelect: (id: string) => void
  onExecute:      (signal: AgentSignal) => void
  onDismiss:      (id: string) => void
  onNavigate:     (url: string) => void
}

function ChainGroup({
  signals, chainId, chainLength, selected, executing,
  onToggleSelect, onExecute, onDismiss, onNavigate,
}: ChainGroupProps) {
  const [expanded, setExpanded] = useState(true)
  const firstSig  = signals[0]
  const urgentAny = signals.some(s => s.type === 'urgent')
  const allSel    = signals.every(s => selected.has(s.id))

  return (
    <div className="border-l-2 border-violet-500/60 bg-violet-500/5">
      {/* Chain header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-violet-500/5 transition-colors text-left"
      >
        <Zap className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-violet-300 flex-1">
          ⚡ Chain — {chainLength} related action{chainLength !== 1 ? 's' : ''} from 1 trigger
        </span>
        <span className={cn(
          'text-[9px] font-bold px-1.5 py-0.5 rounded-full border',
          urgentAny
            ? 'text-red-400 bg-red-950/40 border-red-800/50'
            : 'text-violet-400 bg-violet-950/40 border-violet-800/50'
        )}>
          {urgentAny ? 'Urgent' : 'Cross-module'}
        </span>
        <span className="text-slate-600 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="divide-y divide-slate-800/40">
          {signals.map((signal, idx) => {
            const cfg  = SIGNAL_CONFIG[signal.type] ?? SIGNAL_CONFIG.insight
            const Icon = cfg.icon
            const sel  = selected.has(signal.id)
            const exec = executing.has(signal.id)
            const isExec = isExecutable(signal.action_type)

            return (
              <div
                key={signal.id}
                className={cn(
                  'px-5 py-3.5 transition-colors',
                  sel ? 'bg-blue-500/5' : 'hover:bg-slate-800/20',
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Step number */}
                  <span className="w-5 h-5 rounded-full bg-violet-900/60 border border-violet-700/50 flex items-center justify-center text-[9px] font-bold text-violet-300 flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <button onClick={() => onToggleSelect(signal.id)} className="flex-shrink-0 mt-0.5 text-slate-600 hover:text-blue-400 transition-colors">
                    {sel ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                  </button>
                  <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', cfg.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', cfg.badge)}>{cfg.label}</span>
                    </div>
                    <p className="text-sm font-medium text-white mb-0.5">{signal.title}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{signal.body}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {isExec && (
                        <Button size="sm" disabled={exec} onClick={() => onExecute(signal)}
                          className="h-6 text-[11px] bg-violet-600 hover:bg-violet-500 text-white border-0 gap-1">
                          {exec
                            ? <><span className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin" />Executing…</>
                            : <><Play className="w-2.5 h-2.5" />{execLabel(signal.action_type)}</>
                          }
                        </Button>
                      )}
                      {signal.action_label && signal.action_type !== 'none' && (() => {
                        const url = resolveActionUrl(signal.action_type, signal.action_data_json as Record<string, unknown> | undefined)
                        if (!url) return null
                        return (
                          <Button size="sm" onClick={() => url.startsWith('http') ? window.open(url, '_blank') : onNavigate(url)}
                            className="h-6 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
                            {signal.action_label} <ChevronRight className="w-2.5 h-2.5 ml-1" />
                          </Button>
                        )
                      })()}
                    </div>
                  </div>
                  <button onClick={() => onDismiss(signal.id)} className="text-slate-600 hover:text-slate-400 flex-shrink-0 p-0.5 hover:bg-slate-700 rounded transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── UndoToast ─────────────────────────────────────────────────────────────

function UndoToast({
  count,
  onUndo,
  onExpire,
}: {
  count: number
  onUndo: () => void
  onExpire: () => void
}) {
  const [secs, setSecs] = useState(5)

  useEffect(() => {
    const interval = setInterval(() => {
      setSecs(s => {
        if (s <= 1) { clearInterval(interval); onExpire(); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [onExpire])

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-slate-800 border border-slate-700 shadow-2xl px-4 py-3 rounded-xl min-w-[280px]">
      <p className="text-sm text-slate-300 flex-1">
        Dismissed {count} signal{count !== 1 ? 's' : ''}
      </p>
      <button
        onClick={onUndo}
        className="text-blue-400 hover:text-blue-300 text-sm font-semibold transition-colors"
      >
        Undo
      </button>
      <span className="text-slate-600 text-xs w-4 text-center">{secs}</span>
      {/* Countdown bar */}
      <span
        className="absolute bottom-0 left-0 h-0.5 bg-blue-500 rounded-full transition-all duration-1000"
        style={{ width: `${(secs / 5) * 100}%` }}
      />
    </div>
  )
}

// ── ConfidenceBadge with tooltip ───────────────────────────────────────────

function ConfidenceBadge({ score, actionType }: { score?: number; actionType: SignalActionType }) {
  const [open, setOpen] = useState(false)
  if (!score) return null
  const model = CONFIDENCE_MODEL[actionType]
  const color = score >= 85 ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50'
              : score >= 70 ? 'text-amber-400 bg-amber-950/40 border-amber-800/50'
                            : 'text-red-400 bg-red-950/40 border-red-800/50'
  return (
    <span className="relative inline-flex items-center gap-1">
      <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full border', color)}>
        {score}% confidence
      </span>
      {model && (
        <button
          onClick={() => setOpen(v => !v)}
          className="text-slate-600 hover:text-slate-400 transition-colors"
        >
          <Info className="w-2.5 h-2.5" />
        </button>
      )}
      {open && model && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-slate-800 border border-slate-700 rounded-xl p-3 shadow-2xl z-50 text-left">
          <p className="text-slate-300 text-[10px] font-semibold mb-2 uppercase tracking-wide">Score breakdown</p>
          <ul className="space-y-1 mb-2">
            {model.factors.map(f => (
              <li key={f} className="text-slate-400 text-[11px] flex items-start gap-1.5">
                <span className="text-violet-400 mt-0.5">•</span> {f}
              </li>
            ))}
          </ul>
          <p className="text-slate-600 text-[10px]">{model.note}</p>
        </div>
      )}
    </span>
  )
}

// ── component ─────────────────────────────────────────────────────────────

export function AgentInbox({ signals: initialSignals, businessId }: AgentInboxProps) {
  const router = useRouter()
  const [signals, setSignals] = useState(initialSignals)
  const [executedSignals, setExecutedSignals] = useState<ExecutedSignal[]>([])
  const [tab, setTab] = useState<TabId>('queue')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [executing, setExecuting] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [pendingDismiss, setPendingDismiss] = useState<PendingDismiss | null>(null)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [, startTransition] = useTransition()

  const queueSignals = signals.filter(s => isExecutable(s.action_type))
  const infoSignals  = signals.filter(s => !isExecutable(s.action_type))
  const urgentCount  = signals.filter(s => s.type === 'urgent').length

  const generateSignals = useCallback(async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/agent/signals/generate', { method: 'POST' })
      const data = await res.json() as { ok?: boolean; inserted?: number; skipped?: boolean }
      if (data.ok && !data.skipped && (data.inserted ?? 0) > 0) router.refresh()
    } finally {
      setGenerating(false)
    }
  }, [router])

  useEffect(() => {
    if (initialSignals.length === 0 && businessId) generateSignals()
  }, [])

  // Real-time subscription
  useEffect(() => {
    if (!businessId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`signals:${businessId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'agent_signals',
        filter: `business_id=eq.${businessId}`,
      }, payload => {
        const s = payload.new as AgentSignal
        if (!s.dismissed) setSignals(prev => [s, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [businessId])

  function dismissSignal(id: string) {
    setSignals(prev => prev.filter(s => s.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    startTransition(async () => {
      await fetch(`/api/agent/signals/${id}/dismiss`, { method: 'POST' })
    })
  }

  async function executeSignal(signal: AgentSignal) {
    setExecuting(prev => new Set([...prev, signal.id]))
    try {
      await fetch('/api/agent/actions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal_id: signal.id, action_type: signal.action_type, action_data: signal.action_data_json }),
      })
      const done: ExecutedSignal = { ...signal, executed_at: new Date().toISOString() }
      setSignals(prev => prev.filter(s => s.id !== signal.id))
      setExecutedSignals(prev => [done, ...prev])
    } finally {
      setExecuting(prev => { const n = new Set(prev); n.delete(signal.id); return n })
    }
  }

  async function bulkExecute() {
    const ids = [...selected]
    if (ids.length === 0) return
    setBulkLoading(true)
    const targets = signals.filter(s => ids.includes(s.id))
    try {
      await fetch('/api/agent/actions/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal_ids: ids, action: 'execute' }),
      })
      const done: ExecutedSignal[] = targets.map(s => ({ ...s, executed_at: new Date().toISOString() }))
      setSignals(prev => prev.filter(s => !ids.includes(s.id)))
      setExecutedSignals(prev => [...done, ...prev])
      setSelected(new Set())
    } finally {
      setBulkLoading(false)
    }
  }

  // ── bulk dismiss with undo toast ──────────────────────────────────────
  function bulkDismiss() {
    const ids = [...selected]
    if (ids.length === 0) return
    const targets = signals.filter(s => ids.includes(s.id))

    // Optimistically remove from UI immediately
    setSignals(prev => prev.filter(s => !ids.includes(s.id)))
    setSelected(new Set())

    // Cancel any previous pending dismiss
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    setPendingDismiss({ ids, signals: targets })
  }

  function undoDismiss() {
    if (!pendingDismiss) return
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    // Restore signals to the top of the list
    setSignals(prev => [...pendingDismiss.signals, ...prev])
    setPendingDismiss(null)
  }

  async function commitDismiss() {
    if (!pendingDismiss) return
    const { ids } = pendingDismiss
    setPendingDismiss(null)
    await fetch('/api/agent/actions/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal_ids: ids, action: 'dismiss' }),
    })
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  function toggleSelectAll() {
    const eligible = (tab === 'queue' ? queueSignals : infoSignals).map(s => s.id)
    if (eligible.every(id => selected.has(id))) {
      setSelected(prev => { const n = new Set(prev); eligible.forEach(id => n.delete(id)); return n })
    } else {
      setSelected(prev => new Set([...prev, ...eligible]))
    }
  }

  const currentList  = tab === 'queue' ? queueSignals : tab === 'signals' ? infoSignals : executedSignals
  const eligibleIds  = (tab === 'queue' ? queueSignals : infoSignals).map(s => s.id)
  const allSelected  = eligibleIds.length > 0 && eligibleIds.every(id => selected.has(id))

  return (
    <>
      <div className="bg-slate-900 rounded-xl border border-slate-800">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-semibold text-sm">Agent Inbox</h2>
            {urgentCount > 0 && (
              <Badge className="bg-red-500/20 text-red-400 border-0 text-xs">{urgentCount} urgent</Badge>
            )}
            {queueSignals.length > 0 && (
              <Badge className="bg-violet-500/20 text-violet-400 border-0 text-xs">
                {queueSignals.length} action{queueSignals.length !== 1 ? 's' : ''} pending
              </Badge>
            )}
          </div>
          <button
            onClick={generateSignals}
            disabled={generating}
            className="text-slate-600 hover:text-blue-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', generating && 'animate-spin')} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-slate-800 bg-slate-900/50">
          {([
            { id: 'queue' as TabId,    label: 'Action Queue',  count: queueSignals.length },
            { id: 'executed' as TabId, label: 'Auto-Executed', count: executedSignals.length },
            { id: 'signals' as TabId,  label: 'Signals',       count: infoSignals.length },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSelected(new Set()) }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                tab === t.id ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn(
                  'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold',
                  tab === t.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
          {tab !== 'executed' && eligibleIds.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-blue-400" /> : <Square className="w-3.5 h-3.5" />}
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>

        {/* Signal list */}
        <div className="divide-y divide-slate-800/50">
          {generating && currentList.length === 0 ? (
            <EmptyGenerating />
          ) : tab === 'executed' && executedSignals.length === 0 ? (
            <EmptyExecuted />
          ) : currentList.length === 0 ? (
            <EmptyClear onRefresh={generateSignals} generating={generating} />
          ) : (
            groupSignals(currentList).map((item, idx) => {
              // ── orchestration chain group ─────────────────────────────
              if (Array.isArray(item)) {
                const chainSignals = item
                const firstSignal  = chainSignals[0]
                const chainId      = getChainId(firstSignal) ?? ''
                const chainLength  = getChainLength(firstSignal) || chainSignals.length
                return (
                  <ChainGroup
                    key={`chain-${chainId}-${idx}`}
                    signals={chainSignals}
                    chainId={chainId}
                    chainLength={chainLength}
                    selected={selected}
                    executing={executing}
                    onToggleSelect={toggleSelect}
                    onExecute={executeSignal}
                    onDismiss={dismissSignal}
                    onNavigate={router.push}
                  />
                )
              }

              // ── regular signal ─────────────────────────────────────────
              const signal = item
              const cfg = SIGNAL_CONFIG[signal.type] ?? SIGNAL_CONFIG.insight
              const Icon = cfg.icon
              const sel = selected.has(signal.id)
              const exec = executing.has(signal.id)
              const confidence = signal.action_data_json?.confidence as number | undefined
              const isExec = isExecutable(signal.action_type)
              const isAutoExec = tab === 'executed'

              return (
                <div
                  key={signal.id}
                  className={cn(
                    'px-5 py-4 border-l-2 transition-colors',
                    cfg.bg,
                    sel ? 'bg-blue-500/5 border-l-blue-500' : 'hover:bg-slate-800/30',
                  )}
                >
                  <div className="flex items-start gap-3">
                    {!isAutoExec && (
                      <button onClick={() => toggleSelect(signal.id)} className="flex-shrink-0 mt-0.5 text-slate-600 hover:text-blue-400 transition-colors">
                        {sel ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                      </button>
                    )}
                    {isAutoExec && <Zap className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />}
                    <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', cfg.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cfg.badge)}>{cfg.label}</span>
                        {isExec && !isAutoExec && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400">
                            Needs approval
                          </span>
                        )}
                        {isAutoExec && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5" /> Auto-executed
                          </span>
                        )}
                        <ConfidenceBadge score={confidence} actionType={signal.action_type} />
                        <span className="text-xs text-slate-500">
                          {isAutoExec
                            ? formatRelativeTime((signal as ExecutedSignal).executed_at ?? signal.created_at)
                            : formatRelativeTime(signal.created_at)}
                        </span>
                      </div>

                      <p className="text-sm font-medium text-white mb-0.5">{signal.title}</p>
                      <p className="text-sm text-slate-400 leading-relaxed">{signal.body}</p>

                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {isExec && !isAutoExec && (
                          <Button
                            size="sm"
                            disabled={exec}
                            onClick={() => executeSignal(signal)}
                            className="h-7 text-xs bg-violet-600 hover:bg-violet-500 text-white border-0 gap-1"
                          >
                            {exec
                              ? <><span className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin" />Executing…</>
                              : <><Play className="w-2.5 h-2.5" />{execLabel(signal.action_type)}</>
                            }
                          </Button>
                        )}
                        {signal.action_label && signal.action_type !== 'none' && (() => {
                          const url = resolveActionUrl(signal.action_type, signal.action_data_json as Record<string, unknown> | undefined)
                          if (!url) return null
                          const isExternal = url.startsWith('http')
                          return isExternal ? (
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" className="h-7 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
                                View <ChevronRight className="w-3 h-3 ml-1" />
                              </Button>
                            </a>
                          ) : (
                            <Button size="sm" onClick={() => router.push(url)}
                              className="h-7 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
                              View <ChevronRight className="w-3 h-3 ml-1" />
                            </Button>
                          )
                        })()}
                        {isAutoExec && (
                          <span className="text-xs text-slate-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Undo available for 24h
                          </span>
                        )}
                      </div>
                    </div>
                    {!isAutoExec && (
                      <button
                        onClick={() => dismissSignal(signal.id)}
                        className="text-slate-600 hover:text-slate-400 flex-shrink-0 p-0.5 hover:bg-slate-700 rounded transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="sticky bottom-0 flex items-center justify-between gap-3 px-5 py-3 bg-slate-800 border-t border-slate-700 rounded-b-xl">
            <span className="text-slate-300 text-sm font-medium">
              {selected.size} action{selected.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={bulkLoading}
                onClick={bulkDismiss}
                className="h-8 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600"
              >
                <X className="w-3 h-3 mr-1" /> Dismiss all
              </Button>
              {tab === 'queue' && (
                <Button
                  size="sm"
                  disabled={bulkLoading}
                  onClick={bulkExecute}
                  className="h-8 text-xs bg-violet-600 hover:bg-violet-500 text-white border-0 gap-1"
                >
                  {bulkLoading
                    ? <><span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />Executing…</>
                    : <><Play className="w-3 h-3" />Approve all ({selected.size})</>
                  }
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Undo toast — outside the card so it floats */}
      {pendingDismiss && (
        <UndoToast
          count={pendingDismiss.ids.length}
          onUndo={undoDismiss}
          onExpire={commitDismiss}
        />
      )}
    </>
  )
}

// ── empty states ───────────────────────────────────────────────────────────

function EmptyGenerating() {
  return (
    <div className="px-5 py-10 text-center space-y-3">
      <div className="w-6 h-6 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin mx-auto" />
      <p className="text-slate-400 text-sm font-medium">AI is analyzing your business…</p>
      <p className="text-slate-600 text-xs">Scanning leads, reviews, audit scores, and more</p>
    </div>
  )
}

function EmptyExecuted() {
  return (
    <div className="px-5 py-12 text-center">
      <Zap className="w-8 h-8 text-slate-700 mx-auto mb-3" />
      <p className="text-slate-300 font-medium">No auto-executions yet</p>
      <p className="text-slate-500 text-sm mt-1">
        Enable auto-execute in{' '}
        <a href="/settings/agent" className="text-violet-400 hover:underline">Agent Settings</a>.
      </p>
    </div>
  )
}

function EmptyClear({ onRefresh, generating }: { onRefresh: () => void; generating: boolean }) {
  return (
    <div className="px-5 py-12 text-center">
      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
      <p className="text-slate-300 font-medium">All clear</p>
      <p className="text-slate-500 text-sm mt-1">Your agent is monitoring everything.</p>
      <button
        onClick={onRefresh}
        disabled={generating}
        className="mt-4 text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
      >
        {generating ? 'Analyzing…' : '↻ Re-analyze now'}
      </button>
    </div>
  )
}
