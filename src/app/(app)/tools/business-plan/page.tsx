'use client'

import { useState, useEffect, useRef } from 'react'
import type { ExecutionPlan, PlanMilestone } from '@/types/business-plan'

const PRIORITY_COLOR: Record<string, string> = {
  high:   'bg-red-500/20 text-red-300 border-red-500/30',
  medium: 'bg-slate-600/20 text-slate-400 border-slate-500/30',
  low:    'bg-slate-700/50 text-slate-400 border-slate-600/30',
}
const QUARTER_ACCENT = [
  'border-blue-500/40 bg-slate-950/10',
  'border-blue-500/40 bg-blue-950/10',
  'border-blue-500/40 bg-slate-950/10',
  'border-slate-500/40 bg-slate-950/10',
]
const QUARTER_LABEL = ['text-blue-400','text-blue-400','text-blue-400','text-slate-500']

function buildPdfHtml(plan: ExecutionPlan): string {
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const priorityBg: Record<string, string> = { high: '#fef2f2', medium: '#fffbeb', low: '#f8fafc' }
  const priorityColor: Record<string, string> = { high: '#dc2626', medium: '#475569', low: '#64748b' }

  const milestonesHtml = (ms: PlanMilestone[]) => ms.map(m => `
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:12px;background:${priorityBg[m.priority]}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:11px;font-weight:600;color:${priorityColor[m.priority]};text-transform:uppercase">${m.priority}</span>
        <span style="font-weight:600;font-size:14px;color:#1e293b">${m.title}</span>
        <span style="margin-left:auto;font-size:11px;color:#64748b">${m.due}</span>
      </div>
      <p style="font-size:12px;color:#64748b;margin:0 0 8px">${m.description}</p>
      <ul style="margin:0;padding-left:16px;">
        ${m.steps.map(s => `<li style="font-size:12px;color:#334155;margin-bottom:4px">${s}</li>`).join('')}
      </ul>
    </div>`).join('')

  const quartersHtml = plan.quarters.map((q, i) => {
    const colors = ['#2563eb','#2563eb','#1d4ed8','#475569']
    return `
    <div style="margin-bottom:40px;page-break-inside:avoid;">
      <div style="border-left:4px solid ${colors[i]};padding-left:16px;margin-bottom:16px;">
        <h2 style="margin:0;font-size:20px;color:${colors[i]}">${q.label} — ${q.months}</h2>
        <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#1e293b">${q.theme}</p>
      </div>
      <div style="margin-bottom:12px;">
        <p style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;margin-bottom:6px">Objectives</p>
        <ul style="margin:0;padding-left:16px;">${q.objectives.map(o => `<li style="font-size:13px;color:#334155;margin-bottom:3px">${o}</li>`).join('')}</ul>
      </div>
      <p style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;margin-bottom:8px">Milestones</p>
      ${milestonesHtml(q.milestones)}
    </div>`
  }).join('')

  return `<!DOCTYPE html><html><head><title>Execution Plan — ${plan.product}</title>
<style>body{font-family:-apple-system,Arial,sans-serif;max-width:860px;margin:40px auto;color:#1e293b;line-height:1.6;}@media print{body{margin:20px;}}</style>
</head><body>
<div style="border-bottom:3px solid #2563eb;padding-bottom:16px;margin-bottom:24px;">
  <h1 style="margin:0;font-size:28px;color:#0f172a">${plan.product}</h1>
  <p style="margin:4px 0 0;font-size:13px;color:#64748b">Execution Roadmap · Generated ${date}</p>
</div>
<div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:32px;">
  <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase">Annual Goal</p>
  <p style="margin:0;font-size:16px;font-weight:600;color:#1e293b">${plan.annual_goal}</p>
</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:40px;">
  ${plan.key_metrics.map(m => `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px;">
      <p style="margin:0 0 4px;font-size:11px;color:#94a3b8">${m.label}</p>
      <p style="margin:0 0 2px;font-size:18px;font-weight:700;color:#2563eb">${m.target}</p>
      <p style="margin:0;font-size:11px;color:#94a3b8">Now: ${m.current}</p>
    </div>`).join('')}
</div>
${quartersHtml}
</body></html>`
}

interface SavedPlan { product: string; plan_json: ExecutionPlan; steps_done: Record<string, boolean> }

