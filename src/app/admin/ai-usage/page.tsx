import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AdminAiUsagePage() {
  const supabase = await createServiceClient()

  const { data: rows } = await supabase
    .from('ai_usage_log')
    .select('workspace_id, feature, model, tokens_in, tokens_out, cost_usd, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  const workspaceIds = [...new Set((rows || []).map(r => r.workspace_id).filter(Boolean))]
  const { data: workspaces } = workspaceIds.length > 0
    ? await supabase.from('workspaces').select('id, name').in('id', workspaceIds)
    : { data: [] }
  const wsMap = Object.fromEntries((workspaces || []).map(w => [w.id, w.name]))

  const totalCost = (rows || []).reduce((s, r) => s + Number(r.cost_usd), 0)
  const totalTokens = (rows || []).reduce((s, r) => s + r.tokens_in + r.tokens_out, 0)

  // Group by feature
  const byFeature: Record<string, { calls: number; cost: number; tokens: number }> = {}
  for (const r of rows || []) {
    const f = r.feature || 'unknown'
    if (!byFeature[f]) byFeature[f] = { calls: 0, cost: 0, tokens: 0 }
    byFeature[f].calls++
    byFeature[f].cost += Number(r.cost_usd)
    byFeature[f].tokens += r.tokens_in + r.tokens_out
  }
  const featureRows = Object.entries(byFeature).sort((a, b) => b[1].cost - a[1].cost)

  // Group by workspace
  const byWs: Record<string, { name: string; calls: number; cost: number }> = {}
  for (const r of rows || []) {
    const id = r.workspace_id || 'unknown'
    if (!byWs[id]) byWs[id] = { name: wsMap[id] || id.slice(0, 8) + '…', calls: 0, cost: 0 }
    byWs[id].calls++
    byWs[id].cost += Number(r.cost_usd)
  }
  const wsRows = Object.entries(byWs).sort((a, b) => b[1].cost - a[1].cost).slice(0, 20)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">AI Usage</h1>
        <p className="text-slate-400 text-sm">Claude API cost breakdown across all workspaces</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Calls', value: (rows || []).length.toLocaleString() },
          { label: 'Total Tokens', value: totalTokens.toLocaleString() },
          { label: 'Total Cost', value: `$${totalCost.toFixed(4)}` },
          { label: 'Avg Cost / Call', value: (rows || []).length > 0 ? `$${(totalCost / (rows || []).length).toFixed(5)}` : '—' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* By feature */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-white font-semibold">Cost by Feature</h2>
          </div>
          {featureRows.length === 0 ? (
            <div className="py-10 text-center text-slate-600 text-sm">No AI usage yet</div>
          ) : featureRows.map(([feature, data]) => (
            <div key={feature} className="flex items-center gap-4 px-5 py-3 border-b border-slate-800/40">
              <div className="flex-1">
                <p className="text-slate-300 text-sm">{feature}</p>
                <p className="text-slate-600 text-xs">{data.calls} calls · {data.tokens.toLocaleString()} tokens</p>
              </div>
              <div className="text-right">
                <p className="text-emerald-400 font-medium text-sm">${data.cost.toFixed(4)}</p>
                <p className="text-slate-600 text-xs">{totalCost > 0 ? Math.round((data.cost / totalCost) * 100) : 0}%</p>
              </div>
            </div>
          ))}
        </div>

        {/* By workspace */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-white font-semibold">Cost by Workspace</h2>
          </div>
          {wsRows.length === 0 ? (
            <div className="py-10 text-center text-slate-600 text-sm">No usage yet</div>
          ) : wsRows.map(([id, data]) => (
            <div key={id} className="flex items-center gap-4 px-5 py-3 border-b border-slate-800/40">
              <div className="flex-1">
                <p className="text-slate-300 text-sm">{data.name}</p>
                <p className="text-slate-600 text-xs">{data.calls} calls</p>
              </div>
              <p className="text-emerald-400 font-medium text-sm">${data.cost.toFixed(4)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent log */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold">Recent Calls</h2>
        </div>
        {(rows || []).length === 0 ? (
          <div className="py-10 text-center text-slate-600 text-sm">No AI calls logged yet</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                {['Workspace', 'Feature', 'Model', 'Tokens In', 'Tokens Out', 'Cost', 'Date'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rows || []).slice(0, 50).map((row, i) => (
                <tr key={i} className="border-b border-slate-800/40">
                  <td className="px-4 py-2.5 text-slate-400 text-xs">{wsMap[row.workspace_id] || row.workspace_id?.slice(0, 8) + '…'}</td>
                  <td className="px-4 py-2.5 text-slate-300 text-xs">{row.feature}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{row.model}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{row.tokens_in.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{row.tokens_out.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-emerald-400 text-xs">${Number(row.cost_usd).toFixed(5)}</td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">{new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
