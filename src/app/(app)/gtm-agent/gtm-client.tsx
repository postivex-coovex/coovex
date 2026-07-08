'use client'

import { useState } from 'react'
import Link from 'next/link'

interface GtmAction { title: string; detail: string; priority: 'high' | 'medium'; link: string }

interface LastRun {
  ran_at: string
  audit_score: number | null
  audit_geo_score: number | null
  audit_age_days: number
  total_leads: number
  new_leads: number
  hot_leads: number
  discovered_leads: number
  draft_posts: number
  scheduled_posts: number
  competitors: number
  content_gaps: number
  high_impact_gaps: number
  ai_visibility_rate: number | null
  actions: GtmAction[]
  summary: string
}

interface StepState {
  status: 'idle' | 'running' | 'done'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
}

const STEPS = [
  { id: 'audit',  label: 'Website Audit',              icon: '🔍', defaultLabel: 'Reading website audit results' },
  { id: 'icp',    label: 'Lead Pipeline & ICP',        icon: '👥', defaultLabel: 'Analyzing leads & building ICP' },
  { id: 'leads',  label: 'AI Lead Finder',              icon: '🎯', defaultLabel: 'ICP → company search → email enrichment' },
  { id: 'geo',    label: 'GEO & Gemini Visibility',    icon: '🧠', defaultLabel: 'Checking AI search visibility with Gemini' },
  { id: 'ai',     label: 'AI Action Plan',             icon: '⚡', defaultLabel: 'Generating GTM action plan' },
  { id: 'inbox',  label: 'Agent Inbox',                icon: '📥', defaultLabel: 'Saving results to Agent Inbox' },
]

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function StepResult({ id, data }: { id: string; data?: Record<string, unknown> }) {
  if (!data) return null

  if (id === 'audit') {
    const overall = data.overall as number
    const geo = data.geo as number | null
    const ageDays = data.age_days as number
    return (
      <span className="text-xs text-emerald-400 ml-1">
        {overall}/100 overall · GEO {geo ?? 'N/A'}/100
        {ageDays > 7 ? ` · ⚠️ ${ageDays}d old` : ''}
      </span>
    )
  }
  if (id === 'icp') {
    const total = data.total as number
    const hot   = data.hot as number
    const newL  = data.new as number
    return (
      <span className="text-xs text-emerald-400 ml-1">
        {total} leads total · {hot} hot · {newL} new this week
      </span>
    )
  }
  if (id === 'leads') {
    const found = data.found as number
    const real  = data.real as boolean
    const icp   = data.icp as string | undefined
    if (!found && !icp) return <span className="text-xs text-slate-500 ml-1">no results (search service may be offline)</span>
    return (
      <span className="text-xs text-emerald-400 ml-1">
        {found} companies found {real ? '· real results' : '· ICP-generated'}
        {icp ? ` · ${icp}` : ''}
      </span>
    )
  }
  if (id === 'geo') {
    if (data.stale) return <span className="text-xs text-amber-400 ml-1">GEO not yet run — run GEO Optimizer first</span>
    const gaps   = data.content_gaps as number
    const high   = data.high_impact as number
    const visRate = data.ai_visibility_rate as number | null
    return (
      <span className="text-xs text-emerald-400 ml-1">
        {gaps} gaps · {high} high-impact
        {visRate != null ? ` · Gemini visibility: ${visRate}%` : ' · Gemini: no data'}
      </span>
    )
  }
  if (id === 'ai') {
    return <span className="text-xs text-emerald-400 ml-1">3 action items generated</span>
  }
  if (id === 'inbox') {
    return <span className="text-xs text-emerald-400 ml-1">Saved to Agent Inbox</span>
  }
  return null
}

