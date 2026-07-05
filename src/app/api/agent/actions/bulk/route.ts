import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { signal_ids, action } = await req.json() as {
    signal_ids: string[]
    action: 'execute' | 'dismiss'
  }

  if (!Array.isArray(signal_ids) || signal_ids.length === 0) {
    return NextResponse.json({ error: 'signal_ids must be a non-empty array' }, { status: 400 })
  }
  if (action !== 'execute' && action !== 'dismiss') {
    return NextResponse.json({ error: 'action must be "execute" or "dismiss"' }, { status: 400 })
  }

  const service = createServiceClient()
  const executedAt = new Date().toISOString()

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single()

  // Fetch all signals to identify their action types
  const { data: signals } = await service
    .from('agent_signals')
    .select('id, action_type, action_data_json')
    .in('id', signal_ids)

  if (!signals || signals.length === 0) {
    return NextResponse.json({ error: 'No signals found' }, { status: 404 })
  }

  if (action === 'execute') {
    // Execute each signal based on its action type
    const execPromises = signals.map(async signal => {
      const data = signal.action_data_json as Record<string, unknown> | null ?? {}
      switch (signal.action_type) {
        case 'respond_review':
          if (data.review_id) {
            await service.from('reviews')
              .update({ response_status: 'published', response_published_at: executedAt })
              .eq('id', data.review_id as string)
          }
          break
        case 'approve_post':
          if (data.post_id) {
            await service.from('posts')
              .update({ status: 'published', published_at: executedAt })
              .eq('id', data.post_id as string)
          }
          break
        case 'view_lead':
          if (data.lead_id) {
            await service.from('lead_followup_queue').insert({
              lead_id: data.lead_id as string,
              queued_by: 'agent',
              status: 'pending',
              created_at: executedAt,
            }).maybeSingle()
          }
          break
      }
    })
    await Promise.allSettled(execPromises)

    // Log bulk execution
    await service.from('agent_activity_log').insert(
      signals.map(s => ({
        workspace_id: profile?.current_workspace_id,
        user_id: user.id,
        signal_id: s.id,
        action_type: s.action_type,
        action_data_json: s.action_data_json ?? {},
        result_json: { bulk: true },
        executed_at: executedAt,
        executed_by: 'user_bulk',
      }))
    )
  }

  // Dismiss all selected signals
  await service
    .from('agent_signals')
    .update({ dismissed: true })
    .in('id', signal_ids)

  return NextResponse.json({
    ok: true,
    action,
    count: signals.length,
    executed_at: executedAt,
  })
}
