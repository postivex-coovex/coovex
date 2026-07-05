import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-amber-950/60 text-amber-400',
  scheduled: 'bg-blue-950/60 text-blue-400',
  completed: 'bg-emerald-950/60 text-emerald-400',
  cancelled: 'bg-slate-800 text-slate-500',
}

export default async function AdminMeetingsPage() {
  const supabase = await createServiceClient()

  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, name, email, company, topic, preferred_time, timezone, status, scheduled_at, meeting_url, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const list = meetings || []
  const pending = list.filter(m => m.status === 'pending').length
  const scheduled = list.filter(m => m.status === 'scheduled').length
  const completed = list.filter(m => m.status === 'completed').length

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Meeting Requests</h1>
        <p className="text-slate-400 text-sm">Demo calls and onboarding meetings booked by users</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total',     value: list.length, color: 'text-white' },
          { label: 'Pending',   value: pending,     color: 'text-amber-400' },
          { label: 'Scheduled', value: scheduled,   color: 'text-blue-400' },
          { label: 'Completed', value: completed,   color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 text-center">
          <p className="text-slate-500 text-4xl mb-3">📅</p>
          <p className="text-slate-600 text-sm">No meeting requests yet</p>
          <p className="text-slate-700 text-xs mt-1">Add a &quot;Book a Meeting&quot; button in the app to collect requests here</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                {['Name', 'Company', 'Topic', 'Preferred Time', 'Status', 'Requested', 'Meeting Link'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(m => (
                <tr key={m.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-4 py-3">
                    <p className="text-white text-sm">{m.name}</p>
                    <p className="text-slate-500 text-xs">{m.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{m.company || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs max-w-32">
                    <span className="line-clamp-2">{m.topic || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    <p>{m.preferred_time || '—'}</p>
                    {m.timezone && <p className="text-slate-600">{m.timezone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[m.status] || ''}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    {m.meeting_url ? (
                      <a href={m.meeting_url} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 text-xs">
                        Join →
                      </a>
                    ) : (
                      <span className="text-slate-600 text-xs">Not set</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
