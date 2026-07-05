import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PLAN_PRICE: Record<string, number> = {
  starter:    49,
  growth:     149,
  scale:      349,
  agency:     799,
  enterprise: 0,
  free_trial: 0,
}

export default async function AdminFinancePage() {
  const supabase = await createServiceClient()

  const [{ data: subs }, { data: workspaces }] = await Promise.all([
    supabase.from('subscriptions').select('workspace_id, plan, plan_name, status, trial_ends_at, created_at, current_period_end').order('created_at', { ascending: false }),
    supabase.from('workspaces').select('id, name, plan, billing_status'),
  ])

  const allSubs = subs || []
  const wsMap = Object.fromEntries((workspaces || []).map(w => [w.id, w]))

  const paid       = allSubs.filter(s => s.status === 'active')
  const trialing   = allSubs.filter(s => s.status === 'trialing')
  const pastDue    = allSubs.filter(s => s.status === 'past_due')
  const cancelled  = allSubs.filter(s => ['canceled', 'cancelled'].includes(s.status))

  const mrr = paid.reduce((n, s) => n + (PLAN_PRICE[s.plan] ?? 0), 0)
  const arr = mrr * 12

  const trialEndsThisWeek = trialing.filter(s => {
    if (!s.trial_ends_at) return false
    const days = (new Date(s.trial_ends_at).getTime() - Date.now()) / 86400000
    return days >= 0 && days <= 7
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Finance</h1>
        <p className="text-slate-400 text-sm">Payment status, MRR, and billing overview</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'MRR',         value: `$${mrr.toLocaleString()}`,  color: 'text-emerald-400', note: 'Active paying' },
          { label: 'ARR',         value: `$${arr.toLocaleString()}`,  color: 'text-violet-400',  note: 'Annual run rate' },
          { label: 'Paid',        value: paid.length,                 color: 'text-white',        note: 'Active subscriptions' },
          { label: 'Past Due',    value: pastDue.length,              color: pastDue.length > 0 ? 'text-red-400' : 'text-slate-400', note: 'Failed payments' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-slate-600 text-xs mt-1">{s.note}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Status breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Status Breakdown</h2>
          <div className="space-y-3">
            {[
              { label: 'Active (Paid)',   count: paid.length,      color: 'bg-emerald-500' },
              { label: 'Trialing',        count: trialing.length,  color: 'bg-blue-500' },
              { label: 'Past Due',        count: pastDue.length,   color: 'bg-amber-500' },
              { label: 'Cancelled',       count: cancelled.length, color: 'bg-red-600' },
            ].map(row => {
              const pct = allSubs.length > 0 ? Math.round((row.count / allSubs.length) * 100) : 0
              return (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="text-slate-400 text-xs w-32">{row.label}</span>
                  <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${row.color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-slate-300 text-xs w-6 text-right">{row.count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Trials expiring */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-1">Trials Expiring This Week</h2>
          <p className="text-slate-600 text-xs mb-4">Convert these before they churn</p>
          {trialEndsThisWeek.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-4">None this week</p>
          ) : (
            <div className="space-y-2">
              {trialEndsThisWeek.map((s, i) => {
                const ws = wsMap[s.workspace_id]
                const daysLeft = Math.ceil((new Date(s.trial_ends_at!).getTime() - Date.now()) / 86400000)
                return (
                  <div key={i} className="flex items-center justify-between">
                    <p className="text-slate-300 text-xs">{ws?.name || s.workspace_id.slice(0, 8)}</p>
                    <span className={`text-xs font-medium ${daysLeft <= 2 ? 'text-red-400' : 'text-amber-400'}`}>
                      {daysLeft}d left
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Revenue per plan */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">MRR by Plan</h2>
          <div className="space-y-3">
            {Object.entries(PLAN_PRICE).filter(([, price]) => price > 0).map(([plan, price]) => {
              const count = paid.filter(s => s.plan === plan).length
              const revenue = count * price
              return (
                <div key={plan} className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs capitalize w-20">{plan}</span>
                  <span className="text-slate-500 text-xs">{count} users</span>
                  <span className="text-emerald-400 text-xs font-medium">${revenue.toLocaleString()}/mo</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Subscription table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold">All Subscriptions</h2>
        </div>
        {allSubs.length === 0 ? (
          <div className="py-12 text-center text-slate-600 text-sm">No subscriptions yet</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                {['Workspace', 'Plan', 'Status', 'Monthly $', 'Renews / Expires', 'Started'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allSubs.slice(0, 100).map((s, i) => {
                const ws = wsMap[s.workspace_id]
                const statusColors: Record<string, string> = {
                  active:    'text-emerald-400',
                  trialing:  'text-blue-400',
                  past_due:  'text-amber-400',
                  canceled:  'text-red-400',
                  cancelled: 'text-red-400',
                }
                return (
                  <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                    <td className="px-4 py-3 text-slate-300 text-xs">{ws?.name || s.workspace_id.slice(0, 8) + '…'}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs capitalize">{s.plan_name || s.plan || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs capitalize font-medium ${statusColors[s.status] || 'text-slate-400'}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-emerald-400 text-xs font-medium">
                      {s.status === 'active' ? `$${PLAN_PRICE[s.plan] ?? 0}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : s.trial_ends_at ? new Date(s.trial_ends_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
