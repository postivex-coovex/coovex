'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface Source {
  source: string
  label: string
  leads: number
  won: number
  lost: number
  active: number
  win_rate: number
  avg_score: number
  pipeline: number
  weighted: number
  won_revenue: number
  avg_deal_size: number
}

interface FunnelStep {
  stage: string
  label: string
  count: number
}

interface AttributionData {
  sources: Source[]
  funnel: FunnelStep[]
  top_source: string
  total_leads: number
  total_won: number
  total_pipeline: number
  total_won_revenue: number
  total_weighted: number
  has_real_data: boolean
  period: string
}

type View   = 'won_revenue' | 'pipeline' | 'leads' | 'win_rate'
type Period = '30d' | '90d' | '12m' | 'all'

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`
  return `$${Math.round(n)}`
}

const SOURCE_COLORS: Record<string, { bar: string; dot: string; card: string }> = {
  referral:      { bar: 'bg-emerald-500', dot: 'bg-emerald-400', card: 'bg-emerald-950/20 border-emerald-800/30' },
  linkedin:      { bar: 'bg-blue-500',    dot: 'bg-blue-400',    card: 'bg-blue-950/20 border-blue-800/30' },
  website_form:  { bar: 'bg-violet-500',  dot: 'bg-violet-400',  card: 'bg-violet-950/20 border-violet-800/30' },
  website:       { bar: 'bg-violet-500',  dot: 'bg-violet-400',  card: 'bg-violet-950/20 border-violet-800/30' },
  cold_outreach: { bar: 'bg-amber-500',   dot: 'bg-amber-400',   card: 'bg-amber-950/20 border-amber-800/30' },
  event:         { bar: 'bg-pink-500',    dot: 'bg-pink-400',    card: 'bg-pink-950/20 border-pink-800/30' },
  facebook:      { bar: 'bg-indigo-500',  dot: 'bg-indigo-400',  card: 'bg-indigo-950/20 border-indigo-800/30' },
  instagram:     { bar: 'bg-rose-500',    dot: 'bg-rose-400',    card: 'bg-rose-950/20 border-rose-800/30' },
  google_ads:    { bar: 'bg-yellow-500',  dot: 'bg-yellow-400',  card: 'bg-yellow-950/20 border-yellow-800/30' },
  email:         { bar: 'bg-cyan-500',    dot: 'bg-cyan-400',    card: 'bg-cyan-950/20 border-cyan-800/30' },
  crm_import:    { bar: 'bg-teal-500',    dot: 'bg-teal-400',    card: 'bg-teal-950/20 border-teal-800/30' },
}
const DEFAULT_COLOR = { bar: 'bg-slate-500', dot: 'bg-slate-400', card: 'bg-slate-800 border-slate-700' }

const VIEWS: { key: View; label: string }[] = [
  { key: 'won_revenue', label: 'Won Revenue' },
  { key: 'pipeline',    label: 'Pipeline $' },
  { key: 'leads',       label: 'Lead Volume' },
  { key: 'win_rate',    label: 'Win Rate' },
]
const PERIODS: { key: Period; label: string }[] = [
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '12m', label: '12 months' },
  { key: 'all', label: 'All time' },
]

export default function AttributionPage() {
  const [data, setData]     = useState<AttributionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView]     = useState<View>('won_revenue')
  const [period, setPeriod] = useState<Period>('all')

  const load = useCallback((p: Period) => {
    setLoading(true)
    fetch(`/api/attribution?period=${p}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(period) }, [period, load])

  function getVal(s: Source): number {
    if (view === 'won_revenue') return s.won_revenue
    if (view === 'pipeline')    return s.pipeline
    if (view === 'leads')       return s.leads
    return s.win_rate
  }
  function fmtVal(s: Source): string {
    if (view === 'won_revenue') return fmt(s.won_revenue)
    if (view === 'pipeline')    return fmt(s.pipeline)
    if (view === 'leads')       return `${s.leads}`
    return `${s.win_rate}%`
  }

  const sorted  = data ? [...data.sources].sort((a, b) => getVal(b) - getVal(a)) : []
  const maxVal  = sorted.length > 0 ? Math.max(getVal(sorted[0]), 1) : 1
  const topSrc  = data?.sources.find(s => s.source === data.top_source)

  const maxFunnel = data ? Math.max(...data.funnel.map(f => f.count), 1) : 1

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenue Attribution</h1>
          <p className="text-slate-400 text-sm mt-0.5">Which channels drive your best leads and revenue</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Period selector */}
          <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${period === p.key ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}>
                {p.label}
              </button>
            ))}
          </div>
          {/* View selector */}
          <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            {VIEWS.map(v => (
              <button key={v.key} onClick={() => setView(v.key)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${view === v.key ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* No data state */}
      {!loading && data && data.total_leads === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 text-center mb-6">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-white font-semibold">No leads yet</p>
          <p className="text-slate-400 text-sm mt-2 mb-5">Add leads to your pipeline to track which channels perform best.</p>
          <Link href="/leads" className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
            Go to Leads
          </Link>
        </div>
      )}

      {/* KPI cards */}
      {(loading || (data && data.total_leads > 0)) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {loading ? [1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-900 rounded-xl animate-pulse" />) : data && ([
            { label: 'Total Leads',     val: data.total_leads.toString(),       sub: `${period === 'all' ? 'all time' : `last ${period}`}`,       color: 'text-white' },
            { label: 'Won Revenue',     val: fmt(data.total_won_revenue),       sub: `${data.total_won} deals closed`,                            color: 'text-emerald-400' },
            { label: 'Open Pipeline',   val: fmt(data.total_pipeline),          sub: `${fmt(data.total_weighted)} weighted`,                       color: 'text-violet-400' },
            { label: 'Best Channel',    val: topSrc?.label ?? '—',              sub: `${topSrc?.win_rate ?? 0}% win rate`,                         color: 'text-amber-400' },
          ].map(k => (
            <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-slate-500 text-xs mb-1">{k.label}</p>
              <p className={`text-xl font-bold ${k.color} truncate`}>{k.val}</p>
              <p className="text-slate-600 text-xs mt-1">{k.sub}</p>
            </div>
          )))}
        </div>
      )}

      {data && data.total_leads > 0 && (
        <>
          {/* Data quality notice */}
          {!data.has_real_data && (
            <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-3 mb-5 text-xs text-amber-300 flex items-center gap-2">
              <span>⚠️</span>
              Pipeline values are estimated from lead scores. <Link href="/leads" className="underline ml-1">Add deal values to leads</Link> for accurate revenue attribution.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-5">

            {/* Bar chart — 3 cols */}
            <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-white font-semibold text-sm mb-5">
                {VIEWS.find(v => v.key === view)?.label} by Channel
              </h2>
              {loading ? (
                <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-9 bg-slate-800 rounded animate-pulse" />)}</div>
              ) : (
                <div className="space-y-3.5">
                  {sorted.filter(s => getVal(s) > 0).map(s => {
                    const pct   = Math.round((getVal(s) / maxVal) * 100)
                    const color = (SOURCE_COLORS[s.source] ?? DEFAULT_COLOR).bar
                    return (
                      <div key={s.source}>
                        <div className="flex justify-between items-center mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${(SOURCE_COLORS[s.source] ?? DEFAULT_COLOR).dot}`} />
                            <span className="text-slate-300 text-sm">{s.label}</span>
                            {s.source === data.top_source && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 rounded-full">Top</span>
                            )}
                          </div>
                          <span className="text-white text-sm font-medium">{fmtVal(s)}</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-2 rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                  {sorted.every(s => getVal(s) === 0) && (
                    <p className="text-slate-600 text-sm text-center py-6">No {VIEWS.find(v => v.key === view)?.label.toLowerCase()} data yet for this period.</p>
                  )}
                </div>
              )}
            </div>

            {/* Channel cards — 2 cols */}
            <div className="lg:col-span-2 space-y-2.5">
              <h2 className="text-white font-semibold text-sm">Channel Breakdown</h2>
              {loading ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-24 bg-slate-900 rounded-xl animate-pulse" />)}</div>
              ) : (
                [...data.sources].sort((a, b) => b.won_revenue - a.won_revenue || b.pipeline - a.pipeline).slice(0, 6).map(s => {
                  const c  = SOURCE_COLORS[s.source] ?? DEFAULT_COLOR
                  const closed = s.won + s.lost
                  return (
                    <div key={s.source} className={`border rounded-xl p-4 ${c.card}`}>
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                          <span className="text-white text-sm font-medium">{s.label}</span>
                        </div>
                        {s.source === data.top_source && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-900/60 text-emerald-300 rounded-full border border-emerald-800/40">Best</span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-center">
                        <div>
                          <p className="text-white text-sm font-bold">{s.leads}</p>
                          <p className="text-slate-600 text-[10px]">leads</p>
                        </div>
                        <div>
                          <p className="text-emerald-400 text-sm font-bold">{s.won}</p>
                          <p className="text-slate-600 text-[10px]">won</p>
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${s.win_rate >= 30 ? 'text-emerald-400' : s.win_rate >= 15 ? 'text-amber-400' : 'text-slate-400'}`}>
                            {closed > 0 ? `${s.win_rate}%` : '—'}
                          </p>
                          <p className="text-slate-600 text-[10px]">win rate</p>
                        </div>
                        <div>
                          <p className="text-violet-400 text-sm font-bold">{s.won_revenue > 0 ? fmt(s.won_revenue) : s.pipeline > 0 ? fmt(s.pipeline) : '—'}</p>
                          <p className="text-slate-600 text-[10px]">{s.won_revenue > 0 ? 'revenue' : 'pipeline'}</p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Real Funnel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-sm">Conversion Funnel</h2>
              <span className="text-slate-600 text-xs">{data.total_leads} total leads</span>
            </div>
            <div className="flex items-end gap-2 overflow-x-auto pb-2">
              {data.funnel.map((step, i) => {
                const pct      = Math.round((step.count / maxFunnel) * 100)
                const prev     = i > 0 ? data.funnel[i - 1].count : step.count
                const convPct  = prev > 0 && i > 0 ? Math.round((step.count / prev) * 100) : null
                const colors   = ['bg-slate-700', 'bg-blue-900/60', 'bg-violet-900/60', 'bg-violet-700/70', 'bg-violet-600/80', 'bg-emerald-700']
                return (
                  <div key={step.stage} className="flex-1 min-w-[60px] text-center">
                    {convPct !== null && (
                      <p className="text-slate-600 text-[10px] mb-1">↓ {convPct}%</p>
                    )}
                    <div className={`${colors[i]} rounded-lg flex items-center justify-center transition-all`}
                      style={{ height: `${Math.max(pct * 1.2, 32)}px` }}>
                      <p className="text-white text-sm font-bold">{step.count}</p>
                    </div>
                    <p className="text-slate-400 text-xs mt-2">{step.label}</p>
                  </div>
                )
              })}
            </div>
            {data.total_won > 0 && (
              <p className="text-slate-600 text-xs mt-4 text-center">
                Overall conversion: {Math.round((data.total_won / data.total_leads) * 100)}% of leads become wins
                {data.total_won_revenue > 0 && ` · ${fmt(data.total_won_revenue)} total won revenue`}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
