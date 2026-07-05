import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AdminBackupsPage() {
  const supabase = await createServiceClient()

  // Get table sizes / row counts for a database overview
  const tables = [
    'profiles', 'workspaces', 'workspace_members', 'businesses',
    'leads', 'posts', 'deals', 'proposals', 'campaigns', 'email_campaigns',
    'reviews', 'audits', 'competitors', 'products',
    'agent_signals', 'agent_jobs', 'daily_tasks',
    'goals', 'marketing_plans', 'execution_plans',
    'ai_usage_log', 'free_tool_leads',
    'admin_announcements', 'support_tickets', 'meetings', 'error_logs',
  ]

  const counts: Record<string, number> = {}
  await Promise.all(
    tables.map(async (table) => {
      try {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
        counts[table] = count ?? 0
      } catch {
        counts[table] = -1
      }
    })
  )

  const totalRows = Object.values(counts).filter(c => c >= 0).reduce((s, c) => s + c, 0)
  const tablesWithData = Object.values(counts).filter(c => c > 0).length

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Backup Management</h1>
        <p className="text-slate-400 text-sm">Database overview and backup configuration</p>
      </div>

      {/* Supabase auto-backup info */}
      <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-emerald-400 text-2xl">✓</span>
          <div>
            <h2 className="text-emerald-300 font-semibold mb-1">Supabase Managed Backups</h2>
            <p className="text-emerald-400/70 text-sm">Supabase automatically backs up your database on the Pro plan and above.</p>
            <ul className="mt-2 space-y-1 text-emerald-400/60 text-xs">
              <li>• Daily backups retained for 7 days (Pro plan)</li>
              <li>• Point-in-time recovery available</li>
              <li>• Backups managed at: supabase.com → Project → Database → Backups</li>
            </ul>
          </div>
        </div>
      </div>

      {/* DB summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Tables',      value: tables.length,      color: 'text-white' },
          { label: 'Tables With Data',  value: tablesWithData,     color: 'text-blue-400' },
          { label: 'Total Rows',        value: totalRows.toLocaleString(), color: 'text-violet-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table row counts */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold">Table Overview</h2>
          <p className="text-slate-500 text-xs mt-0.5">Row counts across all tables</p>
        </div>
        <div className="grid grid-cols-2 gap-0 divide-y divide-slate-800/40">
          {tables.map((table) => {
            const count = counts[table]
            return (
              <div key={table} className="flex items-center justify-between px-5 py-2.5 border-b border-slate-800/30 even:border-l even:border-slate-800/30">
                <span className="text-slate-400 text-xs font-mono">{table}</span>
                <span className={`text-xs font-medium ${count < 0 ? 'text-slate-700' : count > 0 ? 'text-white' : 'text-slate-600'}`}>
                  {count < 0 ? 'N/A' : count.toLocaleString()}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Manual export guide */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mt-6">
        <h2 className="text-white font-semibold mb-3">Manual Export Options</h2>
        <div className="space-y-3">
          {[
            {
              title: 'Supabase Dashboard Export',
              desc: 'Go to Supabase → Project → Database → Backups → Download',
              badge: 'Full DB',
            },
            {
              title: 'Table Editor CSV Export',
              desc: 'Open any table in Supabase Table Editor → Export to CSV',
              badge: 'Per Table',
            },
            {
              title: 'pg_dump (CLI)',
              desc: 'Use pg_dump with your connection string for full PostgreSQL dump',
              badge: 'Advanced',
            },
          ].map(opt => (
            <div key={opt.title} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-xl">
              <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded flex-shrink-0 mt-0.5">{opt.badge}</span>
              <div>
                <p className="text-slate-200 text-sm font-medium">{opt.title}</p>
                <p className="text-slate-500 text-xs mt-0.5">{opt.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
