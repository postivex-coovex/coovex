'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, DollarSign, TrendingUp, Target, Users, Link2 } from 'lucide-react'
import Link from 'next/link'

interface ConnectedIntegration {
  type: string
  status: string
  connected_at: string | null
  has_api_key: boolean
  last_sync: string | null
  sync_count: number | null
}

interface RevenueData {
  won_revenue: number
  pipeline_value: number
  forecast: number
  won_count: number
  active_count: number
  total_leads: number
  by_month: { month: string; revenue: number; label: string }[]
  by_source: Record<string, number>
  by_stage: Record<string, { count: number; value: number; weighted: number }>
  recent_won: {
    id: string
    value: number
    currency: string
    close_date: string | null
    crm_id: string | null
    lead: { name: string; company?: string; source?: string } | null
  }[]
  connected_integrations: ConnectedIntegration[]
  has_real_data: boolean
}

const STAGE_ORDER = ['new', 'contacted', 'qualified', 'proposal', 'negotiation']
const STAGE_LABELS: Record<string, string> = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified', proposal: 'Proposal', negotiation: 'Negotiation',
}
const STAGE_COLORS: Record<string, string> = {
  new: '#475569', contacted: '#3b82f6', qualified: '#8b5cf6', proposal: '#f59e0b', negotiation: '#10b981',
}
const CRM_LABELS: Record<string, { name: string; icon: string }> = {
  hubspot:   { name: 'HubSpot',   icon: '🔗' },
  pipedrive: { name: 'Pipedrive', icon: '🎯' },
  salesforce:{ name: 'Salesforce',icon: '☁️' },
  zoho:      { name: 'Zoho CRM',  icon: '🔵' },
  quickbooks:{ name: 'QuickBooks',icon: '💰' },
  xero:      { name: 'Xero',      icon: '💹' },
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`
  return `$${Math.round(n).toLocaleString()}`
}

function RevenueChart({ data }: { data: RevenueData['by_month'] }) {
  const max = Math.max(...data.map(d => d.revenue), 1)
  const W = 600; const H = 120
  const pad = { t: 10, r: 8, b: 24, l: 44 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b

  if (data.length === 0) return (
    <div className="h-32 flex items-center justify-center text-slate-600 text-sm">
      No won deals yet. Close your first deal to see revenue history.
    </div>
  )

  const bW  = (innerW / data.length) * 0.55
  const gap = innerW / data.length
  const ticks = [0, 0.5, 1].map(f => ({ y: pad.t + innerH * (1 - f), label: fmt(max * f) }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 130 }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={t.y} y2={t.y} stroke="#1e293b" strokeWidth={1} />
          <text x={pad.l - 4} y={t.y + 4} textAnchor="end" fill="#475569" fontSize={9}>{t.label}</text>
        </g>
      ))}
      {data.map((m, i) => {
        const h = (m.revenue / max) * innerH
        const x = pad.l + gap * i + (gap - bW) / 2
        const y = pad.t + innerH - h
        return (
          <g key={i}>
            <rect x={x} y={y} width={bW} height={Math.max(h, m.revenue > 0 ? 2 : 0)}
              fill={m.revenue > 0 ? '#10b981' : '#1e293b'} rx={2} fillOpacity={0.8} />
            <text x={x + bW / 2} y={H - 6} textAnchor="middle" fill="#475569" fontSize={9}>{m.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function RevenuePage() {
  const [data, setData]       = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<{ type: string; msg: string } | null>(null)
  const [recalcing, setRecalcing] = useState(false)
  const [healthResult, setHealthResult] = useState<{ score: number; breakdown: Record<string, { score: number; label: string; rating?: string; posts?: number; won?: number; lost?: number }> } | null>(null)

  function load() {
    setLoading(true)
    fetch('/api/revenue')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function syncCRM(crmType: string) {
    setSyncing(crmType)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/integrations/crm/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crm_type: crmType }),
      })
      const d = await res.json() as { ok?: boolean; synced?: number; error?: string }
      if (d.ok) {
        setSyncMsg({ type: 'success', msg: `Synced ${d.synced} deals from ${CRM_LABELS[crmType]?.name ?? crmType}` })
        load()
      } else {
        setSyncMsg({ type: 'error', msg: d.error ?? 'Sync failed' })
      }
    } finally {
      setSyncing(null)
    }
  }

  async function recalcHealth() {
    setRecalcing(true)
    const res = await fetch('/api/health-score/recalculate', { method: 'POST' })
    const d = await res.json()
    setHealthResult(d)
    setRecalcing(false)
  }

  if (loading) return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-28 bg-slate-900 rounded-2xl animate-pulse" />)}
    </div>
  )

  if (!data) return null

  const hasConnectedCRM = data.connected_integrations.some(i =>
    ['hubspot', 'salesforce', 'pipedrive', 'zoho'].includes(i.type) && i.has_api_key
  )

  const maxStageVal = Math.max(...Object.values(data.by_stage).map(s => s.value), 1)
  const sourceTotal = Object.values(data.by_source).reduce((s, v) => s + v, 0)

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenue & Pipeline</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {data.has_real_data ? 'Real deal data from your pipeline' : 'No deal data yet — connect a CRM or add deals manually'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {hasConnectedCRM && (
            data.connected_integrations
              .filter(i => ['hubspot', 'pipedrive'].includes(i.type) && i.has_api_key)
              .map(i => (
                <button
                  key={i.type}
                  onClick={() => syncCRM(i.type)}
                  disabled={syncing === i.type}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${syncing === i.type ? 'animate-spin' : ''}`} />
                  {syncing === i.type ? 'Syncing…' : `Sync ${CRM_LABELS[i.type]?.name ?? i.type}`}
                </button>
              ))
          )}
          <Link href="/leads" className="text-sm text-violet-400 hover:text-violet-300 transition-colors border border-slate-800 px-3 py-2 rounded-lg">
            View Leads →
          </Link>
        </div>
      </div>

      {/* Sync result */}
      {syncMsg && (
        <div className={`mb-4 p-3 rounded-xl border text-sm flex items-center gap-2 ${
          syncMsg.type === 'success'
            ? 'bg-emerald-950/20 border-emerald-800/30 text-emerald-300'
            : 'bg-red-950/20 border-red-800/30 text-red-300'
        }`}>
          {syncMsg.type === 'success' ? '✅' : '❌'} {syncMsg.msg}
        </div>
      )}

      {/* CRM connect banner — shown when no data and no CRM connected */}
      {!data.has_real_data && !hasConnectedCRM && (
        <div className="bg-violet-950/20 border border-violet-800/30 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl shrink-0">🔌</div>
            <div className="flex-1">
              <p className="text-white font-semibold">Connect your CRM or Accounting app</p>
              <p className="text-slate-400 text-sm mt-1 mb-3">
                Connect HubSpot, Pipedrive, QuickBooks, or Xero to automatically pull your real revenue data. The AI will analyze your actual deals, invoices, and pipeline to give you actionable insights.
              </p>
              <div className="flex flex-wrap gap-3">
                {[
                  { icon: '🔗', label: 'HubSpot', desc: 'Deals & contacts' },
                  { icon: '🎯', label: 'Pipedrive', desc: 'Pipeline & deals' },
                  { icon: '💰', label: 'QuickBooks', desc: 'Invoices & revenue' },
                  { icon: '💹', label: 'Xero', desc: 'Cash flow & invoices' },
                ].map(app => (
                  <div key={app.label} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 flex items-center gap-2">
                    <span>{app.icon}</span>
                    <div>
                      <p className="text-white text-xs font-medium">{app.label}</p>
                      <p className="text-slate-600 text-[10px]">{app.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href="/settings/integrations"
                className="inline-flex items-center gap-2 mt-4 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <Link2 className="w-4 h-4" />
                Go to Integrations
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Won Revenue',      val: fmt(data.won_revenue),    sub: `${data.won_count} deals closed`,    icon: DollarSign, color: 'text-emerald-400' },
          { label: 'Pipeline Value',   val: fmt(data.pipeline_value), sub: `${data.active_count} open deals`,  icon: Target,     color: 'text-violet-400' },
          { label: 'Weighted Forecast',val: fmt(data.forecast),       sub: 'probability-adjusted',             icon: TrendingUp, color: 'text-blue-400' },
          { label: 'Total Leads',      val: data.total_leads.toString(), sub: 'all stages',                    icon: Users,      color: 'text-white' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <p className="text-slate-500 text-xs">{kpi.label}</p>
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.val}</p>
            <p className="text-slate-600 text-xs mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">

        {/* Monthly won revenue */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Won Revenue by Month</h2>
          <RevenueChart data={data.by_month} />
        </div>

        {/* Pipeline by stage */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Pipeline by Stage</h2>
          {Object.keys(data.by_stage).length === 0 ? (
            <div className="h-32 flex items-center justify-center text-slate-600 text-sm">No open leads in pipeline.</div>
          ) : (
            <div className="space-y-3">
              {STAGE_ORDER.filter(s => data.by_stage[s]).map(stage => {
                const s   = data.by_stage[stage]
                const pct = Math.round((s.value / maxStageVal) * 100)
                return (
                  <div key={stage}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-400 text-xs">{STAGE_LABELS[stage]}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 text-xs">{s.count}</span>
                        <span className="text-white text-xs font-medium">{fmt(s.value)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: STAGE_COLORS[stage] }} />
                    </div>
                  </div>
                )
              })}
              <div className="border-t border-slate-800 pt-2 flex justify-between">
                <span className="text-slate-600 text-xs">Weighted</span>
                <span className="text-violet-400 text-xs font-medium">{fmt(data.forecast)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent won deals + revenue by source */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">

        {/* Recent won deals */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Recent Won Deals</h2>
          {data.recent_won.length === 0 ? (
            <div className="py-6 text-center text-slate-600 text-sm">No won deals yet.</div>
          ) : (
            <div className="space-y-2">
              {data.recent_won.map(d => (
                <div key={d.id} className="flex items-center gap-3 py-2 border-b border-slate-800/60 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">
                      {d.lead?.name ?? 'Unknown'}
                      {d.lead?.company && d.lead.company !== d.lead.name && (
                        <span className="text-slate-500 font-normal"> — {d.lead.company}</span>
                      )}
                    </p>
                    <p className="text-slate-600 text-[10px]">
                      {d.close_date ? new Date(d.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : 'No date'}
                      {d.crm_id && <span className="ml-1 text-slate-700">· via CRM</span>}
                    </p>
                  </div>
                  <span className="text-emerald-400 text-sm font-semibold shrink-0">{fmt(d.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Revenue by source */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Won Revenue by Source</h2>
          {sourceTotal === 0 ? (
            <div className="py-6 text-center text-slate-600 text-sm">No won deals yet.</div>
          ) : (
            <div className="space-y-3">
              {Object.entries(data.by_source)
                .sort((a, b) => b[1] - a[1])
                .map(([source, rev]) => {
                  const pct = Math.round((rev / sourceTotal) * 100)
                  return (
                    <div key={source}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-400 text-xs capitalize">{source.replace(/_/g, ' ')}</span>
                        <span className="text-white text-xs">{fmt(rev)} <span className="text-slate-600">({pct}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-600 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>

      {/* Connected data sources + health score */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Data sources */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-sm">Data Sources</h2>
            <Link href="/settings/integrations" className="text-xs text-violet-400 hover:text-violet-300">
              Manage →
            </Link>
          </div>
          {data.connected_integrations.length === 0 ? (
            <div className="space-y-2">
              <p className="text-slate-600 text-sm">No CRM or accounting apps connected.</p>
              <p className="text-slate-700 text-xs">Connect HubSpot, Pipedrive, QuickBooks, or Xero to sync real revenue data automatically.</p>
              <Link
                href="/settings/integrations"
                className="inline-flex items-center gap-1.5 mt-2 text-xs text-violet-400 border border-violet-800/40 px-3 py-1.5 rounded-lg hover:bg-violet-950/20 transition-colors"
              >
                <Link2 className="w-3 h-3" /> Connect a CRM
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {data.connected_integrations.map(i => {
                const meta = CRM_LABELS[i.type]
                const syncable = ['hubspot', 'pipedrive'].includes(i.type)
                return (
                  <div key={i.type} className="flex items-center gap-3 p-2.5 bg-slate-800/40 rounded-xl">
                    <span className="text-lg">{meta?.icon ?? '🔌'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium">{meta?.name ?? i.type}</p>
                      <p className="text-slate-600 text-[10px]">
                        {i.last_sync
                          ? `Last sync: ${new Date(i.last_sync).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${i.sync_count ?? 0} deals`
                          : i.has_api_key ? 'API key set — not yet synced' : 'Not connected'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${i.has_api_key ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                      {syncable && i.has_api_key && (
                        <button
                          onClick={() => syncCRM(i.type)}
                          disabled={syncing === i.type}
                          className="text-[10px] text-slate-400 hover:text-white disabled:opacity-50 border border-slate-700 px-2 py-0.5 rounded-md transition-colors"
                        >
                          {syncing === i.type ? '…' : 'Sync'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              <div className="mt-2 p-3 bg-slate-800/30 rounded-xl border border-slate-800">
                <p className="text-slate-500 text-xs">
                  <span className="font-medium text-slate-400">Manual input:</span> Add deals directly from your lead pages to track revenue without a CRM.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Health score */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-sm">Health Score Breakdown</h2>
            <button
              onClick={recalcHealth} disabled={recalcing}
              className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${recalcing ? 'animate-spin' : ''}`} />
              {recalcing ? 'Recalculating…' : 'Recalculate'}
            </button>
          </div>

          {!healthResult ? (
            <div className="space-y-3">
              {[
                { label: 'Website Audit Score', desc: 'From your last audit' },
                { label: 'Review Rating',        desc: 'Avg star rating × 20' },
                { label: 'Content Activity',     desc: 'Posts last 30 days (12 = 100%)' },
                { label: 'Lead Win Rate',        desc: 'Won / (Won + Lost) deals' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0">
                  <div>
                    <p className="text-slate-300 text-xs">{item.label}</p>
                    <p className="text-slate-600 text-[10px]">{item.desc}</p>
                  </div>
                  <span className="text-slate-700 text-xs">25%</span>
                </div>
              ))}
              <p className="text-slate-700 text-xs mt-2">Click "Recalculate" to compute from live data.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-3xl font-bold text-white">{healthResult.score}</div>
                <div>
                  <p className="text-emerald-400 text-xs font-medium">Health Score Updated</p>
                  <p className="text-slate-500 text-xs">average of 4 components</p>
                </div>
              </div>
              {Object.entries(healthResult.breakdown).map(([key, b]) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-400 text-xs">{b.label}</span>
                    <span className="text-white text-xs font-medium">{b.score}/100</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${b.score >= 70 ? 'bg-emerald-500' : b.score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${b.score}%` }}
                    />
                  </div>
                  {b.rating && <p className="text-slate-700 text-[10px] mt-0.5">avg {b.rating}★</p>}
                  {b.posts !== undefined && <p className="text-slate-700 text-[10px] mt-0.5">{b.posts} posts last 30 days</p>}
                  {b.won !== undefined && <p className="text-slate-700 text-[10px] mt-0.5">{b.won} won / {(b.won ?? 0) + (b.lost ?? 0)} closed</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
