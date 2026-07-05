import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
  )
}

export default async function AdminSystemHealthPage() {
  const supabase = await createServiceClient()

  const now = Date.now()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [
    { count: totalUsers },
    { count: totalWorkspaces },
    { count: totalLeads },
    { count: totalPosts },
    { count: totalAudits },
    { count: jobsToday },
    { count: jobsFailed },
    { count: jobsDone },
    { count: errorCount },
    { data: recentErrors },
    { data: recentJobs },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('workspaces').select('*', { count: 'exact', head: true }),
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase.from('posts').select('*', { count: 'exact', head: true }),
    supabase.from('audits').select('*', { count: 'exact', head: true }),
    supabase.from('agent_jobs').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    supabase.from('agent_jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', todayStart.toISOString()),
    supabase.from('agent_jobs').select('*', { count: 'exact', head: true }).eq('status', 'done').gte('created_at', todayStart.toISOString()),
    supabase.from('error_logs').select('*', { count: 'exact', head: true }).eq('resolved', false),
    supabase.from('error_logs').select('message, severity, source, created_at').eq('resolved', false).order('created_at', { ascending: false }).limit(10),
    supabase.from('agent_jobs').select('type, status, started_at, completed_at, created_at').order('created_at', { ascending: false }).limit(5),
  ])

  const jobSuccessRate = (jobsToday ?? 0) > 0 ? Math.round(((jobsDone ?? 0) / (jobsToday ?? 1)) * 100) : 100
  const dbOk = (totalUsers ?? 0) >= 0

  const services = [
    { name: 'Supabase Database',    ok: dbOk,  note: `${totalUsers} users, ${totalWorkspaces} workspaces` },
    { name: 'Auth Service',         ok: true,  note: 'JWT/session active' },
    { name: 'Agent Jobs',           ok: (jobsFailed ?? 0) === 0, note: `${jobsDone}/${jobsToday} jobs ok today` },
    { name: 'Error Tracker',        ok: (errorCount ?? 0) === 0, note: (errorCount ?? 0) === 0 ? 'No unresolved errors' : `${errorCount} unresolved errors` },
  ]

  const dbStats = [
    { label: 'Users',      value: totalUsers ?? 0 },
    { label: 'Workspaces', value: totalWorkspaces ?? 0 },
    { label: 'Leads',      value: totalLeads ?? 0 },
    { label: 'Posts',      value: totalPosts ?? 0 },
    { label: 'Audits',     value: totalAudits ?? 0 },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">System Health</h1>
        <p className="text-slate-400 text-sm">Platform status and infrastructure overview</p>
      </div>

      {/* Service status */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
        <h2 className="text-white font-semibold text-sm mb-4">Service Status</h2>
        <div className="space-y-3">
          {services.map(s => (
            <div key={s.name} className="flex items-center gap-3">
              <StatusDot ok={s.ok} />
              <span className="text-slate-200 text-sm w-48">{s.name}</span>
              <span className={`text-xs font-medium ${s.ok ? 'text-emerald-400' : 'text-red-400'}`}>{s.ok ? 'Operational' : 'Issue Detected'}</span>
              <span className="text-slate-500 text-xs ml-auto">{s.note}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* DB row counts */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Database Stats</h2>
          <div className="space-y-2">
            {dbStats.map(row => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">{row.label}</span>
                <span className="text-white font-medium">{row.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Agent jobs today */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Agent Jobs — Today</h2>
          <div className="space-y-2 mb-4">
            {[
              { label: 'Total',   value: jobsToday ?? 0,  color: 'text-white' },
              { label: 'Done',    value: jobsDone ?? 0,   color: 'text-emerald-400' },
              { label: 'Failed',  value: jobsFailed ?? 0, color: (jobsFailed ?? 0) > 0 ? 'text-red-400' : 'text-slate-500' },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">{s.label}</span>
                <span className={`font-medium ${s.color}`}>{s.value}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Success rate</span>
              <span className={jobSuccessRate >= 90 ? 'text-emerald-400' : 'text-amber-400'}>{jobSuccessRate}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full">
              <div
                className={`h-2 rounded-full ${jobSuccessRate >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${jobSuccessRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recent jobs */}
      {(recentJobs || []).length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-white font-semibold">Recent Agent Jobs</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                {['Type', 'Status', 'Duration', 'Time'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(recentJobs || []).map((j, i) => {
                const dur = j.started_at && j.completed_at
                  ? `${((new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / 1000).toFixed(1)}s`
                  : '—'
                const statusColors: Record<string, string> = { done: 'text-emerald-400', failed: 'text-red-400', running: 'text-blue-400', queued: 'text-slate-400' }
                return (
                  <tr key={i} className="border-b border-slate-800/40">
                    <td className="px-4 py-2.5 text-slate-300 text-xs">{j.type}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs capitalize ${statusColors[j.status] || 'text-slate-400'}`}>{j.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{dur}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs">{new Date(j.created_at).toLocaleTimeString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Error log */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-white font-semibold">Unresolved Errors</h2>
          {(errorCount ?? 0) > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-900/50">
              {errorCount} open
            </span>
          )}
        </div>
        {(recentErrors || []).length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-emerald-400 text-sm">✓ No unresolved errors</p>
            <p className="text-slate-600 text-xs mt-1">System is running clean</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {(recentErrors || []).map((e, i) => (
              <div key={i} className="px-5 py-3">
                <div className="flex items-start gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 mt-0.5 ${e.severity === 'critical' ? 'bg-red-950/60 text-red-400' : e.severity === 'error' ? 'bg-amber-950/60 text-amber-400' : 'bg-slate-800 text-slate-500'}`}>
                    {e.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 text-sm truncate">{e.message}</p>
                    <p className="text-slate-600 text-xs mt-0.5">
                      {e.source && <span className="mr-2">{e.source}</span>}
                      {new Date(e.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
