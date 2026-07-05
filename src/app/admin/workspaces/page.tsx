import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const PLAN_COLORS: Record<string, string> = {
  starter: 'text-slate-400',
  growth:  'text-blue-400',
  scale:   'text-violet-400',
  agency:  'text-amber-400',
}

const STATUS_COLORS: Record<string, string> = {
  trialing:  'bg-blue-950/60 text-blue-400',
  active:    'bg-emerald-950/60 text-emerald-400',
  past_due:  'bg-amber-950/60 text-amber-400',
  canceled:  'bg-red-950/60 text-red-400',
  cancelled: 'bg-red-950/60 text-red-400',
}

export default async function AdminWorkspacesPage() {
  const supabase = await createServiceClient()

  const [{ data: workspaces }, { data: subs }, { data: members }, { data: businesses }] = await Promise.all([
    supabase.from('workspaces').select('id, name, plan, billing_status, trial_ends_at, created_at').order('created_at', { ascending: false }).limit(200),
    supabase.from('subscriptions').select('workspace_id, plan, status, trial_ends_at'),
    supabase.from('workspace_members').select('workspace_id, user_id'),
    supabase.from('businesses').select('workspace_id, name, health_score'),
  ])

  const subMap = Object.fromEntries((subs || []).map(s => [s.workspace_id, s]))
  const memberCount: Record<string, number> = {}
  for (const m of members || []) {
    memberCount[m.workspace_id] = (memberCount[m.workspace_id] || 0) + 1
  }
  const bizMap: Record<string, { name: string; health_score: number }> = {}
  for (const b of businesses || []) {
    bizMap[b.workspace_id] = b
  }

  const wsList = workspaces || []

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Workspaces</h1>
          <p className="text-slate-400 text-sm">{wsList.length} total workspaces</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total',    value: wsList.length, color: 'text-white' },
          { label: 'Active',   value: (subs || []).filter(s => s.status === 'active').length,    color: 'text-emerald-400' },
          { label: 'Trialing', value: (subs || []).filter(s => s.status === 'trialing').length,  color: 'text-blue-400' },
          { label: 'Churned',  value: (subs || []).filter(s => ['canceled','cancelled'].includes(s.status)).length, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                {['Workspace', 'Business', 'Plan', 'Status', 'Members', 'Health', 'Created', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wsList.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-600">No workspaces yet</td></tr>
              ) : wsList.map(ws => {
                const sub = subMap[ws.id]
                const biz = bizMap[ws.id]
                const members_ = memberCount[ws.id] || 0
                const status = sub?.status || ws.billing_status || 'trialing'
                const plan = sub?.plan || ws.plan || 'starter'
                return (
                  <tr key={ws.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white text-sm font-medium">{ws.name || 'Unnamed'}</p>
                      <p className="text-slate-600 text-xs font-mono">{ws.id.slice(0, 8)}…</p>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{biz?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium capitalize ${PLAN_COLORS[plan] || 'text-slate-400'}`}>{plan}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[status] || 'bg-slate-800 text-slate-400'}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">{members_}</td>
                    <td className="px-4 py-3">
                      {biz?.health_score != null ? (
                        <span className={`text-sm font-medium ${biz.health_score >= 70 ? 'text-emerald-400' : biz.health_score >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                          {biz.health_score}
                        </span>
                      ) : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(ws.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/workspaces/${ws.id}`} className="text-violet-400 hover:text-violet-300 text-xs">
                        View →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
