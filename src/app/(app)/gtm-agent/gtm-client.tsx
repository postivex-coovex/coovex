'use client'

import { useState } from 'react'
import Link from 'next/link'

interface GtmAction { title: string; detail: string; priority: 'high' | 'medium'; link: string }

interface SearchPresence {
  ga4: boolean; ga4_id: string | null; gtm: boolean
  gsc_verified: boolean; gsc_verification_id: string | null
  bing_verified: boolean; bing_verification_id: string | null
  indexnow_configured: boolean; sitemap_in_robots: boolean
}

interface StaticData {
  auditScore: number
  auditGeoScore: number | null
  auditAgeDays: number
  totalLeads: number
  hotLeads: number
  draftPosts: number
  scheduledPosts: number
  competitors: number
  searchPresence: SearchPresence | null
  geminiRate: number | null
  geoContentGaps: number
  geoHighImpact: number
  topGaps: string[]
  launchMap: Record<string, { status: string; url?: string | null }>
  businessId: string
}

interface LastRun {
  ran_at: string
  audit_score: number | null
  audit_geo_score: number | null
  audit_age_days: number
  total_leads: number
  new_leads: number
  hot_leads: number
  discovered_leads: number
  saved_leads?: number
  discovered_real?: boolean
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
  { id: 'audit',  label: 'Website Audit',           icon: '🔍', defaultLabel: 'Reading audit results' },
  { id: 'icp',    label: 'Lead Pipeline & ICP',      icon: '👥', defaultLabel: 'Analyzing leads & building ICP' },
  { id: 'leads',  label: 'AI Lead Finder',            icon: '🎯', defaultLabel: 'ICP → search → email enrichment' },
  { id: 'geo',    label: 'GEO & Gemini Visibility',  icon: '🧠', defaultLabel: 'Checking AI search visibility' },
  { id: 'ai',     label: 'AI Action Plan',           icon: '⚡', defaultLabel: 'Generating GTM action plan' },
  { id: 'inbox',  label: 'Agent Inbox',              icon: '📥', defaultLabel: 'Saving results' },
]

const LAUNCH_PLATFORMS = [
  { id: 'google_business', label: 'Google Business Profile', icon: '🗺️', href: 'https://business.google.com', category: 'Search' },
  { id: 'linkedin', label: 'LinkedIn Company Page', icon: '💼', href: 'https://linkedin.com/company', category: 'Social' },
  { id: 'twitter', label: 'Twitter / X', icon: '𝕏', href: 'https://x.com', category: 'Social' },
  { id: 'product_hunt', label: 'Product Hunt', icon: '🐱', href: 'https://producthunt.com/posts/new', category: 'Launch' },
  { id: 'indie_hackers', label: 'Indie Hackers', icon: '🛠️', href: 'https://indiehackers.com', category: 'Launch' },
  { id: 'hacker_news', label: 'Hacker News (Show HN)', icon: '🔶', href: 'https://news.ycombinator.com', category: 'Launch' },
  { id: 'crunchbase', label: 'Crunchbase', icon: '📊', href: 'https://crunchbase.com', category: 'Directory' },
  { id: 'g2', label: 'G2 Reviews', icon: '⭐', href: 'https://g2.com', category: 'Directory' },
  { id: 'capterra', label: 'Capterra', icon: '📋', href: 'https://capterra.com', category: 'Directory' },
  { id: 'betalist', label: 'BetaList', icon: '🚀', href: 'https://betalist.com', category: 'Launch' },
]

