import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const supabase = await createServiceClient()

  const { data: users } = await supabase
    .from('profiles')
    .select('id, name, email, created_at, onboarding_completed, current_workspace_id, language, role, referral_source')
    .order('created_at', { ascending: false })
    .limit(500)

  const workspaceIds = (users || []).map(u => u.current_workspace_id).filter(Boolean)
  const { data: workspaces } = workspaceIds.length > 0
    ? await supabase.from('workspaces').select('id, name, plan, billing_status, trial_ends_at').in('id', workspaceIds)
    : { data: [] }

  const wsMap = Object.fromEntries((workspaces || []).map(w => [w.id, w]))

  const allUsers = users || []
  const completedOnboarding = allUsers.filter(u => u.onboarding_completed).length

  // Aggregate role + referral counts
  const roleCounts: Record<string, number> = {}
  const referralCounts: Record<string, number> = {}
  for (const u of allUsers) {
    const r = u.role ?? 'Not specified'
    const s = u.referral_source ?? 'Not specified'
    roleCounts[r] = (roleCounts[r] ?? 0) + 1
    referralCounts[s] = (referralCounts[s] ?? 0) + 1
  }
  const sortedRoles = Object.entries(roleCounts).sort((a, b) => b[1] - a[1])
  const sortedReferrals = Object.entries(referralCounts).sort((a, b) => b[1] - a[1])

  const PLAN_COLORS: Record<string, string> = {
    starter: 'text-slate-400', growth: 'text-blue-400',
    scale: 'text-violet-400', agency: 'text-amber-400',
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-slate-400 text-sm">{allUsers.length} total accounts</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-white">{allUsers.length}</p>
            <p className="text-slate-500 text-xs">Total</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">{completedOnboarding}</p>
            <p className="text-slate-500 text-xs">Active</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-violet-400">
              {allUsers.length > 0 ? Math.round((completedOnboarding / allUsers.length) * 100) : 0}%
            </p>
            <p className="text-slate-500 text-xs">Completion</p>
          </div>
        </div>
      </div>

      {/* Role + Referral breakdown */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">User Roles</h2>
          <div className="space-y-2.5">
            {sortedRoles.map(([role, count]) => (
              <div key={role}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-slate-300 text-xs truncate">{role}</p>
                  <p className="text-slate-400 text-xs font-medium ml-2">{count}</p>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full"
                    style={{ width: `${Math.round((count / allUsers.length) * 100)}%` }} />
                </div>
              </div>
            ))}
            {sortedRoles.length === 0 && <p className="text-slate-600 text-xs">No data yet</p>}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">How They Found Us</h2>
          <div className="space-y-2.5">
            {sortedReferrals.map(([source, count]) => (
              <div key={source}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-slate-300 text-xs truncate">{source}</p>
                  <p className="text-slate-400 text-xs font-medium ml-2">{count}</p>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.round((count / allUsers.length) * 100)}%` }} />
                </div>
              </div>
            ))}
            {sortedReferrals.length === 0 && <p className="text-slate-600 text-xs">No data yet</p>}
          </div>
        </div>
      </div>

      {/* Full user table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold text-sm">All Users ({allUsers.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                {['User', 'Role', 'Found Via', 'Workspace / Plan', 'Status', 'Joined', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allUsers.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-600">No users yet</td></tr>
              ) : allUsers.map(u => {
                const ws = u.current_workspace_id ? wsMap[u.current_workspace_id] : null
                const trialEnds = ws?.trial_ends_at ? new Date(ws.trial_ends_at) : null
                const isTrialing = ws?.billing_status === 'trialing'
                const trialExpired = trialEnds && trialEnds < new Date()
                return (
                  <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 text-xs font-bold flex-shrink-0">
                          {(u.name || u.email || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{u.name || '—'}</p>
                          <p className="text-slate-500 text-xs">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.role
                        ? <span className="text-xs px-2 py-0.5 bg-violet-950/40 text-violet-300 border border-violet-800/30 rounded-full">{u.role}</span>
                        : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{u.referral_source ?? '—'}</td>
                    <td className="px-4 py-3">
                      {ws ? (
                        <div>
                          <p className="text-slate-300 text-sm">{ws.name}</p>
                          <span className={`text-xs font-medium ${PLAN_COLORS[ws.plan] || 'text-slate-400'}`}>
                            {ws.plan}{isTrialing && !trialExpired ? ' · trial' : ''}{trialExpired ? ' · expired' : ''}
                          </span>
                        </div>
                      ) : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        u.onboarding_completed ? 'bg-emerald-950/60 text-emerald-400' : 'bg-amber-950/60 text-amber-400'
                      }`}>
                        {u.onboarding_completed ? 'Active' : 'Onboarding'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${u.id}`} className="text-violet-400 hover:text-violet-300 text-xs transition-colors">
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
