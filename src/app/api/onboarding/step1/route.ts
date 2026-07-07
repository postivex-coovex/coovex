import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()

  if (!profile?.current_workspace_id)
    return NextResponse.json({ error: 'No active workspace' }, { status: 400 })

  const body = await req.json()
  const {
    name, website_url, pricing_page_url, service_page_url,
    business_stage, current_mrr, currency, target_market,
    knows_icp, knows_competitors, has_marketing_plan,
    pricing_packages, pricing_mode,
  } = body

  const admin = await createServiceClient()

  const fields = {
    name,
    website_url:        website_url || null,
    pricing_page_url:   pricing_mode === 'url' ? (pricing_page_url || null) : null,
    pricing_packages:   pricing_mode === 'manual' ? (pricing_packages ?? null) : null,
    pricing_mode:       pricing_mode || 'url',
    service_page_url:   service_page_url || null,
    business_stage:     business_stage || null,
    current_mrr:        business_stage === 'live_transactions' ? (current_mrr ?? null) : null,
    currency:           currency || 'USD',
    target_market:      target_market || null,
    knows_icp:          !!knows_icp,
    knows_competitors:  !!knows_competitors,
    has_marketing_plan: !!has_marketing_plan,
  }

  // Check if business exists — create it if not (handles users who bypassed initial setup)
  const { data: existing } = await admin
    .from('businesses')
    .select('id')
    .eq('workspace_id', profile.current_workspace_id)
    .maybeSingle()

  let error
  if (existing) {
    ;({ error } = await admin.from('businesses').update(fields).eq('workspace_id', profile.current_workspace_id))
  } else {
    ;({ error } = await admin.from('businesses').insert({ ...fields, workspace_id: profile.current_workspace_id, health_score: 0, industry: 'Other' }))
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
