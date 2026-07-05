import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-950/60 text-red-400 border-red-900/50',
  error:    'bg-amber-950/60 text-amber-400 border-amber-900/50',
  warn:     'bg-yellow-950/60 text-yellow-400 border-yellow-900/50',
  info:     'bg-slate-800 text-slate-400',
}

export default async function AdminErrorLogsPage() {
  const supabase = await createServiceClient()

  const [{ data: errors }, { data: resolved }] = await Promise.all([
    supabase.from('error_logs').select('*').eq('resolved', false).order('created_at', { ascending: false }).limit(100),
    supabase.from('error_logs').select('id', { count: 'exact' }).eq('resolved', true),
  ])

  const list = errors || []
  const criticalCount = list.filter(e => e.severity === 'critical').length
  const errorCount    = list.filter(e => e.severity === 'error').length
  const warnCount     = list.filter(e => e.severity === 'warn').length

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Error Logs</h1>
        <p className="text-slate-400 text-sm">Unresolved system errors and warnings</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Open',     value: list.length,             color: list.length > 0 ? 'text-red-400' : 'text-white' },
          { label: 'Critical', value: criticalCount,           color: criticalCount > 0 ? 'text-red-400' : 'text-slate-500' },
          { label: 'Errors',   value: errorCount,              color: errorCount > 0 ? 'text-amber-400' : 'text-slate-500' },
          { label: 'Resolved', value: (resolved as { id: string }[])?.length ?? 0, color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 text-center">
          <p className="text-emerald-400 text-4xl mb-3">✓</p>
          <p className="text-emerald-400 text-sm font-medium">All clear — no unresolved errors</p>
          <p className="text-slate-600 text-xs mt-1">Errors logged via the platform will appear here</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Severity', 'Message', 'Source', 'Time'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map(e => (
                  <tr key={e.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${SEVERITY_COLORS[e.severity] || SEVERITY_COLORS.info}`}>
                        {e.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-200 text-sm">{e.message}</p>
                      {e.stack && (
                        <details className="mt-1">
                          <summary className="text-slate-600 text-xs cursor-pointer hover:text-slate-400">Stack trace</summary>
                          <pre className="mt-1 text-slate-600 text-xs overflow-x-auto max-w-md whitespace-pre-wrap">{e.stack.slice(0, 500)}</pre>
                        </details>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{e.source || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
