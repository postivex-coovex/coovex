import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface WebsiteMetrics {
  paying_customers?: number
  mrr?: number              // Monthly Recurring Revenue in USD
  arr?: number              // Annual Recurring Revenue in USD
  dau?: number              // Daily Active Users
  mau?: number              // Monthly Active Users
  trial_users?: number
  churn_rate?: number       // e.g. 0.02 = 2%
  arpu?: number             // Average Revenue Per User
  conversion_rate?: number  // e.g. 0.035 = 3.5%
  total_signups?: number
  nps_score?: number        // -100 to 100
  support_tickets?: number
  custom?: Record<string, number | string>
  source?: string           // e.g. "stripe", "custom-admin", "manual"
  updated_at?: string
}

// POST — called from user's own system (auth via embed_token)
export async function POST(req: NextRequest) {
  const token =
    req.headers.get('x-coovex-token') ??
    req.nextUrl.searchParams.get('token')

  if (!token) return NextResponse.json({ error: 'Missing token. Pass x-coovex-token header or ?token= query param.' }, { status: 401 })

  const supabase = await createClient()
  const { data: business } = await supabase
    .from('businesses')
    .select('id, integrations')
    .eq('embed_token', token)
    .maybeSingle()

  if (!business) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const body = await req.json().catch(() => null) as WebsiteMetrics | null
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const integrations = (business.integrations as Record<string, unknown>) ?? {}
  const metrics: WebsiteMetrics = {
    ...body,
    updated_at: new Date().toISOString(),
    source: body.source ?? 'api',
  }

  await supabase.from('businesses').update({
    integrations: { ...integrations, __website_metrics: metrics },
  }).eq('id', business.id)

  return NextResponse.json({
    ok: true,
    received: metrics,
    message: 'Metrics saved. Your AI will use this data for goals and insights.',
  })
}

// GET — called from CooVex dashboard (auth via session)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, embed_token, integrations').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ metrics: null, embed_token: null })

  const integrations = (business.integrations as Record<string, unknown>) ?? {}
  const metrics = (integrations.__website_metrics as WebsiteMetrics) ?? null

  return NextResponse.json({ metrics, embed_token: business.embed_token })
}

// PATCH — update from dashboard (manual form / popup)
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, integrations').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const body = await req.json() as WebsiteMetrics
  const integrations = (business.integrations as Record<string, unknown>) ?? {}
  const existing = (integrations.__website_metrics as WebsiteMetrics) ?? {}

  const metrics: WebsiteMetrics = {
    ...existing,
    ...body,
    updated_at: new Date().toISOString(),
    source: 'manual',
  }

  await supabase.from('businesses').update({
    integrations: { ...integrations, __website_metrics: metrics },
  }).eq('id', business.id)

  return NextResponse.json({ ok: true, metrics })
}
