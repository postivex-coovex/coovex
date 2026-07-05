import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: taskId } = await params
  const body = await req.json().catch(() => ({})) as { completed?: boolean }
  const newCompleted = body.completed ?? true

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = await supabase
    .from('businesses').select('id, name')
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

  await supabase
    .from('daily_tasks')
    .update({ tasks_json: tasks, completed_count: completedCount })
    .eq('id', record.id)

  // Log completed tasks to agent_memory so AI knows what the user has done
  if (newCompleted) {
    const completedTask = tasks.find(t => t.id === taskId)
    const completedTitles = tasks.filter(t => t.completed).map(t => t.title)

    const memoryValue = JSON.stringify({
      date: today,
      completed: completedTitles,
      total: tasks.length,
      last_completed: completedTask?.title ?? '',
      updated_at: new Date().toISOString(),
    })

    await supabase.from('agent_memory').upsert(
      {
        business_id: business.id,
        key: 'daily_tasks_today',
        value_text: memoryValue,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'business_id,key' }
    )
  }

  return NextResponse.json({ ok: true, completedCount, total: tasks.length })
}
