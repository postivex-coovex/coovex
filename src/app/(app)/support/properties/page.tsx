import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Settings, Globe, Mail, MessageSquare } from 'lucide-react'

export const metadata = { title: 'Support Properties' }

export default async function PropertiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: properties } = await supabase
    .from('support_properties')
    .select(`
      id, name, domain, widget_color, smtp_host, from_email, auto_reply_enabled,
      created_at,
      support_conversations(count)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Support Properties</h1>
          <p className="text-sm text-slate-500 mt-0.5">{properties?.length ?? 0} properties</p>
        </div>
        <Link href="/support/properties/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          New Property
        </Link>
      </div>

      {!properties?.length ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <Globe className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">No properties yet</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">Create a property for each website you want to add support to</p>
          <Link href="/support/properties/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
            Create First Property
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {properties.map(p => {
            const convCount = (p.support_conversations as any)?.[0]?.count ?? 0
            return (
              <div key={p.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: p.widget_color + '20' }}>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.widget_color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</h3>
                      {p.domain && <p className="text-xs text-slate-400">{p.domain}</p>}
                    </div>
                  </div>
                  <Link href={`/support/properties/${p.id}`}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                    <Settings className="w-4 h-4" />
                  </Link>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {convCount} conversations
                  </span>
                  <span className={`flex items-center gap-1 ${p.smtp_host ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                    <Mail className="w-3.5 h-3.5" />
                    {p.smtp_host ? p.from_email || 'SMTP ready' : 'No SMTP'}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                  <Link href={`/support?property=${p.id}`}
                    className="flex-1 text-center py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors">
                    View Inbox
                  </Link>
                  <Link href={`/support/properties/${p.id}`}
                    className="flex-1 text-center py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700">
                    Settings
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
