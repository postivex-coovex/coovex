'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { RefreshCw, Filter } from 'lucide-react'

interface FunnelStage {
  stage: string
  count: number
  conversion_rate: number
  weighted_value: number
}

const STAGE_META: Record<string, { label: string; color: string; bg: string }> = {
  new:           { label: 'New',           color: 'text-slate-300',   bg: 'bg-slate-600' },
  contacted:     { label: 'Contacted',     color: 'text-blue-300',    bg: 'bg-blue-600' },
  qualified:     { label: 'Qualified',     color: 'text-blue-300',  bg: 'bg-blue-600' },
  proposal_sent: { label: 'Proposal Sent', color: 'text-slate-400',   bg: 'bg-slate-600' },
  won:           { label: 'Won',           color: 'text-blue-300', bg: 'bg-blue-600' },
  lost:          { label: 'Lost',          color: 'text-red-300',     bg: 'bg-red-600' },
}

function fmtMoney(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n}`
}

export default function LeadFunnelPage() {
  const [stages, setStages] = useState<FunnelStage[]>([])
  const [summary, setSummary] = useState<{ total_leads: number; won_leads: number; overall_win_rate: number; pipeline_value: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEmpty, setIsEmpty] = useState(false)

  function load() {
    setLoading(true)
    fetch('/api/leads/funnel')
      .then(r => r.json())
      .then(d => {
        setStages(d.stages ?? [])
        setSummary({ total_leads: d.total_leads, won_leads: d.won_leads, overall_win_rate: d.overall_win_rate, pipeline_value: d.pipeline_value })
        setIsEmpty(!!d.empty)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const activeStages = stages.filter(s => s.stage !== 'lost')
  const maxCount = Math.max(...activeStages.map(s => s.count), 1)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Filter className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Lead Funnel</h1>
          </div>
          <p className="text-slate-400 text-base">Stage-by-stage pipeline conversion analysis</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/leads" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">← Leads</Link>
          <button onClick={load} disabled={loading} className="text-slate-400 hover:text-white disabled:opacity-50 transition-colors">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Leads',  value: String(summary.total_leads),          color: 'text-slate-300' },
            { label: 'Won',          value: String(summary.won_leads),             color: 'text-blue-400' },
            { label: 'Win Rate',     value: `${summary.overall_win_rate}%`,        color: 'text-blue-400' },
            { label: 'Pipeline',     value: fmtMoney(summary.pipeline_value),      color: 'text-blue-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
              <p className={`text-4xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-slate-500 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-600 text-base">Loading…</div>
      ) : isEmpty ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center py-20 text-slate-600">
          <Filter className="w-10 h-10 mb-4 opacity-20" />
          <p className="text-base font-medium">No leads yet</p>
          <p className="text-sm mt-1">Add your first lead to see funnel analytics here.</p>
          <Link href="/leads" className="mt-5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
            Go to Leads →
          </Link>
        </div>
      ) : (
        <>
          {/* Funnel visualization */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-5">
            <h2 className="text-white font-semibold text-lg mb-6">Funnel Visualization</h2>
            <div className="space-y-3">
              {activeStages.map((s, i) => {
                const meta = STAGE_META[s.stage] ?? { label: s.stage, color: 'text-slate-300', bg: 'bg-slate-600' }
                const pct = Math.round((s.count / maxCount) * 100)
                const prevCount = i > 0 ? activeStages[i - 1].count : s.count
                const dropRate = prevCount > 0 && i > 0 ? Math.round(((prevCount - s.count) / prevCount) * 100) : null

                return (
                  <div key={s.stage}>
                    {dropRate !== null && dropRate > 0 && (
                      <div className="flex items-center gap-2 py-1 pl-3">
                        <div className="w-px h-4 bg-slate-700 ml-3" />
                        <span className="text-slate-600 text-sm">↓ {dropRate}% drop-off</span>
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <div className="flex-1 relative h-14 bg-slate-800 rounded-xl overflow-hidden">
                        <div
                          className={`absolute left-0 top-0 h-full ${meta.bg} opacity-70 transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-between px-4">
                          <span className={`text-sm font-semibold ${meta.color} z-10`}>{meta.label}</span>
                          <span className="text-white text-base font-bold z-10">{s.count}</span>
                        </div>
                      </div>
                      <div className="w-36 text-right flex-shrink-0">
                        <p className="text-slate-400 text-sm">{s.conversion_rate}% close rate</p>
                        <p className="text-slate-600 text-sm">{fmtMoney(s.weighted_value)} weighted</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Lost breakdown */}
          {(() => {
            const lost = stages.find(s => s.stage === 'lost')
            if (!lost || lost.count === 0) return null
            return (
              <div className="bg-red-950/10 border border-red-900/30 rounded-2xl p-6 mb-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-400 text-lg font-semibold">Lost Leads</p>
                    <p className="text-slate-500 text-sm mt-0.5">Leads that did not convert</p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-400 text-4xl font-bold">{lost.count}</p>
                    <Link href="/leads?stage=lost" className="text-slate-600 text-sm hover:text-slate-400 transition-colors">View all →</Link>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Stage breakdown table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <h2 className="text-white font-semibold text-lg">Stage Breakdown</h2>
            </div>
            <div className="divide-y divide-slate-800/50">
              <div className="flex items-center gap-4 px-6 py-3 text-xs text-slate-600 uppercase tracking-wider">
                <span className="flex-1">Stage</span>
                <span className="w-20 text-right">Leads</span>
                <span className="w-24 text-right">Close Rate</span>
                <span className="w-28 text-right">Weighted $</span>
              </div>
              {stages.map(s => {
                const meta = STAGE_META[s.stage] ?? { label: s.stage, color: 'text-slate-300' }
                return (
                  <div key={s.stage} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-800/20 transition-colors">
                    <span className={`flex-1 text-base font-medium ${meta.color}`}>{meta.label}</span>
                    <span className="w-20 text-right text-slate-300 text-base font-bold">{s.count}</span>
                    <span className="w-24 text-right text-slate-500 text-sm">{s.conversion_rate}%</span>
                    <span className="w-28 text-right text-slate-400 text-sm">{fmtMoney(s.weighted_value)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
