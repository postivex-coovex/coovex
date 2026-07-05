import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PLAN_PRICE: Record<string, number> = {
  starter: 49,
  growth: 149,
  scale: 349,
  free_trial: 0,
}

function PlanBar({ plan, count, max }: { plan: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  const colors: Record<string, string> = {
    scale:      'bg-violet-500',
    growth:     'bg-blue-500',
    starter:    'bg-emerald-500',
    free_trial: 'bg-slate-600',
  }
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-right text-slate-400 text-xs capitalize">{plan.replace('_', ' ')}</div>
      <div className="flex-1 bg-slate-800 rounded-full h-2">
        <div className={`h-2 rounded-full ${colors[plan] ?? 'bg-slate-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-8 text-slate-300 text-xs text-right">{count}</div>
      <div className="w-16 text-slate-500 text-xs text-right">
        ${(count * (PLAN_PRICE[plan] ?? 0)).toLocaleString()}/mo
      </div>
    </div>
  )
}

export default async function AdminRevenuePage() {
  const supabase = await createServiceClient()

  const { data: subs } = await supabase
    .from('subscriptions')
    .select('plan, status, trial_ends_at, created_at')

  const allSubs = subs || []

  const planCounts: Record<string, number> = {}
  for (const s of allSubs) {
    const plan = s.plan || 'free_trial'
    planCounts[plan] = (planCounts[plan] || 0) + 1
  }

  const paid = allSubs.filter(s => s.plan && s.plan !== 'free_trial' && s.status === 'active')
  const trials = allSubs.filter(s => s.plan === 'free_trial' || s.status === 'trialing')
  const cancelled = allSubs.filter(s => s.status === 'canceled' || s.status === 'cancelled')

  const mrr = paid.reduce((n, s) => n + (PLAN_PRICE[s.plan] ?? 0), 0)
  const arr = mrr * 12
  const avgArpu = paid.length > 0 ? Math.round(mrr / paid.length) : 0
  const trialConvRate = allSubs.length > 0 ? Math.round((paid.length / allSubs.length) * 100) : 0

  // Signups over last 30 days
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return d.toISOString().slice(0, 10)
  })

  const signupsByDay: Record<string, number> = {}
  for (const s of allSubs) {
    const day = new Date(s.created_at).toISOString().slice(0, 10)
    signupsByDay[day] = (signupsByDay[day] || 0) + 1
  }

  const maxDay = Math.max(1, ...Object.values(signupsByDay))

  const maxPlanCount = Math.max(1, ...Object.values(planCounts))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Revenue Dashboard</h1>
        <p className="text-slate-400 text-sm mt-0.5">Subscription analytics and revenue metrics</p>
      </div>

      {/* MRR stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'MRR', value: `$${mrr.toLocaleString()}`, note: 'Monthly Recurring Revenue', color: 'text-emerald-400' },
          { label: 'ARR', value: `$${arr.toLocaleString()}`, note: 'Annual Run Rate', color: 'text-violet-400' },
          { label: 'Paid Accounts', value: paid.length, note: 'Active paying customers', color: 'text-white' },
          { label: 'ARPU', value: `$${avgArpu}`, note: 'Avg revenue per user/mo', color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-slate-600 text-xs mt-1">{s.note}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Plan breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Subscriptions by Plan</h2>
          <div className="space-y-3">
            {['scale', 'growth', 'starter', 'free_trial'].map(plan => (
              <PlanBar
                key={plan}
                plan={plan}
                count={planCounts[plan] ?? 0}
                max={maxPlanCount}
              />
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 flex gap-4 text-xs text-slate-500">
            <span>Total: {allSubs.length}</span>
            <span>Trials: {trials.length}</span>
            <span>Cancelled: {cancelled.length}</span>
            <span className="text-emerald-400">Conv: {trialConvRate}%</span>
          </div>
        </div>

        {/* Signup trend */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Signups — Last 30 Days</h2>
          <div className="flex items-end gap-0.5 h-24">
            {last30Days.map(day => {
              const count = signupsByDay[day] ?? 0
              const height = maxDay > 0 ? Math.max(2, Math.round((count / maxDay) * 100)) : 2
              return (
                <div key={day} className="flex-1 flex flex-col items-center group relative">
                  <div
                    className="w-full bg-violet-600/70 hover:bg-violet-500 rounded-sm transition-colors cursor-default"
                    style={{ height: `${height}%` }}
                    title={`${day}: ${count}`}
                  />
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-slate-600 text-xs">{last30Days[0]?.slice(5)}</span>
            <span className="text-slate-600 text-xs">{last30Days[29]?.slice(5)}</span>
          </div>
        </div>
      </div>

      {/* Revenue milestones */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-white font-semibold text-sm mb-4">Revenue Milestones</h2>
        <div className="space-y-3">
          {[
            { label: 'First $1K MRR',   target: 1000,  achieved: mrr >= 1000 },
            { label: 'First $5K MRR',   target: 5000,  achieved: mrr >= 5000 },
            { label: 'First $10K MRR',  target: 10000, achieved: mrr >= 10000 },
            { label: '$100K ARR',        target: 100000, achieved: arr >= 100000, isArr: true },
          ].map(m => {
            const current = m.isArr ? arr : mrr
            const pct = Math.min(100, Math.round((current / m.target) * 100))
            return (
              <div key={m.label} className="flex items-center gap-3">
                <span className="text-sm">{m.achieved ? '✅' : '⬜'}</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300 text-xs">{m.label}</span>
                    <span className="text-slate-500 text-xs">{pct}%</span>
                  </div>
                  <div className="bg-slate-800 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${m.achieved ? 'bg-emerald-500' : 'bg-violet-600'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
