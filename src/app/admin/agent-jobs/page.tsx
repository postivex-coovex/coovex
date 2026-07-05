import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STATUS_META: Record<string, { color: string; dot: string }> = {
  queued:    { color: 'text-slate-400', dot: 'bg-slate-500' },
  running:   { color: 'text-blue-400', dot: 'bg-blue-400 animate-pulse' },
  done:      { color: 'text-emerald-400', dot: 'bg-emerald-400' },
  failed:    { color: 'text-red-400', dot: 'bg-red-400' },
  cancelled: { color: 'text-slate-600', dot: 'bg-slate-700' },
}

export default async function AdminAgentJobsPage() {
  const supabase = await createServiceClient()

  const { data: jobs } = await supabase
    .from('agent_jobs')
    .select('id, type, status, trigger, error, started_at, completed_at, created_at, business_id')
    .order('created_at', { ascending: false })
    .limit(100)

  // Get business names
  const bizIds = [...new Set((jobs || []).map(j => j.business_id).filter(Boolean))]
  const { data: businesses } = bizIds.length > 0
    ? await supabase.from('businesses').select('id, name').in('id', bizIds)
    : { data: [] }
  const bizMap = Object.fromEntries((businesses || []).map(b => [b.id, b.name]))

  const counts = {
    total: (jobs || []).length,
    running: (jobs || []).filter(j => j.status === 'running').length,
    done: (jobs || []).filter(j => j.status === 'done').length,
    failed: (jobs || []).filter(j => j.status === 'failed').length,
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Agent Jobs</h1>
        <p className="text-slate-400 text-sm">Background job monitor</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: counts.total, color: 'text-white' },
          { label: 'Running', value: counts.running, color: 'text-blue-400' },
          { label: 'Done', value: counts.done, color: 'text-emerald-400' },
          { label: 'Failed', value: counts.failed, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {(jobs || []).length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-slate-600 text-sm">No jobs yet — jobs run via Trigger.dev when background processing is enabled</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                {['Status', 'Type', 'Business', 'Trigger', 'Duration', 'Error', 'Created'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(jobs || []).map(job => {
                const sm = STATUS_META[job.status] || STATUS_META.queued
                const duration = job.started_at && job.completed_at
                  ? `${((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000).toFixed(1)}s`
                  : '—'
                return (
                  <tr key={job.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${sm.dot}`} />
                        <span className={`text-xs font-medium capitalize ${sm.color}`}>{job.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{job.type}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{bizMap[job.business_id] || job.business_id?.slice(0, 8) + '…'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{job.trigger}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{duration}</td>
                    <td className="px-4 py-3">
                      {job.error && <span className="text-red-400 text-xs truncate block max-w-32" title={job.error}>{job.error.slice(0, 40)}…</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
