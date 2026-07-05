import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminOverviewPage() {
  const supabase = await createServiceClient()

  const [
    { count: totalUsers },
    { count: totalWorkspaces },
    { count: totalLeads },
    { count: totalPosts },
    { count: freeToolLeads },
    { data: recentUsers },
    { data: aiUsage },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('workspaces').select('*', { count: 'exact', head: true }),
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase.from('posts').select('*', { count: 'exact', head: true }),
    supabase.from('free_tool_leads').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('id, name, email, created_at, onboarding_completed').order('created_at', { ascending: false }).limit(10),
    supabase.from('ai_usage_log').select('cost_usd, tokens_in, tokens_out').limit(1000),
  ])

  const converted = await supabase.from('free_tool_leads').select('*', { count: 'exact', head: true }).eq('converted_to_user', true)

  const totalCostUsd = (aiUsage || []).reduce((s, r) => s + Number(r.cost_usd), 0)
  const totalTokensIn = (aiUsage || []).reduce((s, r) => s + r.tokens_in, 0)
  const totalTokensOut = (aiUsage || []).reduce((s, r) => s + r.tokens_out, 0)

  const signupsThisWeek = (recentUsers || []).filter(u => {
    const d = new Date(u.created_at)
    return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000
  }).length

  const onboarded = (recentUsers || []).filter(u => u.onboarding_completed).length

  const stats = [
    { label: 'Total Users', value: totalUsers ?? 0, icon: '👥', href: '/admin/users' },
    { label: 'Workspaces', value: totalWorkspaces ?? 0, icon: '🏢', href: '/admin/users' },
    { label: 'New This Week', value: signupsThisWeek, icon: '📈', color: 'text-emerald-400' },
    { label: 'Free Tool Leads', value: freeToolLeads ?? 0, icon: '🧲', href: '/admin/free-tools' },
    { label: 'Converted Leads', value: converted.count ?? 0, icon: '💰', color: 'text-emerald-400' },
    { label: 'Total Leads (CRM)', value: totalLeads ?? 0, icon: '🎯' },
    { label: 'Posts Created', value: totalPosts ?? 0, icon: '✍️' },
    { label: 'AI Cost (USD)', value: `$${totalCostUsd.toFixed(4)}`, icon: '🧠', href: '/admin/ai-usage' },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Admin Overview</h1>
        <p className="text-slate-400 text-sm">Platform-wide metrics and health</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className={`bg-slate-900 border border-slate-800 rounded-xl p-4 ${s.href ? 'cursor-pointer hover:border-slate-700 transition-colors' : ''}`}>
            {s.href ? (
              <Link href={s.href} className="block">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-500 text-xs">{s.label}</span>
                  <span>{s.icon}</span>
                </div>
                <div className={`text-2xl font-bold ${s.color || 'text-white'}`}>{s.value}</div>
              </Link>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-500 text-xs">{s.label}</span>
                  <span>{s.icon}</span>
                </div>
                <div className={`text-2xl font-bold ${s.color || 'text-white'}`}>{s.value}</div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent signups */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <h2 className="text-white font-semibold">Recent Signups</h2>
            <Link href="/admin/users" className="text-violet-400 hover:text-violet-300 text-xs">View all →</Link>
          </div>
          <div className="divide-y divide-slate-800/60">
            {(recentUsers || []).length === 0 ? (
              <div className="py-8 text-center text-slate-600 text-sm">No users yet</div>
            ) : (recentUsers || []).map(u => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-7 h-7 rounded-full bg-violet-600/30 flex items-center justify-center text-violet-300 text-xs font-bold flex-shrink-0">
                  {(u.name || u.email || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm truncate">{u.name || u.email}</p>
                  <p className="text-slate-600 text-xs">{new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${u.onboarding_completed ? 'bg-emerald-950/60 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                  {u.onboarding_completed ? 'Active' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* AI usage summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">AI Usage Summary</h2>
            <Link href="/admin/ai-usage" className="text-violet-400 hover:text-violet-300 text-xs">Details →</Link>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Total API calls', value: (aiUsage || []).length.toLocaleString() },
              { label: 'Tokens in', value: totalTokensIn.toLocaleString() },
              { label: 'Tokens out', value: totalTokensOut.toLocaleString() },
              { label: 'Total cost', value: `$${totalCostUsd.toFixed(4)}` },
              { label: 'Cost per user', value: (totalUsers ?? 0) > 0 ? `$${(totalCostUsd / (totalUsers ?? 1)).toFixed(4)}` : '—' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">{row.label}</span>
                <span className="text-white font-medium">{row.value}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Onboarding completion rate</span>
              <span className="text-white font-medium">
                {(recentUsers || []).length > 0 ? Math.round((onboarded / (recentUsers || []).length) * 100) : 0}%
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(recentUsers || []).length > 0 ? Math.round((onboarded / (recentUsers || []).length) * 100) : 0}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