const SEARCH_CHECKS = [
  { key: 'gsc_verified',         label: 'Google Search Console',  icon: '🔍', fix: '/audit' },
  { key: 'ga4',                  label: 'Google Analytics (GA4)',  icon: '📊', fix: 'https://analytics.google.com' },
  { key: 'bing_verified',        label: 'Bing Webmaster Tools',    icon: '🔎', fix: 'https://www.bing.com/webmasters' },
  { key: 'sitemap_in_robots',    label: 'Sitemap in robots.txt',   icon: '🗺️', fix: '/audit' },
  { key: 'indexnow_configured',  label: 'IndexNow Auto-Submit',    icon: '⚡', fix: '/audit' },
]

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function calcProgress(sd: StaticData) {
  const items = [
    { label: 'Website Audit run',        done: sd.auditScore > 0,                                             link: '/audit' },
    { label: 'Audit score ≥ 70',         done: sd.auditScore >= 70,                                           link: '/audit' },
    { label: 'GEO Optimizer run',        done: sd.geoContentGaps > 0 || sd.geminiRate !== null,               link: '/content/ideas' },
    { label: 'AI visibility > 0%',       done: (sd.geminiRate ?? 0) > 0,                                      link: '/content/ideas' },
    { label: 'Leads in pipeline',        done: sd.totalLeads > 0,                                             link: '/leads' },
    { label: 'Hot leads (score ≥ 70)',   done: sd.hotLeads > 0,                                               link: '/leads' },
    { label: 'Content created',          done: sd.draftPosts > 0 || sd.scheduledPosts > 0,                    link: '/content' },
    { label: 'Google Search Console',    done: !!sd.searchPresence?.gsc_verified,                             link: '/audit' },
    { label: 'Google Analytics (GA4)',   done: !!sd.searchPresence?.ga4,                                      link: '/audit' },
    { label: 'Launched on a platform',   done: Object.values(sd.launchMap).some(s => s.status === 'done' || s.status === 'live'), link: undefined },
  ]
  const score = items.filter(i => i.done).length
  return { score, total: items.length, pct: Math.round((score / items.length) * 100), items }
}

function StepResult({ id, data }: { id: string; data?: Record<string, unknown> }) {
  if (!data) return null
  if (id === 'audit') {
    const overall = data.overall as number
    const geo = data.geo as number | null
    const ageDays = data.age_days as number
    return (
      <span className="text-xs text-blue-400 ml-1">
        {overall}/100 overall · GEO {geo ?? 'N/A'}/100
        {ageDays > 7 ? ` · ⚠️ ${ageDays}d old` : ''}
      </span>
    )
  }
  if (id === 'icp') {
    const total = data.total as number
    const hot = data.hot as number
    return <span className="text-xs text-blue-400 ml-1">{total} leads · {hot} hot</span>
  }
  if (id === 'leads') {
    const found = data.found as number
    const real = data.real as boolean
    const saved = data.saved as number | undefined
    if (!found) return <span className="text-xs text-slate-500 ml-1">no results (search may be offline)</span>
    return (
      <span className="text-xs text-blue-400 ml-1">
        {found} found {real ? '(real)' : '(ICP-generated)'}
        {saved ? ` · ${saved} added to pipeline` : ''}
      </span>
    )
  }
  if (id === 'geo') {
    if (data.stale) return <span className="text-xs text-slate-500 ml-1">not run yet — run GEO Optimizer</span>
    const visRate = data.ai_visibility_rate as number | null
    return (
      <span className="text-xs text-blue-400 ml-1">
        {data.high_impact as number} high-impact gaps
        {visRate != null ? ` · Gemini: ${visRate}%` : ''}
      </span>
    )
  }
  if (id === 'ai') return <span className="text-xs text-blue-400 ml-1">3 action items generated</span>
  if (id === 'inbox') return <span className="text-xs text-blue-400 ml-1">saved to Agent Inbox</span>
  return null
}

interface PendingTask {
  id: string
  type: string
  title: string
  body: string
  action_label?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action_data_json?: any
  created_at: string
}

