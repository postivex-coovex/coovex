'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface ClosingDeal {
  id: string
  value: number
  currency: string
  close_date: string
  probability: number
  lead?: { name: string; company?: string }
}

interface StageRow {
  stage: string
  count: number
  value: number
  prob: number
}

interface HistoricalMonth {
  month: string
  revenue: number
  label: string
}

interface ForecastData {
  months: string[]
  conservative: number[]
  realistic: number[]
  optimistic: number[]
  historical: HistoricalMonth[]
  pipeline_value: number
  weighted_value: number
  avg_deal_size: number
  avg_close_days: number
  win_rate: number
  stale_count: number
  stage_breakdown: StageRow[]
  closing_this_month: ClosingDeal[]
  has_real_data: boolean
  insight: string
  actions: string[]
}

type Scenario = 'conservative' | 'realistic' | 'optimistic'

const SCENARIOS: { key: Scenario; label: string; color: string; track: string; text: string }[] = [
  { key: 'conservative', label: 'Conservative', color: '#64748b', track: 'bg-slate-500', text: 'text-slate-400' },
  { key: 'realistic',    label: 'Realistic',    color: '#3b82f6', track: 'bg-blue-500', text: 'text-blue-400' },
  { key: 'optimistic',   label: 'Optimistic',   color: '#2563eb', track: 'bg-blue-600', text: 'text-blue-400' },
]

