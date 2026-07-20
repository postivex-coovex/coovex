import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()
  const service  = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  if (!profile?.current_workspace_id) return NextResponse.json({ tasks: [] })

  const { data: business } = await supabase
    .from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
  if (!business) return NextResponse.json({ tasks: [] })

  const today = new Date().toISOString().split('T')[0]
  const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  const [{ data: tasks }, { data: dailyRow }, { data: signals }] = await Promise.all([
    supabase.from('tasks').select('*')
      .eq('business_id', business.id)
      .gte('due_date', sevenAgo)
      .order('created_at', { ascending: false }),
    supabase.from('daily_tasks').select('*')
      .eq('business_id', business.id).eq('date', today).maybeSingle(),
    supabase.from('agent_signals').select('id, type, title, body, action_data_json')
      .eq('business_id', business.id).eq('dismissed', false)
      .in('type', ['task', 'opportunity', 'warning'])
      .order('created_at', { ascending: false }).limit(8),
  ])

  const existingSourceIds = new Set((tasks ?? []).map((t: { source_id?: string }) => t.source_id).filter(Boolean))
  const toInsert: Record<string, unknown>[] = []

  // Import today's AI daily tasks
  if (dailyRow?.tasks_json) {
    for (const t of dailyRow.tasks_json as Array<{
      id: string; title: string; description?: string; source?: string;
      priority?: string; completed?: boolean; action_data?: { url?: string; tool?: string }
    }>) {
      const sourceId = `daily_${today}_${t.id}`
      if (!existingSourceIds.has(sourceId)) {
        toInsert.push({
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
        })
      }
    }
  }

  // Import undismissed agent signals
  for (const sig of signals ?? []) {
    const sourceId = `signal_${sig.id}`
    if (!existingSourceIds.has(sourceId)) {
      const actionUrl = (sig.action_data_json as Record<string, string> | null)?.url ?? null
      const cat = sig.type === 'warning' ? 'audit' : 'gtm'
      toInsert.push({
        business_id: business.id,
        workspace_id: profile.current_workspace_id,
        title: sig.title,
        description: (sig.body as string | null)?.slice(0, 200) ?? '',
        category: cat,
        status: 'todo',
        priority: sig.type === 'warning' ? 'high' : 'medium',
        source: 'ai',
        source_id: sourceId,
        href: actionUrl,
        due_date: today,
      })
    }
  }

  if (toInsert.length > 0) {
    await service.from('tasks').insert(toInsert)
  }

  const { data: merged } = await supabase.from('tasks').select('*')
    .eq('business_id', business.id)
    .gte('due_date', sevenAgo)
    .order('created_at', { ascending: false })

  const hasDailyTasks = !!dailyRow?.tasks_json
  return NextResponse.json({ tasks: merged ?? [], hasDailyTasks })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const service  = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    title: string; description?: string; category?: string; priority?: string;
    href?: string; cta?: string; due_date?: string
  }
  if (!body.title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = await supabase
    .from('businesses').select('id').eq('workspace_id', profile?.current_workspace_id ?? '').maybeSingle()
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const today = new Date().toISOString().split('T')[0]

  const { data: task, error } = await service.from('tasks').insert({
    business_id: business.id,
    workspace_id: profile!.current_workspace_id,
    title: body.title.trim(),
    description: body.description ?? '',
    category: body.category ?? 'general',
    priority: body.priority ?? 'medium',
    source: 'manual',
    href: body.href ?? null,
    cta: body.cta ?? null,
    due_date: body.due_date ?? today,
    status: 'todo',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task })
}