export function GtmClient({ initialLastRun, staticData, pendingTasks: initialPendingTasks }: {
  initialLastRun: LastRun | null
  staticData: StaticData
  pendingTasks: PendingTask[]
}) {
  const [lastRun, setLastRun] = useState<LastRun | null>(initialLastRun)
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState<Record<string, StepState>>({})
  const [error, setError] = useState('')
  const [launchMap, setLaunchMap] = useState<Record<string, { status: string; url?: string | null }>>(staticData.launchMap)
  const [togglingPlatform, setTogglingPlatform] = useState<string | null>(null)
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>(initialPendingTasks)
  const [dismissingTask, setDismissingTask] = useState<string | null>(null)

  function setStep(id: string, update: Partial<StepState>) {
    setSteps(prev => ({ ...prev, [id]: { ...prev[id], ...update } }))
  }

  async function runGtm() {
    setRunning(true)
    setError('')
    setSteps({})
    try {
      const res = await fetch('/api/gtm/run', { method: 'POST' })
      if (!res.body) { setError('No response'); setRunning(false); return }
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
            if (event.type === 'step') setStep(event.id, { status: event.status, data: event.data })
            else if (event.type === 'done') { setLastRun(event.result); setRunning(false) }
            else if (event.type === 'error') {
              setError(event.code === 428 ? 'requires_audit' : event.code === 402 ? 'Insufficient credits.' : (event.msg ?? 'Failed'))
              setRunning(false)
            }
          } catch {}
        }
      }
    } catch { setError('Network error.'); setRunning(false) }
  }

  async function dismissTask(taskId: string) {
    setDismissingTask(taskId)
    try {
      await fetch('/api/gtm/dismiss-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal_id: taskId }),
      })
      setPendingTasks(prev => prev.filter(t => t.id !== taskId))
    } catch {}
    setDismissingTask(null)
  }

  async function togglePlatform(platformId: string, current: { status: string; url?: string | null }) {
    const newStatus = current.status === 'done' ? 'not_started' : 'done'
    setTogglingPlatform(platformId)
    try {
      await fetch('/api/gtm/platform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform_id: platformId, status: newStatus }),
      })
      setLaunchMap(prev => ({ ...prev, [platformId]: { ...prev[platformId], status: newStatus } }))
    } catch {}
    setTogglingPlatform(null)
  }

  const progress = calcProgress({ ...staticData, launchMap })
  const sp = staticData.searchPresence
  const actions = lastRun?.actions ?? []

  const displayHotLeads = lastRun?.hot_leads ?? staticData.hotLeads
  const displayDrafts   = lastRun?.draft_posts ?? staticData.draftPosts
  const displayAIVis    = lastRun?.ai_visibility_rate ?? staticData.geminiRate

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🚀</span>
            <h1 className="text-xl font-bold text-white">GTM Autopilot</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">AI-Powered</span>
          </div>
          <p className="text-slate-400 text-xs">Runs leads, GEO, content gaps, and action plan in one click.</p>
          {lastRun && <p className="text-xs text-slate-600 mt-0.5">Last run: {timeAgo(lastRun.ran_at)}</p>}
        </div>
        <button
          onClick={runGtm} disabled={running}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          {running
            ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Running…</>
            : <><span>⚡</span> Run GTM Now · 30 credits</>}
        </button>
      </div>

      {/* Error */}
      {error === 'requires_audit' && (
        <div className="mb-5 p-4 bg-slate-950/20 border border-slate-700/40 rounded-2xl flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="text-slate-400 font-semibold text-sm">Website Audit required</p>
            <Link href="/audit" className="text-xs text-slate-500 underline">Run Website Audit →</Link>
          </div>
        </div>
      )}
      {error && error !== 'requires_audit' && (
        <div className="mb-5 p-3 bg-red-950/20 border border-red-800/30 rounded-xl text-red-400 text-sm">❌ {error}</div>
      )}

      {/* ── Live run steps ──────────────────────────────────────────────────── */}
      {running && (
        <div className="mb-6 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-4">Running GTM Autopilot…</p>
          <div className="space-y-3">
            {STEPS.map(step => {
              const state = steps[step.id] ?? { status: 'idle' }
              const done   = state.status === 'done'
              const active = state.status === 'running'
              return (
                <div key={step.id} className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs mt-0.5 ${done ? 'bg-blue-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-600'}`}>
                    {done ? '✓' : active ? <span className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin block" /> : '·'}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <span className={`text-sm ${done ? 'text-slate-400' : active ? 'text-white font-medium' : 'text-slate-600'}`}>
                      {step.icon} {step.label}
                    </span>
                    {done && <StepResult id={step.id} data={state.data} />}
                    {active && <span className="text-xs text-slate-500 ml-1">{step.defaultLabel}…</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── GTM Progress ────────────────────────────────────────────────────── */}
      <div className="mb-5 bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">GTM Progress</p>
            <p className="text-2xl font-bold text-white mt-0.5">{progress.pct}% <span className="text-sm font-normal text-slate-500">complete</span></p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">{progress.score} / {progress.total} done</p>
          </div>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2 mb-4">
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{
              width: `${progress.pct}%`,
              background: progress.pct >= 70 ? '#2563eb' : progress.pct >= 40 ? '#3b82f6' : '#ef4444',
            }}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          {progress.items.map(item => (
            <div key={item.label} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] ${item.done ? 'bg-blue-600/10 text-blue-400' : 'bg-slate-800/60 text-slate-500'}`}>
              <span className="flex-shrink-0">{item.done ? '✓' : '○'}</span>
              <span className="truncate">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Key Metrics ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          {
            label: 'Audit Score', value: `${staticData.auditScore}/100`,
            sub: `GEO: ${staticData.auditGeoScore ?? 'N/A'}/100${staticData.auditAgeDays > 7 ? ` · ⚠️ ${staticData.auditAgeDays}d old` : ''}`,
            color: staticData.auditScore >= 70 ? 'text-blue-400' : 'text-slate-500', link: '/audit',
          },
          {
            label: 'Hot Leads', value: displayHotLeads,
            sub: `${staticData.totalLeads} total · ${staticData.competitors} competitors tracked`,
            color: displayHotLeads > 0 ? 'text-blue-400' : 'text-rose-400', link: '/leads',
          },
          {
            label: 'Content Pipeline', value: displayDrafts,
            sub: `${staticData.scheduledPosts} scheduled`,
            color: displayDrafts > 0 ? 'text-slate-500' : 'text-slate-500', link: '/content',
          },
          {
            label: 'AI Visibility', value: displayAIVis != null ? `${displayAIVis}%` : '—',
            sub: `${staticData.geoHighImpact} high-impact GEO gaps`,
            color: displayAIVis != null ? (displayAIVis >= 30 ? 'text-blue-400' : 'text-blue-400') : 'text-slate-500',
            link: '/content/ideas',
          },
        ].map(s => (
          <Link key={s.label} href={s.link} className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors group">
            <p className="text-xs text-slate-500 mb-1 group-hover:text-slate-400">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">{s.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* ── Search & Discovery Presence ─────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span>🔍</span>
            <h2 className="text-sm font-semibold text-white">Search & Discovery</h2>
            {sp ? (
              <span className="ml-auto text-[10px] text-slate-500">from latest audit</span>
            ) : (
              <Link href="/audit" className="ml-auto text-[10px] text-slate-500 hover:underline">Run audit to check →</Link>
            )}
          </div>
          <div className="space-y-2">
            {SEARCH_CHECKS.map(chk => {
              const done = sp ? !!(sp as unknown as Record<string, unknown>)[chk.key] : false
              return (
                <div key={chk.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${done ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-600'}`}>
                      {done ? '✓' : '○'}
                    </span>
                    <span className={`text-xs ${done ? 'text-slate-300' : 'text-slate-500'}`}>{chk.label}</span>
                  </div>
                  {!done && (
                    <Link href={chk.fix} className="text-[10px] text-blue-400 hover:text-blue-300">fix →</Link>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── GEO Gaps ────────────────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span>🧠</span>
            <h2 className="text-sm font-semibold text-white">AI Search Gaps</h2>
            <Link href="/content/ideas" className="ml-auto text-[10px] text-blue-400 hover:underline">GEO Optimizer →</Link>
          </div>
          {staticData.geoContentGaps === 0 && staticData.geminiRate === null ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <span className="text-3xl mb-2">🧠</span>
              <p className="text-sm text-slate-400 font-medium">GEO not analyzed yet</p>
              <p className="text-xs text-slate-600 mt-1">Run GEO Optimizer to check Gemini AI visibility</p>
              <Link href="/content/ideas" className="mt-3 px-3 py-1.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium hover:bg-blue-500/25 transition-colors">
                Run GEO Optimizer →
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4 p-3 bg-slate-800/60 rounded-xl">
                <div className="text-center flex-1">
                  <p className="text-xl font-bold text-white">{displayAIVis != null ? `${displayAIVis}%` : '—'}</p>
                  <p className="text-[10px] text-slate-500">Gemini visibility</p>
                </div>
                <div className="w-px h-8 bg-slate-700" />
                <div className="text-center flex-1">
                  <p className="text-xl font-bold text-slate-500">{staticData.geoHighImpact}</p>
                  <p className="text-[10px] text-slate-500">high-impact gaps</p>
                </div>
                <div className="w-px h-8 bg-slate-700" />
                <div className="text-center flex-1">
                  <p className="text-xl font-bold text-slate-300">{staticData.geoContentGaps}</p>
                  <p className="text-[10px] text-slate-500">total gaps</p>
                </div>
              </div>
              {staticData.topGaps.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Top gaps to fill</p>
                  {staticData.topGaps.map((gap, i) => (
                    <Link key={i} href="/content/ideas" className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors group">
                      <span className="w-4 h-4 rounded-full bg-slate-600/20 text-slate-500 text-[9px] flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <span className="text-xs text-slate-400 group-hover:text-slate-300 truncate">{gap}</span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── AI Action Plan ──────────────────────────────────────────────────── */}
      {actions.length > 0 && (
        <div className="mb-5 bg-slate-900 border border-slate-700/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <span>⚡</span>
            <h2 className="text-sm font-semibold text-white">This Week&apos;s GTM Actions</h2>
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-full">AI Generated</span>
            {lastRun && <span className="ml-auto text-[10px] text-slate-600">{timeAgo(lastRun.ran_at)}</span>}
          </div>
          {lastRun?.summary && (
            <p className="text-xs text-slate-400 mb-4 leading-relaxed border-l-2 border-slate-700/40 pl-3">{lastRun.summary}</p>
          )}
          <div className="space-y-2.5">
            {actions.map((action, i) => (
              <Link key={i} href={action.link} className="flex items-start gap-3 p-4 bg-slate-800/60 border border-slate-700/50 rounded-xl hover:border-slate-700/40 transition-colors group">
                <div className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center text-[10px] font-bold ${action.priority === 'high' ? 'bg-rose-500 text-white' : 'bg-slate-600/30 text-slate-500'}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-white group-hover:text-blue-300">{action.title}</p>
                    {action.priority === 'high' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-rose-500/15 text-rose-400 border border-rose-500/25 rounded-full flex-shrink-0">HIGH</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{action.detail}</p>
                </div>
                <span className="text-slate-600 group-hover:text-slate-400 flex-shrink-0">→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Pending Tasks ───────────────────────────────────────────────────── */}
      {pendingTasks.length > 0 && (
        <div className="mb-5 bg-slate-900 border border-slate-700/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span>📋</span>
            <h2 className="text-sm font-semibold text-white">Pending Tasks</h2>
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-600/15 text-slate-500 border border-slate-500/25 rounded-full">{pendingTasks.length}</span>
            <span className="ml-auto text-[10px] text-slate-500">from last audit scan</span>
          </div>
          <div className="space-y-2">
            {pendingTasks.map(task => (
              <div key={task.id} className="flex items-start gap-3 p-3 bg-slate-800/60 border border-slate-700/40 rounded-xl">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${task.type === 'warning' ? 'bg-rose-400' : task.type === 'opportunity' ? 'bg-blue-500' : 'bg-slate-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white leading-snug">{task.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{task.body}</p>
                  {task.action_data_json?.url && (
                    <Link href={task.action_data_json.url} className="text-[10px] text-blue-400 hover:text-blue-300 mt-1 inline-block">
                      {task.action_label || 'Fix →'}
                    </Link>
                  )}
                </div>
                <button
                  onClick={() => dismissTask(task.id)}
                  disabled={dismissingTask === task.id}
                  title="Dismiss"
                  className="w-5 h-5 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors flex-shrink-0 mt-0.5 text-sm"
                >
                  {dismissingTask === task.id
                    ? <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                    : '×'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Launch Platform Tracker ─────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <span>🚀</span>
          <h2 className="text-sm font-semibold text-white">Platform Launch Tracker</h2>
          <span className="ml-auto text-xs text-slate-500">
            {Object.values(launchMap).filter(s => s.status === 'done' || s.status === 'live').length} / {LAUNCH_PLATFORMS.length} done
          </span>
        </div>
        <p className="text-xs text-slate-600 mb-4">Click to mark as launched. These platforms boost discovery, backlinks, and early customers.</p>

        {/* Group by category */}
        {(['Launch', 'Social', 'Search', 'Directory'] as const).map(cat => {
          const platforms = LAUNCH_PLATFORMS.filter(p => p.category === cat)
          return (
            <div key={cat} className="mb-3 last:mb-0">
              <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider mb-2">{cat}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {platforms.map(p => {
                  const entry = launchMap[p.id] ?? { status: 'not_started' }
                  const done = entry.status === 'done' || entry.status === 'live'
                  const isAutoDetected = entry.status === 'live'
                  const detectedUrl = entry.url
                  const toggling = togglingPlatform === p.id
                  return (
                    <div key={p.id} className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors ${done ? 'bg-blue-600/8 border-slate-700/30' : 'bg-slate-800/50 border-slate-700/50'}`}>
                      <button
                        onClick={() => togglePlatform(p.id, entry)}
                        disabled={toggling}
                        className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center text-[10px] transition-colors ${
                          done ? 'bg-blue-600 border-blue-400 text-white' : 'border-slate-600 text-slate-600 hover:border-slate-400'
                        }`}
                      >
                        {toggling ? <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" /> : done ? '✓' : '○'}
                      </button>
                      <span className="text-sm flex-shrink-0">{p.icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs block truncate ${done ? 'text-slate-300 line-through decoration-emerald-600' : 'text-slate-400'}`}>{p.label}</span>
                        {isAutoDetected && (
                          <span className="text-[9px] text-blue-500 font-medium">AI detected</span>
                        )}
                      </div>
                      {done && detectedUrl && (
                        <a href={detectedUrl} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-blue-600 hover:text-blue-400 flex-shrink-0 transition-colors" title="View listing">↗</a>
                      )}
                      {!done && (
                        <a href={p.href} target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-600 hover:text-blue-400 flex-shrink-0 transition-colors">↗</a>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pre-run prompt if no last run */}
      {!lastRun && !running && (
        <div className="mt-5 p-4 bg-slate-950/20 border border-slate-700/30 rounded-2xl text-center">
          <p className="text-sm text-slate-300 mb-1">Ready to run your full GTM sweep?</p>
          <p className="text-xs text-slate-500 mb-3">Finds leads, checks Gemini visibility, generates your action plan — 30 credits · ~45 seconds</p>
          <button onClick={runGtm} disabled={running} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors">
            ⚡ Run GTM Autopilot
          </button>
        </div>
      )}
    </div>
  )
}
