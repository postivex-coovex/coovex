'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Check, Target, Zap, Sparkles } from 'lucide-react'
import { DataGateModal } from '@/components/data-gate/DataGateModal'
import { useDataGate, DATA_FIELDS } from '@/hooks/useDataGate'

type GoalCategory = 'leads' | 'revenue' | 'reviews' | 'content' | 'health' | 'custom'
type GoalPeriod = 'monthly' | 'quarterly' | 'yearly'

interface Goal {
  id: string
  title: string
  category: GoalCategory
  period: GoalPeriod
  target: number
  unit: string
  due?: string
  current: number
  auto_tracked: boolean
  custom_current?: number
}

interface Suggestion {
  title: string
  category: GoalCategory
  period: GoalPeriod
  target: number
  unit: string
  reasoning: string
  difficulty: 'easy' | 'realistic' | 'stretch'
}

interface GoalPlan {
  overview: string
  bottleneck: string
  phases: { label: string; focus: string; actions: string[] }[]
  quick_wins: { action: string; impact: string }[]
  kpi: string
}

const CAT: Record<GoalCategory, { label: string; icon: string; hint: string; defaultUnit: string }> = {
  leads:   { label: 'Leads',        icon: '👥', hint: 'Auto-tracked from your Leads table',          defaultUnit: 'leads' },
  revenue: { label: 'Revenue',      icon: '💰', hint: 'Auto-tracked from won deals this period',      defaultUnit: '$' },
  reviews: { label: 'Reviews',      icon: '⭐', hint: 'Auto-tracked from Reviews collected',          defaultUnit: 'reviews' },
  content: { label: 'Content',      icon: '📝', hint: 'Auto-tracked from Posts created',              defaultUnit: 'posts' },
  health:  { label: 'Health Score', icon: '💚', hint: 'Auto-tracked from your current Health Score',  defaultUnit: 'pts' },
  custom:  { label: 'Custom',       icon: '🎯', hint: 'Set and update progress manually',             defaultUnit: '' },
}
const COLORS: Record<GoalCategory, string> = {
  leads: '#3b82f6', revenue: '#2563eb', reviews: '#64748b',
  content: '#3b82f6', health: '#60a5fa', custom: '#94a3b8',
}
const BAR_COLORS: Record<GoalCategory, string> = {
  leads: 'bg-blue-500', revenue: 'bg-blue-600', reviews: 'bg-slate-600',
  content: 'bg-blue-500', health: 'bg-blue-500', custom: 'bg-blue-500',
}

function ProgressRing({ pct, color }: { pct: number; color: string }) {
  const r = 22, circ = 2 * Math.PI * r
  const dash = Math.min(pct / 100, 1) * circ
  return (
    <svg width="56" height="56" className="rotate-[-90deg] shrink-0">
      <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  )
}

