import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getContext(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', userId).single()
  const wsId = profile?.current_workspace_id
  if (!wsId) return null
  const { data: biz } = await supabase.from('businesses').select('id').eq('workspace_id', wsId).maybeSingle()
  if (!biz) return null
  return { wsId, bizId: biz.id }
}

// GET — load all saved marketing plans for this business
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ plans: [] })

  const { data: plans } = await supabase
    .from('marketing_plans')
    .select('id, goal, plan_json, actions_done, updated_at')
    .eq('business_id', ctx.bizId)
    .order('updated_at', { ascending: false })

  return NextResponse.json({ plans: plans ?? [] })
}

// POST — save/update a plan for a goal (upsert)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found' }, { status: 400 })

  const { goal, plan_json, actions_done } = await req.json()
  if (!goal || !plan_json) return NextResponse.json({ error: 'goal and plan_json required' }, { status: 400 })

  const { data, error } = await supabase
    .from('marketing_plans')
    .upsert({
      workspace_id: ctx.wsId,
      business_id: ctx.bizId,
      goal,
      plan_json,
      actions_done: actions_done ?? {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'business_id,goal' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

// PATCH — update just the actions_done for a goal
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found' }, { status: 400 })

  const { goal, actions_done } = await req.json()
  if (!goal) return NextResponse.json({ error: 'goal required' }, { status: 400 })

  const { error } = await supabase
    .from('marketing_plans')
    .update({ actions_done, updated_at: new Date().toISOString() })
    .eq('business_id', ctx.bizId)
    .eq('goal', goal)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
