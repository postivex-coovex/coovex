import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('*').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ memory: [], facts: [] })

  // Pull from agent_memory table if it exists
  const { data: memories } = await supabase
    .from('agent_memory')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Pull recent signals as "observations"
  const { data: signals } = await supabase
    .from('agent_signals')
    .select('title, body, signal_type, created_at, priority')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Business profile facts the agent knows
  const facts = [
    business.name        && { key: 'Business Name',    value: business.name },
    business.industry    && { key: 'Industry',          value: business.industry },
    business.country     && { key: 'Country',           value: business.country },
    business.size        && { key: 'Team Size',         value: business.size },
    business.target_customer && { key: 'Target Customer', value: business.target_customer?.toUpperCase() },
    business.website_url && { key: 'Website',           value: business.website_url },
    business.description && { key: 'Description',       value: business.description },
  ].filter(Boolean)

  return NextResponse.json({
    facts,
    memories: memories ?? [],
    observations: signals ?? [],
    business_id: business.id,
  })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()

  await supabase.from('agent_memory').delete().eq('id', id).then(() => null)
  return NextResponse.json({ ok: true })
}
