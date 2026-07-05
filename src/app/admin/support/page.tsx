import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-950/60 text-red-400 border-red-900/50',
  high:   'bg-amber-950/60 text-amber-400 border-amber-900/50',
  normal: 'bg-slate-800 text-slate-400',
  low:    'bg-slate-900 text-slate-600',
}

const STATUS_COLORS: Record<string, string> = {
  open:        'bg-blue-950/60 text-blue-400',
  in_progress: 'bg-violet-950/60 text-violet-400',
  resolved:    'bg-emerald-950/60 text-emerald-400',
  closed:      'bg-slate-800 text-slate-500',
}

export default async function AdminSupportPage() {
  const supabase = await createServiceClient()

  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('id, workspace_id, user_id, subject, body, status, priority, created_at, updated_at, replied_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const ticketList = tickets || []

  const wsIds = [...new Set(ticketList.map(t => t.workspace_id).filter(Boolean))]
  const userIds = [...new Set(ticketList.map(t => t.user_id).filter(Boolean))]

  const [{ data: workspaces }, { data: profiles }] = await Promise.all([
    wsIds.length > 0 ? supabase.from('workspaces').select('id, name').in('id', wsIds) : Promise.resolve({ data: [] }),
    userIds.length > 0 ? supabase.from('profiles').select('id, name, email').in('id', userIds) : Promise.resolve({ data: [] }),
  ])

  const wsMap = Object.fromEntries((workspaces || []).map(w => [w.id, w.name]))
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  const openCount = ticketList.filter(t => t.status === 'open').length
  const inProgressCount = ticketList.filter(t => t.status === 'in_progress').length
  const urgentCount = ticketList.filter(t => t.priority === 'urgent' || t.priority === 'high').length
  const resolvedCount = ticketList.filter(t => t.status === 'resolved' || t.status === 'closed').length

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Support</h1>
        <p className="text-slate-400 text-sm">Customer support tickets</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Open',        value: openCount,       color: 'text-blue-400' },
          { label: 'In Progress', value: inProgressCount, color: 'text-violet-400' },
          { label: 'High Priority', value: urgentCount,   color: urgentCount > 0 ? 'text-red-400' : 'text-slate-400' },
          { label: 'Resolved',    value: resolvedCount,   color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {ticketList.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 text-center">
          <p className="text-slate-600 text-sm">No support tickets yet</p>
          <p className="text-slate-700 text-xs mt-1">Tickets submitted via the in-app support form will appear here</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Priority', 'Subject', 'User', 'Workspace', 'Status', 'Submitted', ''].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ticketList.map(t => {
                  const profile = profileMap[t.user_id]
                  return (
                    <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.normal}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white text-sm">{t.subject}</p>
                        <p className="text-slate-600 text-xs line-clamp-1 mt-0.5">{t.body}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        <p>{profile?.name || '—'}</p>
                        <p className="text-slate-600">{profile?.email}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {wsMap[t.workspace_id] || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[t.status] || ''}`}>
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/support/${t.id}`} className="text-violet-400 hover:text-violet-300 text-xs">
                          Reply →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
