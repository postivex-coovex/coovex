'use client'

import { useState } from 'react'
import Link from 'next/link'

interface GtmAction { title: string; detail: string; priority: 'high' | 'medium'; link: string }

interface LastRun {
  ran_at: string
  new_leads: number
  total_leads: number
  hot_leads: number
  draft_posts: number
  scheduled_posts: number
  competitors: number
  content_gaps: number
  high_impact_gaps: number
  actions: GtmAction[]
}

const STEPS = [
  { id: 'leads',       label: 'Scanning lead pipeline',         icon: '👥' },
  { id: 'content',     label: 'Checking content calendar',       icon: '✍️' },
  { id: 'competitors', label: 'Reviewing competitor intelligence', icon: '🏆' },
  { id: 'geo',         label: 'Analyzing GEO content gaps',      icon: '🧠' },
  { id: 'ai',          label: 'Generating GTM action plan',      icon: '⚡' },
  { id: 'inbox',       label: 'Updating Agent Inbox',            icon: '📥' },
]

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function GtmClient({ initialLastRun }: { initialLastRun: LastRun | null }) {
  const [lastRun, setLastRun] = useState<LastRun | null>(initialLastRun)
  const [running, setRunning] = useState(false)
  const [stepIdx, setStepIdx] = useState(-1)
  const [error, setError] = useState('')

  async function runGtm() {
    setRunning(true)
    setError('')
    setStepIdx(0)

    // Animate steps while API runs
    const stepTimer = setInterval(() => {
      setStepIdx(i => {
        if (i >= STEPS.length - 2) { clearInterval(stepTimer); return i }
        return i + 1
      })
    }, 1200)

    try {
      const res = await fetch('/api/gtm/run', { method: 'POST' })
      clearInterval(stepTimer)

      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to run GTM Autopilot')
        setStepIdx(-1)
        return
      }

      const data: LastRun = await res.json()
      setStepIdx(STEPS.length - 1)
      await new Promise(r => setTimeout(r, 600))
      setLastRun(data)
      setStepIdx(-1)
    } catch {
      clearInterval(stepTimer)
      setError('Network error. Please try again.')
      setStepIdx(-1)
    } finally {
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
            One click — your AI agent scans leads, content, competitors, and GEO gaps, then hands you a prioritized action plan.
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

      {error && (
        <div className="mb-6 p-3 bg-red-950/20 border border-red-800/30 rounded-xl text-red-400 text-sm">❌ {error}</div>
      )}

      {/* Steps animation */}
      {running && (
        <div className="mb-8 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-4">Running GTM Autopilot…</p>
          <div className="space-y-3">
            {STEPS.map((step, i) => {
              const done    = i < stepIdx
              const active  = i === stepIdx
              const pending = i > stepIdx
              return (
                <div key={step.id} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs transition-all ${
                    done    ? 'bg-emerald-500 text-white' :
                    active  ? 'bg-violet-600 text-white' :
                    'bg-slate-800 text-slate-600'
                  }`}>
                    {done ? '✓' : active ? <span className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin block" /> : '○'}
                  </div>
                  <span className={`text-sm ${
                    done    ? 'text-slate-400 line-through' :
                    active  ? 'text-white font-medium' :
                    'text-slate-600'
                  }`}>
                    {step.icon} {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* What it does (shown before first run) */}
      {!lastRun && !running && (
        <div className="mb-8 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-sm font-semibold text-white mb-4">What GTM Autopilot does in one click:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: '👥', title: 'Lead Pipeline Scan', desc: 'Counts new and hot leads from the past 7 days' },
              { icon: '✍️', title: 'Content Status', desc: 'Reviews draft and scheduled posts — flags if pipeline is thin' },
              { icon: '🏆', title: 'Competitor Check', desc: 'Summarizes latest competitor intelligence' },
              { icon: '🧠', title: 'GEO Gap Analysis', desc: 'Counts high-impact content gaps from GEO Optimizer' },
              { icon: '⚡', title: 'AI Action Plan', desc: 'Generates 3 specific GTM actions tailored to your business data' },
              { icon: '📥', title: 'Agent Inbox Update', desc: 'Saves the full summary to your Agent Inbox' },
            ].map(s => (
              <div key={s.title} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-xl">
                <span className="text-xl flex-shrink-0">{s.icon}</span>
                <div>
                  <p className="text-sm font-medium text-white">{s.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-4 text-center">Costs 30 credits per run · Takes ~30 seconds</p>
        </div>
      )}

      {/* Last run results */}
      {lastRun && !running && (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'New Leads (7d)', value: lastRun.new_leads, sub: `${lastRun.total_leads} total`, color: 'text-blue-400', link: '/leads' },
              { label: 'Hot Leads', value: lastRun.hot_leads, sub: 'score ≥ 70', color: 'text-rose-400', link: '/leads' },
              { label: 'Content Drafts', value: lastRun.draft_posts, sub: `${lastRun.scheduled_posts} scheduled`, color: 'text-amber-400', link: '/content' },
              { label: 'GEO Gaps', value: lastRun.content_gaps, sub: `${lastRun.high_impact_gaps} high impact`, color: 'text-violet-400', link: '/content/ideas' },
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
                <span className="text-[10px] px-1.5 py-0.5 bg-violet-500/15 text-violet-400 border border-violet-500/25 rounded-full">AI Generated</span>
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
                    <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-sm flex-shrink-0">→</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Competitors row */}
          {lastRun.competitors > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">🏆</span>
                <div>
                  <p className="text-sm font-medium text-white">Competitor Intelligence</p>
                  <p className="text-xs text-slate-500">{lastRun.competitors} competitors tracked</p>
                </div>
              </div>
              <Link href="/competitors" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                View →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
