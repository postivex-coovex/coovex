import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  try {
    const supabase = await createClient()
    const service  = createServiceClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('current_workspace_id').eq('id', user.id).single()
    if (!profile?.current_workspace_id) return NextResponse.json({ tasks: [], hasDailyTasks: false })

    const { data: business } = await supabase
      .from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    if (!business) return NextResponse.json({ tasks: [], hasDailyTasks: false })

    const today = new Date().toISOString().split('T')[0]
    const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

    // Fetch all sources in parallel
    const [
      { data: savedTasks },
      { data: dailyRow },
      { data: signals },
    ] = await Promise.all([
      service.from('tasks').select('*')
        .eq('business_id', business.id)
        .gte('due_date', sevenAgo)
        .order('created_at', { ascending: false }),
      supabase.from('daily_tasks').select('*')
        .eq('business_id', business.id).eq('date', today).maybeSingle(),
      service.from('agent_signals').select('id, type, title, body, action_data_json')
        .eq('business_id', business.id).eq('dismissed', false)
        .in('type', ['task', 'opportunity', 'warning'])
        .order('created_at', { ascending: false }).limit(8),
    ])

    const hasDailyTasks = !!(dailyRow?.tasks_json && (dailyRow.tasks_json as unknown[]).length > 0)

    // Build map of saved tasks by source_id for state overrides
    const savedBySourceId = new Map<string, Record<string, unknown>>()
    const savedIds = new Set<string>()
    for (const t of savedTasks ?? []) {
      if (t.source_id) savedBySourceId.set(t.source_id as string, t)
      savedIds.add(t.id as string)
    }

    // Collect synthetic tasks (daily + signals) not yet in saved tasks
    const toInsert: Record<string, unknown>[] = []
    const merged: Record<string, unknown>[] = []

    // Existing saved tasks (manual + previously synced)
    for (const t of savedTasks ?? []) {
      merged.push(t)
    }

    // Today's AI daily tasks
    if (dailyRow?.tasks_json) {
      for (const t of dailyRow.tasks_json as Array<{
        id: string; title: string; description?: string; source?: string;
        priority?: string; completed?: boolean; action_data?: { url?: string; tool?: string }
      }>) {
        const sourceId = `daily_${today}_${t.id}`
        if (!savedBySourceId.has(sourceId)) {
          const task = {
            id: sourceId, // use sourceId as virtual id until saved
            business_id: business.id,
            workspace_id: profile.current_workspace_id,
            title: t.title,
            description: t.description ?? '',
            category: t.source ?? 'general',
            status: t.completed ? 'done' : 'todo',
            priority: t.priority ?? 'medium',
            source: 'ai',
            source_id: sourceId,
            href: t.action_data?.url ?? null,
            cta: t.action_data?.tool ?? null,
            due_date: today,
            created_at: new Date().toISOString(),
          }
          merged.push(task)
          toInsert.push({ ...task, id: undefined }) // let DB generate id
        }
      }
    }

    // Agent signals
    for (const sig of signals ?? []) {
      const sourceId = `signal_${sig.id}`
      if (!savedBySourceId.has(sourceId)) {
        const actionUrl = (sig.action_data_json as Record<string, string> | null)?.url ?? null
        const task = {
          id: sourceId,
          business_id: business.id,
          workspace_id: profile.current_workspace_id,
          title: sig.title,
          description: ((sig.body as string | null) ?? '').slice(0, 200),
          category: sig.type === 'warning' ? 'audit' : 'gtm',
          status: 'todo',
          priority: sig.type === 'warning' ? 'high' : 'medium',
          source: 'ai',
          source_id: sourceId,
          href: actionUrl,
          cta: null,
          due_date: today,
          created_at: new Date().toISOString(),
        }
        merged.push(task)
        toInsert.push({ ...task, id: undefined })
      }
    }

    // Persist new tasks in background (don't wait, don't block response)
    if (toInsert.length > 0) {
      service.from('tasks').insert(toInsert).then(({ error }) => {
        if (error) console.error('[tasks] insert error:', error.message)
      })
    }

    return NextResponse.json({ tasks: merged, hasDailyTasks })
  } catch (err) {
    console.error('[tasks GET] error:', err)
    return NextResponse.json({ tasks: [], hasDailyTasks: false })
  }
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const service  = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    title: string; description?: string; category?: string; priority?: string;
    href?: string; cta?: string; due_date?: string; source_id?: string
  }
  if (!body.title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = await supabase
    .from('businesses').select('id').eq('workspace_id', profile?.current_workspace_id ?? '').maybeSingle()
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const today = new Date().toISOString().split('T')[0]

  // If source_id provided, upsert to avoid duplicates (virtual task being persisted)
  const upsertData = {
    business_id: business.id,
    workspace_id: profile!.current_workspace_id,
    title: body.title.trim(),
    description: body.description ?? '',
    category: body.category ?? 'general',
    priority: body.priority ?? 'medium',
    source: body.source_id ? 'ai' : 'manual',
    source_id: body.source_id ?? null,
    href: body.href ?? null,
    cta: body.cta ?? null,
    due_date: body.due_date ?? today,
    status: 'todo',
  }

  const { data: task, error } = await service.from('tasks')
    .upsert(upsertData, { onConflict: 'business_id,source_id', ignoreDuplicates: false })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task })
}
