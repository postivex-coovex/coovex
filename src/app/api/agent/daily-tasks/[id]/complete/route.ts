import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

interface Task {
  id: string
  title: string
  completed: boolean
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const service  = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: taskId } = await params
  const body = await req.json().catch(() => ({})) as { completed?: boolean }
  const newCompleted = body.completed ?? true

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = await supabase
    .from('businesses').select('id')
    .eq('workspace_id', profile?.current_workspace_id ?? '').maybeSingle()
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const today = new Date().toISOString().split('T')[0]

  const { data: record } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('business_id', business.id)
    .eq('date', today)
    .maybeSingle()

  if (!record) return NextResponse.json({ error: 'No tasks for today' }, { status: 404 })

  const tasks = (record.tasks_json as Task[]).map(t =>
    t.id === taskId ? { ...t, completed: newCompleted } : t
  )
  const completedCount = tasks.filter(t => t.completed).length
  const allDone = completedCount === tasks.length && tasks.length > 0

  await supabase
    .from('daily_tasks')
    .update({ tasks_json: tasks, completed_count: completedCount })
    .eq('id', record.id)

  // Streak tracking — only update when all tasks are completed
  let streak = 1
  if (allDone && newCompleted) {
    const { data: streakMem } = await service
      .from('agent_memory')
      .select('value_text')
      .eq('business_id', business.id)
      .eq('key', 'daily_task_streak')
      .maybeSingle()

    if (streakMem?.value_text) {
      try {
        const current = JSON.parse(streakMem.value_text) as { streak: number; last_completed_date: string }
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        streak = current.last_completed_date === yesterday ? (current.streak ?? 0) + 1 : 1
      } catch {
        streak = 1
      }
    }

    await service.from('agent_memory').upsert(
      {
        business_id: business.id,
        key: 'daily_task_streak',
        value_text: JSON.stringify({ streak, last_completed_date: today }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'business_id,key' }
    )
  }

  return NextResponse.json({ ok: true, completedCount, total: tasks.length, allDone, streak: allDone ? streak : undefined })
}