export default function BusinessPlanPage() {
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([])
  const [activeProduct, setActiveProduct] = useState<string | null>(null)
  const [plan, setPlan] = useState<ExecutionPlan | null>(null)
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({})
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newProduct, setNewProduct] = useState('')
  const [showAddInput, setShowAddInput] = useState(false)
  const [exportHtml, setExportHtml] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Load all saved plans from Supabase on mount
  useEffect(() => {
    fetch('/api/tools/business-plan/plans')
      .then(r => r.json())
      .then(data => {
        const plans: SavedPlan[] = data.plans ?? []
        setSavedPlans(plans)
        if (plans.length > 0) {
          const first = plans[0]
          setActiveProduct(first.product === 'Overall Business' ? null : first.product)
          setPlan(first.plan_json)
          setCheckedSteps(first.steps_done ?? {})
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Switch plan when active product changes
  function selectProduct(product: string | null) {
    setActiveProduct(product)
    const key = product ?? 'Overall Business'
    const saved = savedPlans.find(p => p.product === key)
    if (saved) {
      setPlan(saved.plan_json)
      setCheckedSteps(saved.steps_done ?? {})
    } else {
      setPlan(null)
      setCheckedSteps({})
    }
  }

  const products = savedPlans.map(p => p.product).filter(p => p !== 'Overall Business')

  function addProduct() {
    const name = newProduct.trim()
    if (!name || products.includes(name)) return
    setNewProduct('')
    setShowAddInput(false)
    setActiveProduct(name)
    setPlan(null)
    setCheckedSteps({})
  }

  async function removeProduct(name: string) {
    setSavedPlans(prev => prev.filter(p => p.product !== name))
    if (activeProduct === name) selectProduct(null)
    // DB row will be removed on regenerate; no explicit delete API needed
  }

  async function generate() {
    setGenerating(true)
    setPlan(null)
    try {
      const res = await fetch('/api/tools/business-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: activeProduct ?? '' }),
      })
      const data = await res.json()
      if (data.plan) {
        const planData: ExecutionPlan = data.plan
        setPlan(planData)
        setCheckedSteps({})
        // Save to Supabase
        await fetch('/api/tools/business-plan/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product: activeProduct ?? '', plan_json: planData }),
        })
        // Update local state
        const productKey = activeProduct ?? 'Overall Business'
        setSavedPlans(prev => {
          const existing = prev.findIndex(p => p.product === productKey)
          const entry: SavedPlan = { product: productKey, plan_json: planData, steps_done: {} }
          if (existing >= 0) { const next = [...prev]; next[existing] = entry; return next }
          return [...prev, entry]
        })
      }
    } finally {
      setGenerating(false)
    }
  }

  async function toggleStep(id: string) {
    const next = { ...checkedSteps, [id]: !checkedSteps[id] }
    setCheckedSteps(next)
    const productKey = activeProduct ?? 'Overall Business'
    setSavedPlans(prev => prev.map(p => p.product === productKey ? { ...p, steps_done: next } : p))
    // Persist to Supabase (fire-and-forget)
    fetch('/api/tools/business-plan/plans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: activeProduct ?? '', steps_done: next }),
    }).catch(() => {})
  }

  const productLabel = activeProduct ?? 'Overall Business'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-violet-400 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">Execution Roadmap</h1>
            <p className="text-slate-400 text-sm mt-0.5">Quarterly plan with milestones and steps — synced across all your devices</p>
          </div>
          {plan && (
            <button
              onClick={() => setExportHtml(buildPdfHtml(plan))}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors flex-shrink-0"
            >
              📄 Export PDF
            </button>
          )}
        </div>

        {/* Product Switcher */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button
            onClick={() => selectProduct(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeProduct === null ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            Overall Business
          </button>
          {products.map(p => (
            <div key={p} className="relative group">
              <button
                onClick={() => selectProduct(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors pr-7 ${
                  activeProduct === p ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
              >
                {p}
              </button>
              <button
                onClick={() => removeProduct(p)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
              >
                ✕
              </button>
            </div>
          ))}
          {showAddInput ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={newProduct}
                onChange={e => setNewProduct(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addProduct(); if (e.key === 'Escape') setShowAddInput(false) }}
                placeholder="Product name…"
                className="bg-slate-800 border border-blue-500/50 rounded-lg px-3 py-1.5 text-white text-sm placeholder-slate-600 focus:outline-none w-40"
              />
              <button onClick={addProduct} className="text-blue-400 hover:text-blue-300 text-sm px-2 py-1.5">Add</button>
              <button onClick={() => setShowAddInput(false)} className="text-slate-600 hover:text-slate-400 text-sm px-1">✕</button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddInput(true)}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-slate-300 border border-dashed border-slate-700 hover:border-slate-500 transition-colors"
            >
              + Add Product
            </button>
          )}
        </div>

        {/* Plan or Empty State */}
        {!plan ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
            <div className="text-5xl mb-4">🗺️</div>
            <h2 className="text-white font-semibold text-lg mb-2">
              {generating ? 'Building your roadmap…' : `Generate plan for "${productLabel}"`}
            </h2>
            <p className="text-slate-500 text-sm mb-6">
              AI will build a 4-quarter execution plan using your business data, goals, pipeline, and competitors.
            </p>
            <button
              onClick={generate}
              disabled={generating}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium px-8 py-3 rounded-xl transition-colors flex items-center gap-2 mx-auto"
            >
              {generating
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Building roadmap…</>
                : '✨ Generate Execution Plan'}
            </button>
          </div>
        ) : (
          <div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
              <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Annual Goal</p>
                  <p className="text-white font-semibold">{plan.annual_goal}</p>
                </div>
                <button
                  onClick={generate}
                  disabled={generating}
                  className="text-xs text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                >
                  {generating ? 'Regenerating…' : '↺ Regenerate'}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {plan.key_metrics.map((m, i) => (
                  <div key={i} className="bg-slate-800/60 rounded-xl p-3">
                    <p className="text-slate-500 text-xs mb-1">{m.label}</p>
                    <p className="text-blue-400 font-bold text-base">{m.target}</p>
                    <p className="text-slate-600 text-xs mt-0.5">Now: {m.current}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {plan.quarters.map((q, qi) => (
                <div key={qi} className={`border rounded-2xl p-5 ${QUARTER_ACCENT[qi]}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-lg font-bold ${QUARTER_LABEL[qi]}`}>{q.label}</span>
                    <span className="text-slate-500 text-xs">{q.months}</span>
                  </div>
                  <p className="text-white font-semibold text-sm mb-3">{q.theme}</p>
                  <div className="mb-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Objectives</p>
                    <ul className="space-y-1">
                      {q.objectives.map((obj, i) => (
                        <li key={i} className="text-xs text-slate-300 flex gap-2 items-start">
                          <span className={`w-1 h-1 rounded-full mt-1.5 flex-shrink-0 ${QUARTER_LABEL[qi].replace('text-', 'bg-')}`} />
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-3">
                    {q.milestones.map((m, mi) => {
                      const completedSteps = m.steps.filter((_, si) => checkedSteps[`${qi}-${mi}-${si}`]).length
                      return (
                        <div key={mi} className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
                          <div className="flex items-start gap-2 mb-2">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${PRIORITY_COLOR[m.priority]} flex-shrink-0 mt-0.5`}>
                              {m.priority}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-slate-200 text-xs font-semibold leading-snug">{m.title}</p>
                              <p className="text-slate-500 text-xs mt-0.5">{m.description}</p>
                            </div>
                            <span className="text-slate-600 text-[10px] flex-shrink-0">{m.due}</span>
                          </div>
                          {m.steps.length > 0 && (
                            <div className="mb-2.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-slate-600 text-[10px]">{completedSteps}/{m.steps.length} steps</span>
                                <span className="text-slate-600 text-[10px]">{Math.round((completedSteps / m.steps.length) * 100)}%</span>
                              </div>
                              <div className="h-1 bg-slate-700 rounded-full">
                                <div className="h-1 bg-blue-500 rounded-full transition-all" style={{ width: `${(completedSteps / m.steps.length) * 100}%` }} />
                              </div>
                            </div>
                          )}
                          <ul className="space-y-1.5">
                            {m.steps.map((step, si) => {
                              const id = `${qi}-${mi}-${si}`
                              const done = checkedSteps[id]
                              return (
                                <li key={si} onClick={() => toggleStep(id)} className="flex items-start gap-2 cursor-pointer group">
                                  <span className={`mt-0.5 w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center transition-colors ${done ? 'bg-blue-600 border-blue-600' : 'border-slate-600 group-hover:border-slate-400'}`}>
                                    {done && <span className="text-white text-[8px]">✓</span>}
                                  </span>
                                  <span className={`text-xs leading-relaxed transition-colors ${done ? 'text-slate-600 line-through' : 'text-slate-300 group-hover:text-slate-200'}`}>
                                    {step}
                                  </span>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {exportHtml && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800 flex-shrink-0">
            <span className="text-white font-medium text-sm">Execution Roadmap — Print / Save PDF</span>
            <div className="flex gap-2">
              <button onClick={() => iframeRef.current?.contentWindow?.print()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">
                🖨️ Print / Save PDF
              </button>
              <button onClick={() => setExportHtml(null)} className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 text-sm px-4 py-1.5 rounded-lg transition-colors">
                ✕ Close
              </button>
            </div>
          </div>
          <iframe ref={iframeRef} srcDoc={exportHtml} className="flex-1 w-full border-0 bg-white" />
        </div>
      )}
    </>
  )
}
