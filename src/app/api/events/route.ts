/**
 * POST /api/events
 *
 * Logs a business event to the central event bus and immediately triggers
 * the orchestration engine to check if any rules match.
 *
 * Called by other modules when significant things happen:
 *   - Competitor insight added with threat type
 *   - Lead score updated
 *   - Goal status changed
 *
 * Body: { event_type, entity_type?, entity_id?, event_data? }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runOrchestration } from '@/lib/orchestration/engine'

const ALLOWED_EVENT_TYPES = new Set([
  'competitor.price_threat',
  'competitor.new_insight',
  'lead.score_drop',
  'lead.stage_change',
  'goal.at_risk',
  'goal.status_change',
  'review.negative',
  'audit.score_drop',
])

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    event_type:   string
    entity_type?: string
    entity_id?:   string
    event_data?:  Record<string, unknown>
  }

  if (!body.event_type) {
    return NextResponse.json({ error: 'event_type required' }, { status: 400 })
  }
  if (!ALLOWED_EVENT_TYPES.has(body.event_type)) {
    return NextResponse.json({ error: `Unknown event_type: ${body.event_type}` }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_workspace_id, agent_config_json')
    .eq('id', user.id)
    .single()

  if (!profile?.current_workspace_id) {
    return NextResponse.json({ error: 'No workspace' }, { status: 400 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('workspace_id', profile.current_workspace_id)
    .maybeSingle()

  const service = createServiceClient()

  // 1. Log the event
  const { data: event } = await service
    .from('business_events')
    .insert({
      workspace_id:    profile.current_workspace_id,
      event_type:      body.event_type,
      entity_type:     body.entity_type ?? null,
      entity_id:       body.entity_id ?? null,
      event_data_json: body.event_data ?? {},
    })
    .select('id')
    .single()

  if (!business) {
    return NextResponse.json({ ok: true, event_id: event?.id, chains: 0 })
  }

  // 2. Run orchestration immediately (event-driven, not polling)
  const agentConfig = (profile.agent_config_json ?? {}) as Record<string, unknown>
  const orchConfig  = (agentConfig.orchestration ?? {}) as Record<string, { enabled: boolean } | undefined>

  const result = await runOrchestration({
    workspaceId: profile.current_workspace_id,
    businessId:  business.id,
    rulesConfig: orchConfig,
  })

  // 3. Mark event as processed
  if (event?.id) {
    await service
      .from('business_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', event.id)
  }

  return NextResponse.json({
    ok:       true,
    event_id: event?.id,
    chains:   result.total_chains,
    signals:  result.total_signals,
  })
}
