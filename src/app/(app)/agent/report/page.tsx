'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { RefreshCw, Bot, CheckCircle, Zap, Clock, TrendingUp, ArrowRight, Shield, User } from 'lucide-react'

interface AgentEvent {
  time: string
  type: string
  icon: string
  title: string
  detail: string
  color: string
}

interface DaySummary {
  signals_today: number
  leads_today: number
  posts_today: number
  posts_published: number
  reviews_today: number
  health_score: number
  won_rate: number
  total_leads: number
}

interface WeekSummary {
  signals: number
  posts: number
  leads: number
  campaigns: number
  proposals: number
  proposal_views: number
  emails_sent: number
  urgent_signals: number
  minutes_saved: number
  active_products: number
  actions_executed: number
  auto_executed: number
  user_executed: number
}

interface ActivityLogEntry {
  id: string
  action_type: string
  label: string
  icon: string
  color: string
  executed_by: string
  executed_at: string
  confidence: number | null
  result: Record<string, unknown> | null
  signal_id: string
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function fmtMins(mins: number) {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

const AUTOMATIONS = [
  { icon: '🌅', title: 'Daily AI Brief',       desc: 'Generated every morning at 6 AM with your business health & priorities' },
  { icon: '🔍', title: 'Audit Monitoring',     desc: 'Continuously scans your website, SEO, and competitor changes' },
  { icon: '👤', title: 'Lead Scoring',          desc: 'Scores and categorises every new lead using AI behavioural analysis' },
  { icon: '✍️', title: 'Content Suggestions',   desc: 'Suggests and drafts social posts based on your products & industry trends' },
  { icon: '📧', title: 'Campaign Optimisation', desc: 'Tracks email performance and flags low-performing campaigns automatically' },
  { icon: '⭐', title: 'Review Monitoring',     desc: 'Monitors Google, Yelp, Facebook reviews and alerts you to negative sentiment' },
  { icon: '📋', title: 'Proposal Tracking',     desc: 'Notifies you when prospects view proposals and suggests follow-up timing' },
  { icon: '❗', title: 'Urgent Signals',        desc: 'Fires priority alerts when business metrics drop or opportunities arise' },
]

export default function AgentReportPage() {
  const [events, setEvents]       = useState<AgentEvent[]>([])
  const [summary, setSummary]     = useState<DaySummary | null>(null)
  const [week, setWeek]           = useState<WeekSummary | null>(null)
  const [loading, setLoading]     = useState(true)
  const [showAll, setShowAll]     = useState(false)
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])
  const [logFilter, setLogFilter] = useState<'all' | 'auto' | 'user'>('all')
  const [logLoading, setLogLoading] = useState(true)
  const [autoCount, setAutoCount] = useState(0)
  const [userCount, setUserCount] = useState(0)

  function loadActivity(filter: 'all' | 'auto' | 'user' = 'all') {
    setLogLoading(true)
    fetch(`/api/agent/activity-log?limit=30&filter=${filter}`)
      .then(r => r.json())
      .then(d => {
        setActivityLog(d.logs ?? [])
        setAutoCount(d.auto_count ?? 0)
        setUserCount(d.user_count ?? 0)
        setLogLoading(false)
      })
      .catch(() => setLogLoading(false))
  }

