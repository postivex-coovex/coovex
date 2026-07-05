import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PROVIDER_META: Record<string, { label: string; icon: string }> = {
  google_pagespeed: { label: 'Google PageSpeed', icon: '🚀' },
  openai:           { label: 'OpenAI',            icon: '🟢' },
  stripe:           { label: 'Stripe',            icon: '💳' },
  resend:           { label: 'Resend',            icon: '📧' },
  claude:           { label: 'Anthropic Claude',  icon: '🧠' },
  supabase:         { label: 'Supabase',          icon: '🟡' },
  google_business:  { label: 'Google Business',   icon: '📍' },
  linkedin:         { label: 'LinkedIn API',      icon: '💼' },
  facebook:         { label: 'Facebook API',      icon: '📘' },
}

export default async function AdminApiMonitorPage() {
  const supabase = await createServiceClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [{ data: apiLogs }, { data: aiLogs }] = await Promise.all([
    supabase.from('api_usage_log').select('provider, endpoint, status_code, response_ms, cost_usd, created_at').order('created_at', { ascending: false }).limit(500),
    supabase.from('ai_usage_log').select('feature, model, tokens_in, tokens_out, cost_usd, created_at').order('created_at', { ascending: false }).limit(200),
  ])

  const list = apiLogs || []
  const aiList = aiLogs || []

  // Group external API by provider
  const byProvider: Record<string, { calls: number; errors: number; avgMs: number; totalMs: number; cost: number }> = {}
  for (const r of list) {
    const p = r.provider || 'unknown'
    if (!byProvider[p]) byProvider[p] = { calls: 0, errors: 0, avgMs: 0, totalMs: 0, cost: 0 }
    byProvider[p].calls++
    if (r.status_code && r.status_code >= 400) byProvider[p].errors++
    if (r.response_ms) byProvider[p].totalMs += r.response_ms
    byProvider[p].cost += Number(r.cost_usd || 0)
  }
  for (const p of Object.values(byProvider)) {
    p.avgMs = p.calls > 0 ? Math.round(p.totalMs / p.calls) : 0
  }

  // AI usage totals
  const aiTotalCost = aiList.reduce((s, r) => s + Number(r.cost_usd), 0)
  const aiTotalCalls = aiList.length
  const aiTodayCalls = aiList.filter(r => new Date(r.created_at) >= todayStart).length
  const aiTodayCost = aiList.filter(r => new Date(r.created_at) >= todayStart).reduce((s, r) => s + Number(r.cost_usd), 0)

  const totalExternalCalls = list.length
  const totalErrors = list.filter(r => r.status_code && r.status_code >= 400).length
  const errorRate = totalExternalCalls > 0 ? Math.round((totalErrors / totalExternalCalls) * 100) : 0

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">API Monitor</h1>
        <p className="text-slate-400 text-sm">External API usage, response times, and error rates</p>
      </div>

      {/* AI usage summary */}
      <div className="bg-violet-950/20 border border-violet-800/40 rounded-2xl p-5 mb-6">
        <h2 className="text-violet-300 font-semibold text-sm mb-4">🧠 Claude / AI Usage</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Calls',    value: aiTotalCalls.toLocaleString() },
            { label: 'Today Calls',    value: aiTodayCalls.toLocaleString() },
            { label: 'Total Cost',     value: `$${aiTotalCost.toFixed(4)}` },
            { label: 'Today Cost',     value: `$${aiTodayCost.toFixed(4)}` },
          ].map(s => (
            <div key={s.label}>
              <p className="text-violet-400/60 text-xs mb-1">{s.label}</p>
              <p className="text-violet-200 font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* External APIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'External Calls',  value: totalExternalCalls, color: 'text-white' },
          { label: 'Errors',          value: totalErrors, color: totalErrors > 0 ? 'text-red-400' : 'text-slate-500' },
          { label: 'Error Rate',      value: `${errorRate}%`, color: errorRate > 5 ? 'text-red-400' : 'text-emerald-400' },
          { label: 'Providers Active', value: Object.keys(byProvider).length, color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Per provider breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold">External API Breakdown</h2>
        </div>
        {Object.keys(byProvider).length === 0 ? (
          <div className="py-12 text-center text-slate-600 text-sm">
            <p>No external API calls logged yet</p>
            <p className="text-xs mt-1">External API calls are logged in the `api_usage_log` table</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                {['Provider', 'Calls', 'Errors', 'Avg Response', 'Cost'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(byProvider).sort((a, b) => b[1].calls - a[1].calls).map(([provider, data]) => {
                const meta = PROVIDER_META[provider]
                return (
                  <tr key={provider} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{meta?.icon || '🔌'}</span>
                        <span className="text-slate-300 text-sm">{meta?.label || provider}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-sm">{data.calls.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${data.errors > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {data.errors > 0 ? data.errors : '✓ 0'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">{data.avgMs > 0 ? `${data.avgMs}ms` : '—'}</td>
                    <td className="px-4 py-3 text-emerald-400 text-sm">{data.cost > 0 ? `$${data.cost.toFixed(4)}` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent AI calls */}
      {aiList.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-white font-semibold">Recent AI Calls</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                {['Feature', 'Model', 'Tokens In', 'Tokens Out', 'Cost', 'Time'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {aiList.slice(0, 20).map((r, i) => (
                <tr key={i} className="border-b border-slate-800/40">
                  <td className="px-4 py-2.5 text-slate-300 text-xs">{r.feature}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{r.model}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{r.tokens_in.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{r.tokens_out.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-emerald-400 text-xs">${Number(r.cost_usd).toFixed(5)}</td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