export function GtmClient({ initialLastRun }: { initialLastRun: LastRun | null }) {
  const [lastRun, setLastRun] = useState<LastRun | null>(initialLastRun)
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState<Record<string, StepState>>({})
  const [error, setError] = useState('')

  function setStep(id: string, update: Partial<StepState>) {
    setSteps(prev => ({ ...prev, [id]: { ...prev[id], ...update } }))
  }

  async function runGtm() {
    setRunning(true)
    setError('')
    setSteps({})

    try {
      const res = await fetch('/api/gtm/run', { method: 'POST' })

      if (!res.body) {
        setError('No response from server')
        setRunning(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))

            if (event.type === 'step') {
              setStep(event.id, { status: event.status, data: event.data })
            } else if (event.type === 'done') {
              setLastRun(event.result)
              setRunning(false)
            } else if (event.type === 'error') {
              if (event.code === 428) {
                setError('requires_audit')
              } else if (event.code === 402) {
                setError('Insufficient credits. Top up in Settings → Billing.')
              } else {
                setError(event.msg ?? 'GTM run failed')
              }
              setRunning(false)
            }
          } catch {}
        }
      }
    } catch {
      setError('Network error. Please try again.')
      setRunning(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🚀</span>
            <h1 className="text-2xl font-bold text-white">GTM Autopilot</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">
              AI-Powered
            </span>
          </div>
          <p className="text-slate-400 text-sm">
            Runs your full go-to-market: audits website, searches leads, checks GEO + Gemini AI visibility, then gives you a precise action plan.
          </p>
          {lastRun && (
            <p className="text-xs text-slate-600 mt-1">Last run: {timeAgo(lastRun.ran_at)}</p>
          )}
        </div>

        <button
          onClick={runGtm}
          disabled={running}
          className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-violet-900/40 text-sm"
        >
          {running ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Running…</>
          ) : (
            <><span>⚡</span> Run GTM Now · 30 credits</>
          )}
        </button>
      </div>

      {/* Audit-required gate error */}
      {error === 'requires_audit' && (
        <div className="mb-6 p-5 bg-amber-950/20 border border-amber-800/40 rounded-2xl">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">⚠️</span>
            <div>
              <p className="text-amber-300 font-semibold mb-1">Website Audit required first</p>
              <p className="text-amber-400/70 text-sm mb-3">
                GTM Autopilot reads your audit data as its first step. Run a Website Audit once to unlock GTM.
              </p>
              <Link
                href="/audit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-sm font-medium transition-colors"
              >
                🔍 Go to Website Audit →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Other errors */}
      {error && error !== 'requires_audit' && (
        <div className="mb-6 p-3 bg-red-950/20 border border-red-800/30 rounded-xl text-red-400 text-sm">
          ❌ {error}
        </div>
      )}

      {/* Live steps during run */}
      {running && (
        <div className="mb-8 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-4">Running GTM Autopilot…</p>
          <div className="space-y-3">
            {STEPS.map(step => {
              const state = steps[step.id] ?? { status: 'idle' }
              const done    = state.status === 'done'
              const active  = state.status === 'running'
              const pending = state.status === 'idle'
              return (
                <div key={step.id} className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs mt-0.5 transition-all ${
                    done    ? 'bg-emerald-500 text-white' :
                    active  ? 'bg-violet-600 text-white' :
                    'bg-slate-800 text-slate-600'
                  }`}>
                    {done
                      ? '✓'
                      : active
                        ? <span className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin block" />
                        : <span className="text-slate-600 text-[10px]">·</span>}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className={`text-sm ${
                        done    ? 'text-slate-400' :
                        active  ? 'text-white font-medium' :
                        'text-slate-600'
                      }`}>
                        {step.icon} {step.label}
                      </span>
                      {done && (
                        <StepResult
                          id={step.id}
                          data={state.data as Record<string, unknown>}
                        />
                      )}
                      {active && (
                        <span className="text-xs text-slate-500">{step.defaultLabel}…</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pre-run explainer */}
      {!lastRun && !running && !error && (
        <div className="mb-8 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-sm font-semibold text-white mb-1">What GTM Autopilot actually does:</p>
          <p className="text-xs text-slate-500 mb-5">Each step uses a real CooVex feature — not just reading numbers.</p>
          <div className="space-y-3">
            {[
              { icon: '🔍', title: 'Website Audit', desc: 'Reads your latest audit — overall score, GEO score, critical issues' },
              { icon: '👥', title: 'Lead Pipeline & ICP', desc: 'Analyzes your lead database — total, hot leads, top industries for ICP' },
              { icon: '🎯', title: 'AI Lead Finder', desc: 'Builds ICP from audit → searches for real companies → enriches with emails' },
              { icon: '🧠', title: 'GEO & Gemini', desc: 'Reads AI search visibility — how often Gemini mentions your business' },
              { icon: '⚡', title: 'AI Action Plan', desc: 'Generates 3 precise, data-driven GTM actions for this week' },
              { icon: '📥', title: 'Agent Inbox', desc: 'Saves the full report to your Agent Inbox' },
            ].map(s => (
              <div key={s.title} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-xl">
                <span className="text-lg flex-shrink-0">{s.icon}</span>
                <div>
                  <p className="text-sm font-medium text-white">{s.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-4 text-center">30 credits · ~30–60 seconds · Requires Website Audit</p>
        </div>
      )}

      {/* Results */}
      {lastRun && !running && (
        <>
          {/* Executive summary */}
          {lastRun.summary && (
            <div className="mb-6 p-4 bg-violet-950/20 border border-violet-800/30 rounded-xl">
              <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-1">GTM Health Summary</p>
              <p className="text-sm text-slate-300 leading-relaxed">{lastRun.summary}</p>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              {
                label: 'Audit Score',
                value: lastRun.audit_score != null ? `${lastRun.audit_score}/100` : '—',
                sub: `GEO: ${lastRun.audit_geo_score ?? 'N/A'}/100`,
                color: (lastRun.audit_score ?? 0) >= 70 ? 'text-emerald-400' : 'text-amber-400',
                link: '/audit',
              },
              {
                label: 'Hot Leads',
                value: lastRun.hot_leads,
                sub: `${lastRun.new_leads} new · ${lastRun.discovered_leads} by AI Finder`,
                color: 'text-rose-400',
                link: '/leads',
              },
              {
                label: 'Content Drafts',
                value: lastRun.draft_posts,
                sub: `${lastRun.scheduled_posts} scheduled`,
                color: 'text-amber-400',
                link: '/content',
              },
              {
                label: 'AI Visibility',
                value: lastRun.ai_visibility_rate != null ? `${lastRun.ai_visibility_rate}%` : '—',
                sub: `${lastRun.high_impact_gaps} high-impact gaps`,
                color: lastRun.ai_visibility_rate != null
                  ? lastRun.ai_visibility_rate >= 50 ? 'text-emerald-400' : 'text-violet-400'
                  : 'text-slate-500',
                link: '/content/ideas',
              },
            ].map(s => (
              <Link
                key={s.label}
                href={s.link}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors group"
              >
                <p className="text-xs text-slate-500 mb-1 group-hover:text-slate-400 transition-colors">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">{s.sub}</p>
              </Link>
            ))}
          </div>

          {/* AI Action Plan */}
          {lastRun.actions.length > 0 && (
            <div className="bg-slate-900 border border-violet-800/30 rounded-2xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">⚡</span>
                <h2 className="text-sm font-semibold text-white">GTM Action Plan — This Week</h2>
                <span className="text-[10px] px-1.5 py-0.5 bg-violet-500/15 text-violet-400 border border-violet-500/25 rounded-full">
                  AI Generated
                </span>
              </div>
              <div className="space-y-3">
                {lastRun.actions.map((action, i) => (
                  <Link
                    key={i}
                    href={action.link}
                    className="flex items-start gap-3 p-4 bg-slate-800/60 border border-slate-700/50 rounded-xl hover:border-violet-700/40 transition-colors group"
                  >
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center text-[10px] font-bold ${
                      action.priority === 'high' ? 'bg-rose-500 text-white' : 'bg-amber-500/30 text-amber-400'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-white group-hover:text-violet-300 transition-colors">{action.title}</p>
                        {action.priority === 'high' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-rose-500/15 text-rose-400 border border-rose-500/25 rounded-full flex-shrink-0">HIGH</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{action.detail}</p>
                    </div>
                    <span className="text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0">→</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Bottom row: Competitors + GEO notice */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lastRun.competitors > 0 && (
              <Link href="/competitors" className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🏆</span>
                  <div>
                    <p className="text-sm font-medium text-white">Competitors</p>
                    <p className="text-xs text-slate-500">{lastRun.competitors} tracked</p>
                  </div>
                </div>
                <span className="text-slate-600 text-sm">→</span>
              </Link>
            )}

            {lastRun.ai_visibility_rate == null && (
              <Link href="/content/ideas" className="bg-slate-900 border border-amber-800/30 rounded-xl p-4 flex items-center justify-between hover:border-amber-700/40 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🧠</span>
                  <div>
                    <p className="text-sm font-medium text-amber-300">GEO Optimizer</p>
                    <p className="text-xs text-slate-500">Run to check Gemini AI visibility</p>
                  </div>
                </div>
                <span className="text-amber-600 text-sm">→</span>
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  )
}