  function load() {
    setLoading(true)
    fetch('/api/agent/report')
      .then(r => r.json())
      .then(d => {
        setEvents(d.events ?? [])
        setSummary(d.summary ?? null)
        setWeek(d.week ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
    loadActivity('all')
  }

  useEffect(() => { load() }, [])

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const visibleEvents = showAll ? events : events.slice(0, 6)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <Bot className="w-5 h-5 text-violet-400" />
            <h1 className="text-2xl font-bold text-white">AI Agent Report</h1>
          </div>
          <p className="text-slate-400 text-sm">{today}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Today's snapshot */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Signals Fired',   display: String(summary.signals_today),         suffix: '',    color: 'text-violet-400',  bg: 'bg-violet-500/10'  },
            { label: 'New Leads',       display: String(summary.leads_today),            suffix: '',    color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            {
              label: 'Health Score',
              display: String(summary.health_score), suffix: '/100',
              color: summary.health_score >= 70 ? 'text-emerald-400' : summary.health_score >= 40 ? 'text-amber-400' : 'text-red-400',
              bg:    summary.health_score >= 70 ? 'bg-emerald-500/10' : summary.health_score >= 40 ? 'bg-amber-500/10' : 'bg-red-500/10',
            },
            { label: 'Time Saved (7d)', display: week ? fmtMins(week.minutes_saved) : '–', suffix: '', color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border border-slate-800 rounded-2xl p-5 text-center`}>
              <p className={`text-3xl font-bold ${s.color}`}>
                {s.display}
                {s.suffix && <span className="text-sm ml-1 font-normal text-slate-500">{s.suffix}</span>}
              </p>
              <p className="text-slate-500 text-xs mt-1.5 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Today's summary card */}
      {summary && (
        <div className="bg-violet-950/20 border border-violet-800/30 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-violet-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-violet-300 font-semibold mb-2 text-base">Today&apos;s AI Summary</p>
              <p className="text-slate-400 text-sm leading-relaxed">
                {summary.signals_today > 0
                  ? <>Your AI agent fired <span className="text-white font-medium">{summary.signals_today} signal{summary.signals_today !== 1 ? 's' : ''}</span>{summary.leads_today > 0 && <>, captured <span className="text-white font-medium">{summary.leads_today} new lead{summary.leads_today !== 1 ? 's' : ''}</span></>}{summary.posts_today > 0 && <>, and drafted <span className="text-white font-medium">{summary.posts_today} post{summary.posts_today !== 1 ? 's' : ''}</span></>}.</>
                  : <>Your AI agent is actively monitoring your business. The morning brief has been prepared and all automations are running.</>
                }
                {summary.total_leads > 0 && (
                  <> Lifetime: <span className="text-white font-medium">{summary.total_leads} total leads</span> with a <span className={summary.won_rate >= 30 ? 'text-emerald-400' : 'text-amber-400'}>{summary.won_rate}% win rate</span>.</>
                )}
                {' '}Business health: <span className={summary.health_score >= 70 ? 'text-emerald-400' : 'text-amber-400'}>{summary.health_score}/100</span>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 7-day performance */}
      {week && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h2 className="text-white font-semibold">Last 7 Days — AI Performance</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y divide-slate-800">
            {[
              { label: 'AI Signals',       value: week.signals,          color: 'text-violet-400'  },
              { label: 'Posts Drafted',    value: week.posts,            color: 'text-blue-400'    },
              { label: 'Leads Tracked',    value: week.leads,            color: 'text-emerald-400' },
              { label: 'Emails Sent',      value: week.emails_sent,      color: 'text-sky-400'     },
              { label: 'Proposals',        value: week.proposals,        color: 'text-amber-400'   },
              { label: 'Proposal Views',   value: week.proposal_views,   color: 'text-orange-400'  },
              { label: 'Actions Executed', value: week.actions_executed, color: week.actions_executed > 0 ? 'text-violet-400' : 'text-slate-600' },
              { label: 'Urgent Alerts',    value: week.urgent_signals,   color: week.urgent_signals > 0 ? 'text-red-400' : 'text-slate-600' },
              { label: 'Auto-Executed',    value: week.auto_executed,    color: 'text-teal-400'    },
              { label: 'Time Saved',       value: fmtMins(week.minutes_saved), color: 'text-emerald-400' },
            ].map(m => (
              <div key={m.label} className="p-4 text-center">
                <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                <p className="text-slate-500 text-[10px] mt-1 uppercase tracking-wide font-medium">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity timeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-white font-semibold">Today&apos;s Activity Timeline</h2>
          <span className="text-slate-500 text-xs">{events.length} event{events.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32 text-slate-600 text-sm">Loading…</div>
        ) : (
          <div className="relative">
            <div className="absolute left-[3.25rem] top-0 bottom-0 w-px bg-slate-800" />

            <div className="divide-y divide-slate-800/50">
              {visibleEvents.map((event, i) => (
                <div key={i} className="flex gap-5 px-6 py-4 hover:bg-slate-800/20 transition-colors">
                  <span className="text-xs text-slate-500 w-16 flex-shrink-0 pt-0.5 text-right leading-tight">
                    {fmtTime(event.time)}
                  </span>
                  <div className="relative z-10 w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs">{event.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${event.color}`}>{event.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{event.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {events.length > 6 && (
              <div className="px-5 py-3 border-t border-slate-800">
                <button
                  onClick={() => setShowAll(v => !v)}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  {showAll ? '↑ Show less' : `+ ${events.length - 6} more events`}
                </button>
              </div>
            )}

            <div className="flex gap-5 px-6 py-4 border-t border-slate-800">
              <span className="w-16" />
              <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <p className="text-slate-500 text-sm pt-0.5">Agent monitoring continues 24/7</p>
            </div>
          </div>
        )}
      </div>

      {/* Automations running */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
          <Clock className="w-4 h-4 text-violet-400" />
          <h2 className="text-white font-semibold">Automations Running for You</h2>
          <span className="ml-auto text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/30 px-1.5 py-0.5 rounded-full">
            ● All active
          </span>
        </div>
        <div className="divide-y divide-slate-800/50">
          <div className="grid grid-cols-1 sm:grid-cols-2">
          {AUTOMATIONS.map((a, i) => (
            <div key={a.title} className={`flex items-start gap-4 px-6 py-4 ${i % 2 === 0 && i < AUTOMATIONS.length - 1 ? 'sm:border-r border-slate-800' : ''} border-b border-slate-800 last:border-b-0`}>
              <span className="text-xl mt-0.5 flex-shrink-0">{a.icon}</span>
              <div>
                <p className="text-sm text-white font-semibold">{a.title}</p>
                <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{a.desc}</p>
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>

      {/* ── EXECUTION HISTORY ────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-400" />
            <h2 className="text-white font-semibold">Execution History</h2>
            <span className="text-slate-500 text-xs">All actions taken by AI or approved by you</span>
          </div>
          <div className="flex items-center gap-1">
            {([
              { id: 'all'  as const, label: 'All' },
              { id: 'auto' as const, label: `Auto (${autoCount})` },
              { id: 'user' as const, label: `Approved (${userCount})` },
            ]).map(f => (
              <button
                key={f.id}
                onClick={() => {
                  setLogFilter(f.id)
                  loadActivity(f.id)
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  logFilter === f.id ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {logLoading ? (
          <div className="flex items-center justify-center h-24 text-slate-600 text-sm">Loading…</div>
        ) : activityLog.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <Shield className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No executions recorded yet</p>
            <p className="text-slate-600 text-sm mt-1">
              When you approve actions from the Agent Inbox, or AI auto-executes within your permission thresholds,
              a full audit trail appears here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {activityLog.map(entry => (
              <div key={entry.id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-800/20 transition-colors">
                <span className="text-lg flex-shrink-0 mt-0.5">{entry.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className={`text-sm font-semibold ${entry.color}`}>{entry.label}</p>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${
                      entry.executed_by === 'agent'
                        ? 'text-violet-400 bg-violet-950/40 border-violet-800/50'
                        : 'text-slate-400 bg-slate-800/60 border-slate-700'
                    }`}>
                      {entry.executed_by === 'agent'
                        ? <><Zap className="w-2 h-2" />Auto</>
                        : <><User className="w-2 h-2" />Approved</>
                      }
                    </span>
                    {entry.confidence && (
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${
                        entry.confidence >= 85
                          ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50'
                          : 'text-amber-400 bg-amber-950/40 border-amber-800/50'
                      }`}>
                        {entry.confidence}% confidence
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs">{fmtDate(entry.executed_at)}</p>
                </div>
                <span className="text-emerald-400 text-xs flex-shrink-0 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Done
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-4 text-sm pb-2">
        {[
          { href: '/dashboard',     label: 'Agent Inbox'    },
          { href: '/leads',         label: 'Leads'          },
          { href: '/content',       label: 'Content'        },
          { href: '/campaigns',     label: 'Campaigns'      },
          { href: '/audit',         label: 'Run Audit'      },
          { href: '/settings/agent',label: 'Agent Settings' },
        ].map(l => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center gap-1.5 text-slate-500 hover:text-violet-400 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