function fmtVal(cat: GoalCategory, v: number) {
  if (cat === 'revenue') {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`
    return `$${v}`
  }
  return String(v)
}

const BLANK_DRAFT = { title: '', category: 'leads' as GoalCategory, period: 'monthly' as GoalPeriod, target: 50, unit: '', due: '', custom_current: 0 }

export default function GoalsPage() {
  const [goals, setGoals]         = useState<Goal[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [adding, setAdding]       = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft]         = useState({ ...BLANK_DRAFT })
  const [suggestions, setSuggestions]         = useState<Suggestion[]>([])
  const [suggesting, setSuggesting]           = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [addedIds, setAddedIds]               = useState<Set<number>>(new Set())
  const [suggestError, setSuggestError]       = useState<string | null>(null)
  const [plans, setPlans]                     = useState<Record<string, GoalPlan>>({})
  const [planLoading, setPlanLoading]         = useState<string | null>(null)
  const [openPlanId, setOpenPlanId]           = useState<string | null>(null)
  const [firstLoadDone, setFirstLoadDone]     = useState(false)

  const { requireData, gateConfig, metricsLoaded } = useDataGate()

  const runSuggestions = useCallback(async () => {
    setSuggesting(true)
    setShowSuggestions(true)
    setSuggestions([])
    setSuggestError(null)
    setAddedIds(new Set())
    try {
      const r = await fetch('/api/goals/suggest', { method: 'POST' })
      const d = await r.json() as { suggestions?: Suggestion[]; error?: string; raw?: string }
      if (d.error) { setSuggestError(d.error + (d.raw ? ` · ${d.raw}` : '')); setSuggesting(false); return }
      setSuggestions(d.suggestions ?? [])
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : 'Network error')
    }
    setSuggesting(false)
  }, [])

  // Gate wrapper — checks for real data before calling AI
  const getSuggestions = useCallback(() => {
    requireData(
      DATA_FIELDS.business_metrics,
      'AI Goal Suggestions',
      'AI cannot suggest accurate goals without your real business data.',
      runSuggestions,
    )
  }, [requireData, runSuggestions])

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/goals')
    const d = await r.json() as { goals?: Goal[] }
    const fetched = d.goals ?? []
    setGoals(fetched)
    setLoading(false)
    setFirstLoadDone(true)
  }, [])

  // Auto-suggest on first visit — runs after BOTH goals loaded AND metrics checked
  useEffect(() => {
    if (firstLoadDone && metricsLoaded && goals.length === 0) {
      getSuggestions()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstLoadDone, metricsLoaded])

  useEffect(() => { load() }, [load])

  async function persist(updated: Goal[]) {
    setSaving(true)
    await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goals: updated }),
    }).catch(() => {})
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function addGoal() {
    if (!draft.title || !draft.target) return
    const unit = draft.unit || CAT[draft.category].defaultUnit
    const newGoal: Goal = {
      id: Date.now().toString(),
      title: draft.title,
      category: draft.category,
      period: draft.period,
      target: Number(draft.target),
      unit,
      due: draft.due,
      current: draft.category === 'custom' ? Number(draft.custom_current) : 0,
      auto_tracked: draft.category !== 'custom',
      custom_current: draft.category === 'custom' ? Number(draft.custom_current) : undefined,
    }
    const updated = [...goals, newGoal]
    setGoals(updated)
    persist(updated)
    setAdding(false)
    setDraft({ ...BLANK_DRAFT })
  }

  function deleteGoal(id: string) {
    const updated = goals.filter(g => g.id !== id)
    setGoals(updated)
    persist(updated)
  }

  function updateCustomCurrent(id: string, value: number) {
    const updated = goals.map(g => g.id === id ? { ...g, current: value, custom_current: value } : g)
    setGoals(updated)
    persist(updated)
    setEditingId(null)
  }

  async function getPlan(goal: Goal) {
    if (plans[goal.id]) { setOpenPlanId(id => id === goal.id ? null : goal.id); return }
    setPlanLoading(goal.id)
    setOpenPlanId(goal.id)
    try {
      const r = await fetch('/api/goals/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal }),
      })
      const d = await r.json() as { plan?: GoalPlan; error?: string }
      if (d.plan) setPlans(prev => ({ ...prev, [goal.id]: d.plan! }))
    } catch { /* ignore */ }
    setPlanLoading(null)
  }

  function addSuggestion(s: Suggestion, idx: number) {
    const newGoal: Goal = {
      id: Date.now().toString(),
      title: s.title,
      category: s.category,
      period: s.period,
      target: s.target,
      unit: s.unit,
      current: 0,
      auto_tracked: s.category !== 'custom',
    }
    const updated = [...goals, newGoal]
    setGoals(updated)
    persist(updated)
    setAddedIds(prev => new Set([...prev, idx]))
  }

  function updateTarget(id: string, value: number) {
    const updated = goals.map(g => g.id === id ? { ...g, target: value } : g)
    setGoals(updated)
    persist(updated)
    setEditingId(null)
  }

  const totalGoals = goals.length
  const onTrack    = goals.filter(g => g.current / g.target >= 0.5).length
  const achieved   = goals.filter(g => g.current >= g.target).length

  const grouped = (Object.keys(CAT) as GoalCategory[]).map(cat => ({
    cat,
    goals: goals.filter(g => g.category === cat),
  })).filter(g => g.goals.length > 0)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {gateConfig && <DataGateModal config={gateConfig} />}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Goals & OKRs</h1>
          <p className="text-slate-400 text-sm mt-0.5">Track progress toward your monthly and quarterly targets</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-blue-400 text-sm">✓ Saved</span>}
          <button onClick={() => persist(goals)} disabled={saving}
            className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-sm rounded-lg transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save All'}
          </button>
          <button onClick={getSuggestions} disabled={suggesting}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 border border-slate-700/50 text-blue-300 hover:text-blue-200 hover:border-blue-600 text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            {suggesting
              ? <><span className="w-3.5 h-3.5 border-2 border-blue-400/30 border-t-violet-400 rounded-full animate-spin" /> Thinking…</>
              : <><Sparkles className="w-4 h-4" /> AI Suggestions</>}
          </button>
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Add Goal
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Goals',    value: totalGoals, color: 'text-white' },
          { label: 'On Track (≥50%)', value: onTrack,   color: 'text-blue-400' },
          { label: 'Achieved',        value: achieved,   color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Auto-track notice */}
      <div className="flex items-start gap-3 bg-slate-950/20 border border-slate-700/30 rounded-xl p-4 mb-6">
        <Zap className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-slate-400 text-sm">
          Goals with <span className="text-blue-300 font-medium">Auto</span> badge track live from your real data (leads, deals, posts, reviews, health score).
          Set your target and we handle the progress tracking.
        </p>
      </div>

      {/* AI Suggestions panel */}
      {showSuggestions && (
        <div className="bg-slate-900 border border-slate-700/40 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <h2 className="text-white font-semibold text-sm">AI Goal Suggestions</h2>
              <span className="text-slate-600 text-xs">based on your real data</span>
            </div>
            <button onClick={() => setShowSuggestions(false)} className="text-slate-600 hover:text-slate-400 text-lg leading-none">×</button>
          </div>

          {suggesting ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-slate-800/50 rounded-xl p-4 animate-pulse space-y-2">
                  <div className="h-3 bg-slate-700 rounded w-3/4" />
                  <div className="h-2 bg-slate-700 rounded w-1/2" />
                  <div className="h-8 bg-slate-700/60 rounded-lg" />
                </div>
              ))}
            </div>
          ) : suggestError ? (
            <div className="text-center py-6">
              <p className="text-red-400 text-sm mb-1">❌ {suggestError}</p>
              <button onClick={getSuggestions} className="text-blue-400 text-xs hover:underline mt-2">Try again</button>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-slate-500 text-sm">No suggestions generated.</p>
              <button onClick={getSuggestions} className="text-blue-400 text-xs hover:underline mt-2">Try again</button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {suggestions.map((s, i) => {
                  const isAdded = addedIds.has(i)
                  const diff = s.difficulty
                  const diffCls = diff === 'easy'
                    ? 'text-blue-400 bg-slate-950/40 border-slate-700/40'
                    : diff === 'stretch'
                    ? 'text-slate-500 bg-slate-950/40 border-slate-700/40'
                    : 'text-blue-400 bg-blue-950/40 border-blue-800/40'
                  return (
                    <div key={i} className={`bg-slate-800/50 border rounded-xl p-4 flex flex-col gap-3 transition-all ${isAdded ? 'border-slate-700/40 opacity-60' : 'border-slate-700/50 hover:border-slate-600'}`}>
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-white text-sm font-medium leading-snug">{s.title}</p>
                          <span className={`shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full border capitalize whitespace-nowrap ${diffCls}`}>
                            {s.difficulty}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs">{CAT[s.category]?.icon}</span>
                          <span className="text-slate-500 text-[10px] capitalize">{CAT[s.category]?.label} · {s.period}</span>
                          <span className="text-slate-400 text-[10px] font-medium ml-auto">
                            Target: {s.category === 'revenue' ? `$${s.target.toLocaleString()}` : s.target} {s.unit}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[11px] leading-relaxed">{s.reasoning}</p>
                      </div>
                      <button
                        onClick={() => addSuggestion(s, i)}
                        disabled={isAdded}
                        className={`w-full text-xs font-medium py-2 rounded-lg transition-colors ${
                          isAdded
                            ? 'bg-slate-950/40 text-blue-500 border border-slate-700/40'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }`}
                      >
                        {isAdded ? '✓ Added' : '+ Add this goal'}
                      </button>
                    </div>
                  )
                })}
              </div>
              <p className="text-slate-700 text-xs text-center mt-4">
                Suggestions are based on your current leads, revenue, reviews, and content data.
              </p>
            </>
          )}
        </div>
      )}

      {/* Add goal form */}
      {adding && (
        <div className="bg-slate-900 border border-slate-700/40 rounded-2xl p-6 mb-6">
          <h2 className="text-white font-semibold mb-4">New Goal</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Goal Title *</label>
              <input type="text" value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                placeholder="e.g. Reach 50 new leads this month"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Category</label>
              <select value={draft.category}
                onChange={e => setDraft(d => ({ ...d, category: e.target.value as GoalCategory, unit: CAT[e.target.value as GoalCategory].defaultUnit }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none">
                {(Object.keys(CAT) as GoalCategory[]).map(k => (
                  <option key={k} value={k}>{CAT[k].icon} {CAT[k].label}</option>
                ))}
              </select>
              <p className="text-slate-600 text-[10px] mt-1">{CAT[draft.category].hint}</p>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Period</label>
              <select value={draft.period} onChange={e => setDraft(d => ({ ...d, period: e.target.value as GoalPeriod }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Target *</label>
              <input type="number" value={draft.target} onChange={e => setDraft(d => ({ ...d, target: Number(e.target.value) }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Unit label</label>
              <input type="text" value={draft.unit} onChange={e => setDraft(d => ({ ...d, unit: e.target.value }))}
                placeholder={CAT[draft.category].defaultUnit || 'units'}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500" />
            </div>
            {draft.category === 'custom' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Current Progress</label>
                <input type="number" value={draft.custom_current} onChange={e => setDraft(d => ({ ...d, custom_current: Number(e.target.value) }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Due Date (optional)</label>
              <input type="date" value={draft.due} onChange={e => setDraft(d => ({ ...d, due: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addGoal} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
              Add Goal
            </button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white text-sm rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-500 text-sm">Loading goals…</div>
      ) : goals.length === 0 && !adding ? (
        <div className="text-center py-16 text-slate-600">
          <Target className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-white text-sm mb-1">No goals yet</p>
          <p className="text-slate-500 text-xs">Click "Add Goal" to set your first target</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ cat, goals: catGoals }) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">{CAT[cat].icon}</span>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{CAT[cat].label}</h2>
              </div>
              <div className="space-y-3">
                {catGoals.map(goal => {
                  const pct        = Math.min((goal.current / goal.target) * 100, 100)
                  const isAchieved = goal.current >= goal.target
                  const isEditing  = editingId === goal.id
                  const remaining  = goal.target - goal.current
                  return (
                    <div key={goal.id} className={`bg-slate-900 border rounded-xl p-4 ${isAchieved ? 'border-slate-700/40' : 'border-slate-800'}`}>
                      <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                          <ProgressRing pct={pct} color={isAchieved ? '#2563eb' : COLORS[cat]} />
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white" style={{ transform: 'rotate(90deg)' }}>
                            {Math.round(pct)}%
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-white font-medium text-sm">{goal.title}</p>
                            {goal.auto_tracked && (
                              <span className="flex items-center gap-0.5 text-[9px] font-medium text-blue-400 bg-slate-950/50 border border-slate-700/40 px-1.5 py-0.5 rounded-full">
                                <Zap className="w-2.5 h-2.5" /> Auto
                              </span>
                            )}
                            {isAchieved && (
                              <span className="flex items-center gap-0.5 text-[9px] text-blue-400 bg-slate-900/30 border border-slate-700/40 px-1.5 py-0.5 rounded-full">
                                <Check className="w-2.5 h-2.5" /> Done
                              </span>
                            )}
                            <span className="text-[10px] text-slate-600 capitalize ml-auto">{goal.period}</span>
                          </div>

                          <div className="flex items-center gap-3 mb-2 text-sm">
                            <span className="text-slate-300 font-medium">
                              {fmtVal(cat, goal.current)} / {fmtVal(cat, goal.target)} {goal.unit}
                            </span>
                            {/* Editable target */}
                            {isEditing === false && (
                              <button onClick={() => setEditingId(goal.id)} className="text-slate-700 hover:text-slate-500 text-[10px] transition-colors">
                                edit target
                              </button>
                            )}
                            {goal.due && <span className="text-slate-600 text-xs">due {goal.due}</span>}
                          </div>

                          {/* Inline edit: target for auto-tracked, current for custom */}
                          {isEditing && (
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-slate-400 text-xs">{goal.auto_tracked ? 'New target:' : 'Update progress:'}</span>
                              <input type="number" autoFocus
                                defaultValue={goal.auto_tracked ? goal.target : goal.current}
                                onBlur={e => {
                                  const val = Number(e.target.value)
                                  if (goal.auto_tracked) updateTarget(goal.id, val)
                                  else updateCustomCurrent(goal.id, val)
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    const val = Number((e.target as HTMLInputElement).value)
                                    if (goal.auto_tracked) updateTarget(goal.id, val)
                                    else updateCustomCurrent(goal.id, val)
                                  }
                                  if (e.key === 'Escape') setEditingId(null)
                                }}
                                className="w-24 bg-slate-800 border border-blue-500 rounded px-2 py-1 text-white text-xs focus:outline-none" />
                              <button onClick={() => setEditingId(null)} className="text-slate-600 text-xs hover:text-slate-400">cancel</button>
                            </div>
                          )}

                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${isAchieved ? 'bg-blue-600' : BAR_COLORS[cat]}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-slate-600 text-[10px] mt-1.5">
                            {isAchieved ? '🎉 Goal achieved!' : remaining > 0 ? `${fmtVal(cat, remaining)} ${goal.unit} remaining` : ''}
                            {goal.auto_tracked && !isAchieved && (
                              <span className="ml-2 text-slate-700">· updated live</span>
                            )}
                          </p>
                        </div>
                        <button onClick={() => deleteGoal(goal.id)} className="text-slate-700 hover:text-red-400 transition-colors ml-2 shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* AI Plan button */}
                      <div className="mt-3 pt-3 border-t border-slate-800">
                        <button
                          onClick={() => getPlan(goal)}
                          disabled={planLoading === goal.id}
                          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                        >
                          {planLoading === goal.id ? (
                            <><span className="w-3 h-3 border border-blue-400/30 border-t-violet-400 rounded-full animate-spin" /> Building plan…</>
                          ) : openPlanId === goal.id && plans[goal.id] ? (
                            <><Sparkles className="w-3.5 h-3.5" /> Hide execution plan</>
                          ) : (
                            <><Sparkles className="w-3.5 h-3.5" /> Get AI execution plan</>
                          )}
                        </button>
                      </div>

                      {/* Plan panel */}
                      {openPlanId === goal.id && plans[goal.id] && (() => {
                        const plan = plans[goal.id]
                        return (
                          <div className="mt-3 bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 space-y-4">
                            {/* Overview */}
                            <p className="text-slate-300 text-sm leading-relaxed">{plan.overview}</p>

                            {/* Bottleneck */}
                            <div className="flex items-start gap-2 bg-slate-950/30 border border-slate-700/30 rounded-lg px-3 py-2">
                              <span className="text-slate-500 text-sm shrink-0">⚠️</span>
                              <div>
                                <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-0.5">Main Bottleneck</p>
                                <p className="text-slate-300/80 text-xs leading-relaxed">{plan.bottleneck}</p>
                              </div>
                            </div>

                            {/* Quick wins */}
                            <div>
                              <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-2">⚡ Quick Wins (this week)</p>
                              <div className="space-y-2">
                                {plan.quick_wins.map((qw, i) => (
                                  <div key={i} className="flex items-start gap-2">
                                    <span className="text-blue-400 text-xs shrink-0 mt-0.5">→</span>
                                    <div>
                                      <p className="text-slate-300 text-xs font-medium">{qw.action}</p>
                                      <p className="text-slate-600 text-[10px]">{qw.impact}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Phases */}
                            <div>
                              <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-2">📅 Execution Phases</p>
                              <div className="space-y-3">
                                {plan.phases.map((ph, i) => (
                                  <div key={i} className="border-l-2 border-slate-700/50 pl-3">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <span className="text-blue-400 text-[10px] font-bold">{ph.label}</span>
                                      <span className="text-slate-500 text-[10px]">· {ph.focus}</span>
                                    </div>
                                    <ul className="space-y-1">
                                      {ph.actions.map((a, j) => (
                                        <li key={j} className="text-slate-400 text-xs flex items-start gap-1.5">
                                          <span className="text-slate-700 shrink-0">•</span>{a}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* KPI */}
                            <div className="flex items-center gap-2 bg-slate-950/30 border border-slate-700/30 rounded-lg px-3 py-2">
                              <span className="text-blue-400 text-sm">📊</span>
                              <div>
                                <p className="text-blue-400 text-[10px] font-semibold uppercase tracking-wider">Daily KPI to watch</p>
                                <p className="text-blue-200/80 text-xs">{plan.kpi}</p>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
