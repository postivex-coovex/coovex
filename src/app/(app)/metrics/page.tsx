'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'

interface Snapshot {
  date: string
  total_leads: number
  won_leads: number
  avg_review_rating: number
  total_reviews: number
  total_signals: number
}
interface Live {
  pipeline_value: number
  won_revenue: number
  win_rate: number
  total_leads: number
  total_signals: number
  has_today: boolean
}

type Metric = 'total_leads' | 'won_leads' | 'avg_review_rating' | 'total_reviews' | 'total_signals'

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${n}`
}

const METRICS: { key: Metric; label: string; color: string; fmt: (v: number) => string; isFloat?: boolean }[] = [
  { key: 'total_leads',       label: 'Total Leads',    color: '#8b5cf6', fmt: v => String(Math.round(v)) },
  { key: 'won_leads',         label: 'Won Leads',      color: '#10b981', fmt: v => String(Math.round(v)) },
  { key: 'avg_review_rating', label: 'Avg Rating',     color: '#f59e0b', fmt: v => v.toFixed(1) + '★', isFloat: true },
  { key: 'total_reviews',     label: 'Total Reviews',  color: '#3b82f6', fmt: v => String(Math.round(v)) },
  { key: 'total_signals',     label: 'AI Signals',     color: '#ec4899', fmt: v => String(Math.round(v)) },
]

const RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

function MiniChart({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div className="w-[200px] h-12 flex items-center justify-center text-slate-700 text-xs">Not enough data</div>
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 200, h = 48
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 6) - 3
    return `${x},${y}`
  })
  const gradId = `g${color.replace('#', '')}`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M ${pts[0]} L ${pts.join(' L ')} L ${w},${h} L 0,${h} Z`} fill={`url(#${gradId})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function MetricsPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [live, setLive]           = useState<Live | null>(null)
  const [loading, setLoading]     = useState(true)
  const [recording, setRecording] = useState(false)
  const [range, setRange]         = useState(30)
  const [active, setActive]       = useState<Metric>('total_leads')

  const load = useCallback(async () => {
    const r = await fetch('/api/metrics/snapshot')
    const d = await r.json() as { snapshots?: Snapshot[]; live?: Live }
    setSnapshots(d.snapshots ?? [])
    setLive(d.live ?? null)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-record today's snapshot if not yet recorded
  useEffect(() => {
    if (!live || live.has_today) return
    fetch('/api/metrics/snapshot', { method: 'POST' })
      .then(r => r.json())
      .then((d: { snapshot?: Snapshot; live?: Live }) => {
        if (d.snapshot) setSnapshots(prev => {
          const without = prev.filter(s => s.date !== d.snapshot!.date)
          return [...without, d.snapshot!].sort((a, b) => a.date.localeCompare(b.date))
        })
        if (d.live) setLive(l => ({ ...l!, ...d.live! }))
      })
      .catch(() => null)
  }, [live])

  async function recordSnapshot() {
    setRecording(true)
    const r = await fetch('/api/metrics/snapshot', { method: 'POST' })
    const d = await r.json() as { snapshot?: Snapshot; live?: Live }
    if (d.snapshot) {
      setSnapshots(prev => {
        const without = prev.filter(s => s.date !== d.snapshot!.date)
        return [...without, d.snapshot!].sort((a, b) => a.date.localeCompare(b.date))
      })
    }
    if (d.live) setLive(l => ({ ...l!, ...d.live! }))
    setRecording(false)
  }

  const cutoff   = new Date(Date.now() - range * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const filtered = snapshots.filter(s => s.date >= cutoff)
  const latest   = filtered[filtered.length - 1]
  const previous = filtered[filtered.length - 2]

  function deltaVal(key: Metric) {
    if (!latest || !previous) return null
    return latest[key] - previous[key]
  }

  const activeCfg  = METRICS.find(m => m.key === active)!
  const chartData  = filtered.map(s => s[active] as number)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Business Metrics</h1>
          <p className="text-slate-400 text-sm mt-0.5">Track your growth KPIs over time</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            {RANGES.map(r => (
              <button key={r.days} onClick={() => setRange(r.days)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${range === r.days ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={recordSnapshot} disabled={recording}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-sm rounded-lg transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${recording ? 'animate-spin' : ''}`} />
            {recording ? 'Recording…' : 'Record Snapshot'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-500">Loading metrics…</div>
      ) : (
        <>
          {/* Live Revenue Row */}
          {live && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Open Pipeline',  value: fmtMoney(live.pipeline_value), color: 'text-violet-400', sub: 'from open deals' },
                { label: 'Won Revenue',    value: fmtMoney(live.won_revenue),    color: 'text-emerald-400', sub: 'closed won' },
                { label: 'Win Rate',       value: `${live.win_rate}%`,           color: live.win_rate >= 30 ? 'text-emerald-400' : 'text-amber-400', sub: 'based on closed deals' },
              ].map(s => (
                <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <p className="text-slate-500 text-xs mb-1">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-slate-700 text-[10px] mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {METRICS.map(m => {
              const val = latest ? m.fmt(latest[m.key]) : '—'
              const d   = deltaVal(m.key)
              return (
                <button key={m.key} onClick={() => setActive(m.key)}
                  className={`text-left bg-slate-900 border rounded-xl p-4 transition-all ${active === m.key ? 'border-violet-500/50 bg-violet-950/20' : 'border-slate-800 hover:border-slate-700'}`}>
                  <p className="text-slate-500 text-xs mb-2">{m.label}</p>
                  <p className="text-white text-xl font-bold mb-1">{val}</p>
                  <div className="flex items-center gap-1">
                    {d === null ? <Minus className="w-3.5 h-3.5 text-slate-500" />
                      : d > 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      : d < 0 ? <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                      : <Minus className="w-3.5 h-3.5 text-slate-500" />}
                    {d !== null && d !== 0 ? (
                      <span className={`text-xs ${d > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {d > 0 ? '+' : ''}{m.isFloat ? d.toFixed(1) : Math.round(d)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600">no change</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Main chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-semibold">{activeCfg.label} — last {range} days</h2>
              {filtered.length > 0 && <span className="text-slate-500 text-xs">{filtered.length} data points</span>}
            </div>

            {filtered.length < 2 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-600">
                <p>Not enough snapshots yet.</p>
                <p className="text-xs mt-1">Snapshots are recorded automatically daily. Come back tomorrow!</p>
              </div>
            ) : (() => {
              const min    = Math.min(...chartData)
              const max    = Math.max(...chartData)
              const rng    = max - min || 1
              const W = 100, H = 100
              const pts = chartData.map((v, i) => ({
                x: (i / (chartData.length - 1)) * W,
                y: H - ((v - min) / rng) * (H - 8) - 4,
                v,
                date: filtered[i].date,
              }))
              const yLabels = [0, 1, 2, 3].map(i => {
                const raw = max - (rng / 3) * i
                return activeCfg.isFloat ? raw.toFixed(1) + '★' : String(Math.round(raw))
              })
              return (
                <>
                  <div className="relative h-48">
                    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="mainGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={activeCfg.color} stopOpacity="0.25" />
                          <stop offset="100%" stopColor={activeCfg.color} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d={`M ${pts[0].x},${pts[0].y} ${pts.slice(1).map(p => `L ${p.x},${p.y}`).join(' ')} L ${W},${H} L 0,${H} Z`}
                        fill="url(#mainGrad)"
                      />
                      <polyline
                        points={pts.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none" stroke={activeCfg.color} strokeWidth="0.8"
                        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                      />
                      {pts.filter((_, i) => i % Math.max(1, Math.floor(pts.length / 6)) === 0 || i === pts.length - 1).map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r="1.2" fill={activeCfg.color} vectorEffect="non-scaling-stroke" />
                      ))}
                    </svg>
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                      {yLabels.map((l, i) => (
                        <span key={i} className="text-[10px] text-slate-600 leading-none">{l}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-[10px] text-slate-600">{filtered[0]?.date}</span>
                    <span className="text-[10px] text-slate-600">{filtered[Math.floor(filtered.length / 2)]?.date}</span>
                    <span className="text-[10px] text-slate-600">{filtered[filtered.length - 1]?.date}</span>
                  </div>
                </>
              )
            })()}
          </div>

          {/* Mini sparklines */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {METRICS.filter(m => m.key !== active).map(m => {
              const data    = filtered.map(s => s[m.key] as number)
              const latest2 = data[data.length - 1] ?? 0
              const prev2   = data[data.length - 2] ?? latest2
              const d       = latest2 - prev2
              return (
                <button key={m.key} onClick={() => setActive(m.key)}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex items-center gap-4 transition-colors text-left">
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-500 text-xs mb-1">{m.label}</p>
                    <p className="text-white text-lg font-semibold">{m.fmt(latest2)}</p>
                    <p className={`text-xs mt-0.5 ${d > 0 ? 'text-emerald-400' : d < 0 ? 'text-red-400' : 'text-slate-600'}`}>
                      {d > 0 ? '↑ ' : d < 0 ? '↓ ' : ''}{d !== 0 ? (m.isFloat ? Math.abs(d).toFixed(1) : Math.round(Math.abs(d))) : 'no change'}
                    </p>
                  </div>
                  <MiniChart data={data} color={m.color} />
                </button>
              )
            })}
          </div>

          {/* Daily snapshots table */}
          {filtered.length > 0 && (
            <div className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-white font-semibold text-sm">Daily Snapshots</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-4 py-2 text-left text-slate-500 text-xs font-medium">Date</th>
                      {METRICS.map(m => (
                        <th key={m.key} className="px-4 py-2 text-right text-slate-500 text-xs font-medium">{m.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...filtered].reverse().slice(0, 15).map((s, idx) => {
                      const prev = [...filtered].reverse()[idx + 1]
                      return (
                        <tr key={s.date} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="px-4 py-2 text-slate-400 text-xs">{s.date}</td>
                          {METRICS.map(m => {
                            const val  = s[m.key] as number
                            const pval = prev ? prev[m.key] as number : val
                            const diff = val - pval
                            return (
                              <td key={m.key} className="px-4 py-2 text-right text-xs">
                                <span className="text-white">{m.fmt(val)}</span>
                                {diff !== 0 && prev && (
                                  <span className={`ml-1 ${diff > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {diff > 0 ? '+' : ''}{m.isFloat ? diff.toFixed(1) : Math.round(diff)}
                                  </span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
