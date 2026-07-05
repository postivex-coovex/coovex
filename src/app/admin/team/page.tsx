import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const ROLE_COLORS: Record<string, string> = {
  owner:   'bg-amber-950/60 text-amber-400',
  admin:   'bg-violet-950/60 text-violet-400',
  manager: 'bg-blue-950/60 text-blue-400',
  creator: 'bg-emerald-950/60 text-emerald-400',
  sales:   'bg-cyan-950/60 text-cyan-400',
  viewer:  'bg-slate-800 text-slate-400',
}

export default async function AdminTeamPage() {
  const supabase = await createServiceClient()

  const [{ data: members }, { data: recentActivity }] = await Promise.all([
    supabase
      .from('workspace_members')
      .select('user_id, workspace_id, role, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('ai_usage_log')
      .select('workspace_id, created_at')
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .limit(1000),
  ])

  const memberList = members || []

  const userIds = [...new Set(memberList.map(m => m.user_id))]
  const wsIds = [...new Set(memberList.map(m => m.workspace_id))]

  const [{ data: profiles }, { data: workspaces }] = await Promise.all([
    userIds.length > 0 ? supabase.from('profiles').select('id, name, email, created_at').in('id', userIds) : Promise.resolve({ data: [] }),
    wsIds.length > 0 ? supabase.from('workspaces').select('id, name, plan').in('id', wsIds) : Promise.resolve({ data: [] }),
  ])

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
  const wsMap = Object.fromEntries((workspaces || []).map(w => [w.id, w]))

  // Which workspaces had activity this week
  const activeWsIds = new Set((recentActivity || []).map(r => r.workspace_id))

  // Role distribution
  const roleCounts: Record<string, number> = {}
  for (const m of memberList) {
    roleCounts[m.role] = (roleCounts[m.role] || 0) + 1
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Team & Access</h1>
        <p className="text-slate-400 text-sm">All workspace members and their roles across the platform</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Members',     value: memberList.length,            color: 'text-white' },
          { label: 'Unique Users',      value: userIds.length,               color: 'text-violet-400' },
          { label: 'Active Workspaces', value: activeWsIds.size,             color: 'text-emerald-400' },
          { label: 'Workspaces',        value: wsIds.length,                 color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Role distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Role Distribution</h2>
          <div className="space-y-2">
            {Object.entries(roleCounts).sort((a, b) => b[1] - a[1]).map(([role, count]) => (
              <div key={role} className="flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${ROLE_COLORS[role] || 'bg-slate-800 text-slate-400'}`}>
                  {role}
                </span>
                <span className="text-slate-300 text-sm font-medium">{count}</span>
              </div>
            ))}
            {Object.keys(roleCounts).length === 0 && (
              <p className="text-slate-600 text-sm text-center py-4">No members yet</p>
            )}
          </div>
        </div>

        {/* Active workspaces this week */}
        <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Active Workspaces (7 days)</h2>
          {activeWsIds.size === 0 ? (
            <p className="text-slate-600 text-sm text-center py-4">No activity in the last 7 days</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {[...activeWsIds].slice(0, 12).map(wsId => {
                const ws = wsMap[wsId]
                return (
                  <div key={wsId} className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span className="text-slate-300 text-xs truncate">{ws?.name || wsId.slice(0, 8) + '…'}</span>
                    {ws?.plan && <span className="text-slate-600 text-xs capitalize ml-auto">{ws.plan}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Members table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold">All Members</h2>
        </div>
        {memberList.length === 0 ? (
          <div className="py-12 text-center text-slate-600 text-sm">No workspace members yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  {['User', 'Workspace', 'Role', 'Active', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {memberList.slice(0, 100).map((m, i) => {
                  const p = profileMap[m.user_id]
                  const ws = wsMap[m.workspace_id]
                  const isActive = activeWsIds.has(m.workspace_id)
                  return (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-300 text-xs font-bold flex-shrink-0">
                            {(p?.name || p?.email || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white text-xs font-medium">{p?.name || '—'}</p>
                            <p className="text-slate-500 text-xs">{p?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{ws?.name || m.workspace_id.slice(0, 8) + '…'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${ROLE_COLORS[m.role] || 'bg-slate-800 text-slate-400'}`}>
                          {m.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${isActive ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {isActive ? '● Active' : '○ Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/users/${m.user_id}`} className="text-violet-400 hover:text-violet-300 text-xs">View →</Link>
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
