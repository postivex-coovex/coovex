import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface IntegrationRow {
  workspace_id: string
  provider: string
  status: string
  created_at: string
}

const INTEGRATION_META: Record<string, { label: string; icon: string; category: string }> = {
  linkedin:       { label: 'LinkedIn',        icon: '💼', category: 'Social' },
  facebook:       { label: 'Facebook',        icon: '📘', category: 'Social' },
  instagram:      { label: 'Instagram',       icon: '📸', category: 'Social' },
  google_business:{ label: 'Google Business', icon: '📍', category: 'Reviews' },
  stripe:         { label: 'Stripe',          icon: '💳', category: 'Billing' },
  hubspot:        { label: 'HubSpot',         icon: '🟠', category: 'CRM' },
  mailchimp:      { label: 'Mailchimp',       icon: '🐒', category: 'Email' },
  resend:         { label: 'Resend',          icon: '📧', category: 'Email' },
}

const CATEGORIES = ['Social', 'Reviews', 'Billing', 'CRM', 'Email']

export default async function AdminIntegrationsPage() {
  const supabase = await createServiceClient()

  const [{ data: integrations }, { data: workspaces }] = await Promise.all([
    supabase.from('integrations').select('workspace_id, provider, status, created_at'),
    supabase.from('workspaces').select('id, name').limit(50),
  ])

  const intList = (integrations as IntegrationRow[]) || []
  const wsList = workspaces || []

  // Group by provider
  const byProvider: Record<string, { total: number; connected: number }> = {}
  for (const intg of intList) {
    if (!byProvider[intg.provider]) byProvider[intg.provider] = { total: 0, connected: 0 }
    byProvider[intg.provider].total++
    if (intg.status === 'connected') byProvider[intg.provider].connected++
  }

  // Group by workspace
  const byWorkspace: Record<string, string[]> = {}
  for (const intg of intList) {
    if (intg.status === 'connected') {
      if (!byWorkspace[intg.workspace_id]) byWorkspace[intg.workspace_id] = []
      byWorkspace[intg.workspace_id].push(intg.provider)
    }
  }

  const totalConnected = intList.filter(i => i.status === 'connected').length
  const wsWithAny = Object.keys(byWorkspace).length
  const avgPerWs = wsList.length > 0 ? (totalConnected / wsList.length).toFixed(1) : '0'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Integration Health Matrix</h1>
        <p className="text-slate-400 text-sm mt-0.5">Which workspaces have which integrations connected</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Connected', value: totalConnected, color: 'text-emerald-400' },
          { label: 'Workspaces with Integrations', value: wsWithAny, color: 'text-white' },
          { label: 'Avg per Workspace', value: avgPerWs, color: 'text-violet-400' },
          { label: 'Integration Types', value: Object.keys(byProvider).length, color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Integration adoption by provider */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <h2 className="text-white font-semibold text-sm mb-4">Adoption by Integration</h2>
        {CATEGORIES.map(cat => {
          const providers = Object.entries(INTEGRATION_META)
            .filter(([, m]) => m.category === cat)
            .map(([key, m]) => ({ key, ...m, ...(byProvider[key] ?? { total: 0, connected: 0 }) }))
          if (providers.every(p => p.total === 0)) return null
          return (
            <div key={cat} className="mb-4">
              <p className="text-slate-500 text-xs font-medium mb-2">{cat}</p>
              <div className="space-y-2">
                {providers.map(p => (
                  <div key={p.key} className="flex items-center gap-3">
                    <span className="w-5">{p.icon}</span>
                    <span className="text-slate-400 text-xs w-32">{p.label}</span>
                    <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-emerald-500"
                        style={{ width: wsList.length > 0 ? `${Math.round((p.connected / wsList.length) * 100)}%` : '0%' }}
                      />
                    </div>
                    <span className="text-slate-500 text-xs w-16 text-right">
                      {p.connected}/{wsList.length} ws
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {Object.keys(byProvider).length === 0 && (
          <p className="text-slate-600 text-sm text-center py-4">No integrations connected yet</p>
        )}
      </div>

      {/* Workspace matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-white font-semibold text-sm mb-4">Per-Workspace Matrix</h2>
        {wsList.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-4">No workspaces found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left text-slate-500 font-medium pb-2 pr-4">Workspace</th>
                  {Object.entries(INTEGRATION_META).map(([key, m]) => (
                    <th key={key} className="text-center text-slate-500 font-medium pb-2 px-2" title={m.label}>
                      {m.icon}
                    </th>
                  ))}
                  <th className="text-right text-slate-500 font-medium pb-2 pl-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {wsList.map(ws => {
                  const connected = byWorkspace[ws.id] || []
                  return (
                    <tr key={ws.id} className="border-t border-slate-800">
                      <td className="py-2 pr-4">
                        <span className="text-slate-300">{ws.name || 'Unnamed'}</span>
                      </td>
                      {Object.keys(INTEGRATION_META).map(provider => (
                        <td key={provider} className="text-center py-2 px-2">
                          {connected.includes(provider) ? (
                            <span className="text-emerald-400">✓</span>
                          ) : (
                            <span className="text-slate-800">–</span>
                          )}
                        </td>
                      ))}
                      <td className="text-right py-2 pl-4">
                        <span className={`font-medium ${connected.length > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {connected.length}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
