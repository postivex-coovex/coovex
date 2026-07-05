import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AdminFreeToolsPage() {
  const supabase = await createServiceClient()

  const { data: leads } = await supabase
    .from('free_tool_leads')
    .select('email, name, tool_used, ip_address, converted_to_user, user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  const total = (leads || []).length
  const converted = (leads || []).filter(l => l.converted_to_user).length
  const convRate = total > 0 ? Math.round((converted / total) * 100) : 0

  // Group by tool
  const byTool: Record<string, { total: number; converted: number }> = {}
  for (const l of leads || []) {
    const t = l.tool_used || 'unknown'
    if (!byTool[t]) byTool[t] = { total: 0, converted: 0 }
    byTool[t].total++
    if (l.converted_to_user) byTool[t].converted++
  }
  const toolRows = Object.entries(byTool).sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Free Tools</h1>
        <p className="text-slate-400 text-sm">Lead capture from free AI tools</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Leads', value: total, color: 'text-white' },
          { label: 'Converted', value: converted, color: 'text-emerald-400' },
          { label: 'Not Converted', value: total - converted, color: 'text-slate-400' },
          { label: 'Conv. Rate', value: `${convRate}%`, color: convRate > 10 ? 'text-emerald-400' : 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* By tool */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-white font-semibold">By Tool</h2>
          </div>
          {toolRows.length === 0 ? (
            <div className="py-10 text-center text-slate-600 text-sm">No leads yet</div>
          ) : toolRows.map(([tool, data]) => (
            <div key={tool} className="flex items-center gap-4 px-5 py-3 border-b border-slate-800/40">
              <div className="flex-1">
                <p className="text-slate-300 text-sm capitalize">{tool.replace(/_/g, ' ')}</p>
                <div className="mt-1 h-1 bg-slate-800 rounded-full w-full">
                  <div className="h-1 bg-violet-500 rounded-full" style={{ width: `${total > 0 ? Math.round((data.total / total) * 100) : 0}%` }} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-medium text-sm">{data.total}</p>
                <p className="text-emerald-400 text-xs">{data.converted} conv.</p>
              </div>
            </div>
          ))}
        </div>

        {/* Conversion funnel */}
        <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-white font-semibold mb-4">Conversion Funnel</h2>
          <div className="space-y-4">
            {[
              { label: 'Tool used (email captured)', value: total, pct: 100 },
              { label: 'Signed up (converted to user)', value: converted, pct: convRate },
              { label: 'Not yet converted', value: total - converted, pct: total > 0 ? Math.round(((total - converted) / total) * 100) : 0 },
            ].map(step => (
              <div key={step.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">{step.label}</span>
                  <span className="text-white font-medium">{step.value} ({step.pct}%)</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full">
                  <div className="h-2 bg-violet-500 rounded-full transition-all" style={{ width: `${step.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Leads table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold">All Leads</h2>
        </div>
        {(leads || []).length === 0 ? (
          <div className="py-12 text-center text-slate-600 text-sm">No free tool leads yet</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                {['Email', 'Name', 'Tool Used', 'IP', 'Converted', 'Date'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(leads || []).map((l, i) => (
                <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                  <td className="px-4 py-3 text-slate-300 text-xs">{l.email}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{l.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs capitalize">{(l.tool_used || '—').replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{l.ip_address || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${l.converted_to_user ? 'bg-emerald-950/60 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                      {l.converted_to_user ? '✓ Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
