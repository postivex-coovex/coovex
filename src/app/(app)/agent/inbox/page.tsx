import { createClient } from '@/lib/supabase/server'
import { AgentInbox } from '@/components/dashboard/agent-inbox'
import { DailyTasksCard } from '@/components/dashboard/daily-tasks-card'
import { AIActivityCard } from '@/components/dashboard/ai-activity-card'
import { syncBusinessMemory } from '@/lib/agent/sync-memory'
import { runOrchestration } from '@/lib/agent/orchestration'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Agent Inbox' }

export default async function AgentInboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single()

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('workspace_id', profile?.current_workspace_id)
    .maybeSingle()

  if (!business) return null

  // Sync all business data into agent_memory so AI has full context
  await syncBusinessMemory(business.id, profile?.current_workspace_id ?? '')

  // Process any pending orchestration events
  runOrchestration(profile?.current_workspace_id ?? '').catch(() => {})

  const { data: signals } = await supabase
    .from('agent_signals')
    .select('*')
    .eq('business_id', business.id)
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: dailyTasks } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('business_id', business.id)
    .eq('date', new Date().toISOString().split('T')[0])
    .maybeSingle()

  const pendingCount = signals?.length ?? 0

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Agent Inbox</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {pendingCount > 0
              ? `${pendingCount} pending signal${pendingCount !== 1 ? 's' : ''} from your AI agent`
              : 'All caught up — no pending signals'}
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="ml-auto bg-blue-600 text-white text-sm font-bold px-3 py-1 rounded-full">
            {pendingCount}
          </span>
        )}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <AIActivityCard />
          <AgentInbox signals={signals ?? []} businessId={business.id} />
        </div>
        <div className="space-y-4">
          <DailyTasksCard tasks={dailyTasks} businessId={business.id} />
        </div>
      </div>
    </div>
  )
}