const STAGE_LABELS: Record<string, string> = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified',
  proposal: 'Proposal', negotiation: 'Negotiation',
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`
  return `$${n.toFixed(0)}`
}

function ComboChart({ historical, projected, months, color }: {
  historical: HistoricalMonth[]
  projected: number[]
  months: string[]
  color: string
}) {
  const allVals = [...historical.map(h => h.revenue), ...projected]
  const max = Math.max(...allVals, 1)
  const W = 600; const H = 140
  const pad = { t: 12, r: 12, b: 28, l: 44 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b

  const hBars = historical.length
  const pBars = projected.length
  const totalBars = hBars + pBars
  const barW = (innerW / totalBars) * 0.6
  const gap  = (innerW / totalBars)

  function barX(i: number) { return pad.l + gap * i + (gap - barW) / 2 }
  function barY(v: number) { return pad.t + innerH - (v / max) * innerH }
  function barH(v: number) { return (v / max) * innerH }

  // Line through projected bar tops
  const projPoints = projected.map((v, i) => ({
    x: barX(hBars + i) + barW / 2,
    y: barY(v),
  }))
  const linePath = projPoints.length > 1
    ? `M ${projPoints[0].x} ${projPoints[0].y} ` +
      projPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    : ''

  // Y-axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: pad.t + innerH * (1 - f),
    label: fmt(max * f),
  }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      {/* Grid */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={t.y} y2={t.y} stroke="#1e293b" strokeWidth={1} />
          <text x={pad.l - 4} y={t.y + 4} textAnchor="end" fill="#475569" fontSize={9}>{t.label}</text>
        </g>
      ))}

      {/* Historical bars — slate */}
      {historical.map((h, i) => (
        <g key={i}>
          <rect
            x={barX(i)} y={barY(h.revenue)}
            width={barW} height={Math.max(barH(h.revenue), h.revenue > 0 ? 2 : 0)}
            fill={h.revenue > 0 ? '#334155' : '#1e293b'} rx={2}
          />
          <text x={barX(i) + barW / 2} y={H - 8} textAnchor="middle" fill="#475569" fontSize={9}>{h.label}</text>
        </g>
      ))}

      {/* Projected bars — colored */}
      {projected.map((v, i) => (
        <g key={i}>
          <rect
            x={barX(hBars + i)} y={barY(v)}
            width={barW} height={Math.max(barH(v), 2)}
            fill={color} fillOpacity={0.25} rx={2}
          />
          <text x={barX(hBars + i) + barW / 2} y={H - 8} textAnchor="middle" fill="#64748b" fontSize={9}>{months[i]}</text>
        </g>
      ))}

      {/* Projected line */}
      {linePath && (
        <>
          <path d={linePath} stroke={color} strokeWidth={1.5} fill="none" strokeDasharray="4 2" />
          {projPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
          ))}
        </>
      )}

      {/* Divider between historical / projected */}
      {hBars > 0 && pBars > 0 && (
        <line
          x1={barX(hBars) - gap * 0.1} x2={barX(hBars) - gap * 0.1}
          y1={pad.t} y2={pad.t + innerH}
          stroke="#334155" strokeWidth={1} strokeDasharray="2 2"
        />
      )}
    </svg>
  )
}

export default function ForecastPage() {
  const [data, setData]         = useState<ForecastData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [scenario, setScenario] = useState<Scenario>('realistic')
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg]   = useState<string | null>(null)
  const [goal, setGoal]         = useState<number>(0)
  const [editGoal, setEditGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const goalRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('forecast_monthly_goal')
    if (saved) setGoal(Number(saved))
    fetch('/api/forecast')
      .then(r => r.json())
      .then(d => setData(d.forecast))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (editGoal && goalRef.current) goalRef.current.focus()
  }, [editGoal])

  function saveGoal() {
    const n = parseFloat(goalInput.replace(/[^0-9.]/g, ''))
    if (!isNaN(n) && n > 0) {
      setGoal(n)
      localStorage.setItem('forecast_monthly_goal', String(n))
    }
    setEditGoal(false)
  }

  async function runScan() {
    setScanning(true); setScanMsg(null)
    try {
      const res = await fetch('/api/forecast', { method: 'POST' })
      const d   = await res.json()
      const tot = (d.alerts ?? []).reduce((n: number, a: { count: number }) => n + a.count, 0)
      setScanMsg(tot > 0
        ? `Found ${tot} issue${tot > 1 ? 's' : ''} → ${d.alerts.length} alert${d.alerts.length > 1 ? 's' : ''} added to Agent Inbox`
        : 'Pipeline looks healthy — no issues detected')
    } finally { setScanning(false) }
  }

  const sc = SCENARIOS.find(s => s.key === scenario)!
  const projTotal = data ? data[scenario].reduce((a, b) => a + b, 0) : 0
  const thisMonthProj = data ? data[scenario][0] ?? 0 : 0
  const goalPct = goal > 0 ? Math.min(100, Math.round((thisMonthProj / goal) * 100)) : 0

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Forecast</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {data?.has_real_data
              ? 'Based on real deals in your pipeline'
              : 'Estimated from lead stages — add deal values for accuracy'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!data?.has_real_data && (
            <Link href="/leads" className="text-xs text-slate-500 border border-slate-700/40 bg-slate-950/20 px-3 py-1.5 rounded-lg hover:bg-slate-950/40 transition-colors">
              + Add deal values
            </Link>
          )}
          <button
            onClick={runScan} disabled={scanning}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {scanning
              ? <><span className="w-3 h-3 border-2 border-slate-400 border-t-white rounded-full animate-spin inline-block" /> Scanning…</>
              : '🔍 Scan Pipeline'}
          </button>
        </div>
      </div>

      {scanMsg && (
        <div className={`mb-4 p-3 rounded-xl border text-sm flex items-center gap-2 ${
          scanMsg.includes('issue') ? 'bg-slate-950/20 border-slate-700/30 text-slate-400' : 'bg-slate-950/20 border-slate-700/30 text-blue-300'
        }`}>
          {scanMsg.includes('issue') ? '⚠️' : '✅'} {scanMsg}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-slate-900 rounded-xl animate-pulse" />)}
        </div>
      ) : !data ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 text-center">
          <div className="text-5xl mb-4">📈</div>
          <p className="text-white font-semibold text-lg">No pipeline data yet</p>
          <p className="text-slate-400 text-sm mt-2 mb-6">Add leads and move them through stages to generate your forecast.</p>
          <Link href="/leads" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
            Go to Leads
          </Link>
        </div>
      ) : (
        <>
          {/* Monthly Goal */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-sm">Monthly Revenue Goal</span>
                {goal > 0 && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    goalPct >= 100 ? 'bg-slate-950/40 text-blue-400' :
                    goalPct >= 60  ? 'bg-slate-950/40 text-blue-400' :
                    'bg-slate-950/40 text-slate-500'
                  }`}>
                    {goalPct}% on track
                  </span>
                )}
              </div>
              {editGoal ? (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-sm">$</span>
                  <input
                    ref={goalRef}
                    value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveGoal()}
                    className="w-28 bg-slate-800 border border-slate-700 text-white text-sm px-2 py-1 rounded-lg outline-none"
                    placeholder="e.g. 10000"
                  />
                  <button onClick={saveGoal} className="text-xs text-blue-400 hover:text-blue-300 font-medium">Save</button>
                  <button onClick={() => setEditGoal(false)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => { setGoalInput(goal > 0 ? String(goal) : ''); setEditGoal(true) }}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {goal > 0 ? '✎ Edit goal' : '+ Set a goal'}
                </button>
              )}
            </div>
            {goal > 0 ? (
              <>
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>Projected this month ({sc.label}): <span className={sc.text}>{fmt(thisMonthProj)}</span></span>
                  <span>Goal: {fmt(goal)}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${goalPct >= 100 ? 'bg-blue-600' : goalPct >= 60 ? 'bg-blue-500' : 'bg-slate-600'}`}
                    style={{ width: `${goalPct}%` }}
                  />
                </div>
                <p className="text-slate-600 text-xs mt-1.5">
                  {goalPct >= 100
                    ? `You're on track to exceed your goal by ${fmt(thisMonthProj - goal)}`
                    : `${fmt(goal - thisMonthProj)} more needed to hit goal`}
                </p>
              </>
            ) : (
              <p className="text-slate-600 text-sm">Set a monthly target to track your progress.</p>
            )}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Pipeline Value',    val: fmt(data.pipeline_value), sub: 'Total open deals',        color: 'text-white' },
              { label: 'Weighted Pipeline', val: fmt(data.weighted_value), sub: 'Probability-adjusted',    color: 'text-blue-400' },
              { label: 'Win Rate',          val: `${Math.round(data.win_rate * 100)}%`, sub: 'Historical', color: 'text-blue-400' },
              { label: 'Avg Close Time',    val: `${data.avg_close_days}d`,             sub: 'Lead to close', color: 'text-white' },
            ].map(k => (
              <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <p className="text-slate-500 text-xs mb-1">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.val}</p>
                <p className="text-slate-600 text-xs mt-1">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Stale warning */}
          {data.stale_count > 0 && (
            <div className="bg-slate-950/20 border border-slate-700/30 rounded-xl p-3 mb-5 flex items-center gap-3">
              <span className="text-lg">⚠️</span>
              <div className="flex-1">
                <p className="text-slate-400 text-sm font-medium">{data.stale_count} deal{data.stale_count > 1 ? 's' : ''} stalled 14+ days</p>
                <p className="text-slate-500/70 text-xs">Deals that stop moving rarely close. Follow up now or mark lost.</p>
              </div>
              <Link href="/leads" className="text-xs text-slate-500 border border-slate-700/60 px-3 py-1.5 rounded-lg hover:bg-slate-950/40 transition-colors whitespace-nowrap">
                View leads →
              </Link>
            </div>
          )}

          {/* Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-5">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-white font-semibold">Revenue Trend</h2>
                <p className="text-slate-500 text-xs mt-0.5">
                  <span className="text-slate-400">Past 6 months</span>
                  <span className="mx-2 text-slate-700">│</span>
                  <span style={{ color: sc.color }}>Next 6 projected ({sc.label}): {fmt(projTotal)}</span>
                </p>
              </div>
              <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
                {SCENARIOS.map(s => (
                  <button
                    key={s.key}
                    onClick={() => setScenario(s.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      scenario === s.key ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <ComboChart
              historical={data.historical}
              projected={data[scenario]}
              months={data.months}
              color={sc.color}
            />
            <div className="flex items-center gap-6 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-slate-700 rounded-sm" />
                <span className="text-slate-500 text-xs">Actual revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: sc.color, opacity: 0.4 }} />
                <span className="text-slate-500 text-xs">Projected</span>
              </div>
            </div>
          </div>

          {/* Two-column: Stage breakdown + Closing this month */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">

            {/* Stage Breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-white font-semibold text-sm mb-4">Pipeline by Stage</h2>
              {data.stage_breakdown.length === 0 ? (
                <p className="text-slate-600 text-sm">No open leads in pipeline.</p>
              ) : (
                <div className="space-y-3">
                  {data.stage_breakdown.map(s => {
                    const pct = Math.round(s.prob * 100)
                    const weighted = Math.round(s.value * s.prob)
                    const barColor =
                      s.stage === 'negotiation' ? '#3b82f6' :
                      s.stage === 'proposal'    ? '#6366f1' :
                      s.stage === 'qualified'   ? '#3b82f6' :
                      s.stage === 'contacted'   ? '#0ea5e9' : '#64748b'
                    return (
                      <div key={s.stage}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-300 text-xs">{STAGE_LABELS[s.stage]}</span>
                            <span className="text-slate-600 text-xs">{s.count} lead{s.count > 1 ? 's' : ''}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-300 text-xs font-medium">{fmt(s.value)}</span>
                            <span className="text-slate-600 text-xs ml-1">({pct}%)</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                        </div>
                        <p className="text-slate-700 text-xs mt-0.5">Weighted: {fmt(weighted)}</p>
                      </div>
                    )
                  })}
                  <div className="border-t border-slate-800 pt-3 flex justify-between">
                    <span className="text-slate-500 text-xs">Total weighted</span>
                    <span className="text-blue-400 text-xs font-semibold">{fmt(data.weighted_value)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Closing This Month */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-white font-semibold text-sm mb-1">Closing This Month</h2>
              <p className="text-slate-600 text-xs mb-4">
                {data.closing_this_month.length > 0
                  ? `${data.closing_this_month.length} deal${data.closing_this_month.length > 1 ? 's' : ''} with close date this month`
                  : 'No deals have a close date set for this month'}
              </p>
              {data.closing_this_month.length > 0 ? (
                <div className="space-y-2">
                  {data.closing_this_month.map(d => (
                    <div key={d.id} className="flex items-center gap-3 p-2.5 bg-slate-800/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">
                          {d.lead?.name ?? 'Unknown'}{d.lead?.company ? ` — ${d.lead.company}` : ''}
                        </p>
                        <p className="text-slate-500 text-xs">
                          Close: {new Date(d.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {' · '}{d.probability}% likely
                        </p>
                      </div>
                      <span className="text-blue-400 text-sm font-semibold shrink-0">{fmt(d.value)}</span>
                    </div>
                  ))}
                  <div className="text-right pt-1">
                    <span className="text-slate-500 text-xs">Expected close value: </span>
                    <span className="text-blue-400 text-xs font-medium">
                      {fmt(data.closing_this_month.reduce((s, d) => s + d.value * (d.probability / 100), 0))}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-slate-700 text-xs">Add close dates to your open deals to track upcoming closures.</p>
                  <Link href="/leads" className="text-blue-500 text-xs mt-2 inline-block hover:text-blue-400">
                    Go to Leads →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* AI Insight + Actions */}
          <div className="bg-slate-950/20 border border-slate-700/30 rounded-2xl p-5 mb-5">
            <p className="text-blue-400 text-xs font-semibold mb-2">🤖 AI Pipeline Analysis</p>
            <p className="text-slate-200 text-sm leading-relaxed mb-4">{data.insight}</p>
            {data.actions.length > 0 && (
              <>
                <p className="text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wider">Actions to take today</p>
                <ul className="space-y-2">
                  {data.actions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5 shrink-0">→</span>
                      <span className="text-slate-300 text-sm">{a}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Scenario Comparison */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-white font-semibold text-sm mb-4">6-Month Scenario Comparison</h2>
            <div className="space-y-3">
              {SCENARIOS.map(s => {
                const total   = data[s.key].reduce((a, b) => a + b, 0)
                const maxTot  = data.optimistic.reduce((a, b) => a + b, 0)
                const pct     = Math.round((total / maxTot) * 100)
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <span className={`text-xs w-24 shrink-0 ${s.text}`}>{s.label}</span>
                    <div className="flex-1 bg-slate-800 rounded-full h-2">
                      <div className={`h-2 rounded-full ${s.track}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-slate-300 text-xs w-16 text-right font-medium shrink-0">{fmt(total)}</span>
                  </div>
                )
              })}
            </div>
            {!data.has_real_data && (
              <p className="text-slate-700 text-xs mt-4 border-t border-slate-800 pt-3">
                * Projections are estimated from lead stages. Add deal values in your pipeline for more accurate forecasting.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
