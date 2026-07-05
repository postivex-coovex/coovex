import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { signal_id, action_type, action_data } = await req.json() as {
    signal_id: string
    action_type: string
    action_data?: Record<string, unknown>
  }

  if (!signal_id || !action_type) {
    return NextResponse.json({ error: 'signal_id and action_type required' }, { status: 400 })
  }

  const service = createServiceClient()

  // 1. Verify signal belongs to user's workspace
  const { data: profile } = await supabase
    .from('profiles')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single()

  const { data: signal } = await service
    .from('agent_signals')
    .select('id, business_id, action_type, action_data_json, title')
    .eq('id', signal_id)
    .single()

  if (!signal) return NextResponse.json({ error: 'Signal not found' }, { status: 404 })

  // 2. Perform the action based on type
  let result: Record<string, unknown> = {}
  const executedAt = new Date().toISOString()

  switch (action_type) {
    case 'respond_review': {
      // Mark review response as published
      const reviewId = action_data?.review_id as string | undefined
      if (reviewId) {
        await service
          .from('reviews')
          .update({ response_status: 'published', response_published_at: executedAt })
          .eq('id', reviewId)
        result = { published: true, review_id: reviewId }
      } else {
        result = { published: true, note: 'No review_id — action logged only' }
      }
      break
    }
    case 'approve_post': {
      // Publish the social post
      const postId = action_data?.post_id as string | undefined
      if (postId) {
        await service
          .from('posts')
          .update({ status: 'published', published_at: executedAt })
          .eq('id', postId)
        result = { published: true, post_id: postId }
      } else {
        result = { published: true, note: 'No post_id — action logged only' }
      }
      break
    }
    case 'view_lead': {
      // Queue a follow-up email for the lead
      const leadId = action_data?.lead_id as string | undefined
      if (leadId) {
        await service.from('lead_followup_queue').insert({
          lead_id: leadId,
          queued_by: 'agent',
          status: 'pending',
          created_at: executedAt,
        }).maybeSingle()
      }
      result = { queued: true, lead_id: leadId ?? null }
      break
    }
    default:
      result = { note: `No executor for ${action_type} — signal marked as executed` }
  }

  // 3. Log the execution
  await service.from('agent_activity_log').insert({
    workspace_id: profile?.current_workspace_id,
    user_id: user.id,
    signal_id,
    action_type,
    action_data_json: action_data ?? {},
    result_json: result,
    executed_at: executedAt,
    executed_by: 'user',
  }).maybeSingle()

  // 4. Dismiss the signal
  await service
    .from('agent_signals')
    .update({ dismissed: true })
    .eq('id', signal_id)

  return NextResponse.json({ ok: true, executed_at: executedAt, result })
}
