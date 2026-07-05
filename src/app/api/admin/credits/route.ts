import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')) return null
  return user
}

// GET /api/admin/credits — list all workspaces with credit info
export async function GET() {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const [{ data: workspaces }, { data: { users } }] = await Promise.all([
    service
      .from('workspaces')
      .select('id, name, plan, billing_status, ai_credits_balance, ai_credits_monthly, credits_reset_at, created_at, owner_id')
      .order('ai_credits_balance', { ascending: true }),
    service.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const userMap: Record<string, { email: string }> = {}
  for (const u of users ?? []) userMap[u.id] = { email: u.email ?? '' }

  const workspacesWithOwner = (workspaces ?? []).map(w => ({
    ...w,
    owner_email: userMap[w.owner_id]?.email ?? null,
  }))

  const { data: recentTx } = await service
    .from('credit_transactions')
    .select('workspace_id, amount, type, feature, description, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ workspaces: workspacesWithOwner, recentTx: recentTx ?? [] })
}

// POST /api/admin/credits — manual credit adjustment
export async function POST(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspace_id, amount, type, description } = await req.json()
  if (!workspace_id || !amount || !type) {
    return NextResponse.json({ error: 'workspace_id, amount, type required' }, { status: 400 })
  }

  const service = createServiceClient()

  if (type === 'deduct') {
    const { data, error } = await service.rpc('deduct_ai_credits', {
      p_workspace_id: workspace_id,
      p_amount: Math.abs(amount),
      p_feature: 'admin_adjustment',
      p_description: description || `Admin deduction by ${user.email}`,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (data === -1) return NextResponse.json({ error: 'Insufficient credits' }, { status: 400 })
    return NextResponse.json({ ok: true, balance: data })
  }

  // add credits (purchase / bonus / refund / monthly_refresh)
  const validTypes = ['purchase', 'bonus', 'refund', 'monthly_refresh']
  const creditType = validTypes.includes(type) ? type : 'bonus'

  const { data, error } = await service.rpc('add_ai_credits', {
    p_workspace_id: workspace_id,
    p_amount: Math.abs(amount),
    p_type: creditType,
    p_description: description || `Admin credit by ${user.email}`,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, balance: data })
}

// PATCH /api/admin/credits — update monthly allowance or plan credits
export async function PATCH(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspace_id, monthly, plan } = await req.json()
  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  const service = createServiceClient()
  const update: Record<string, unknown> = {}
  if (monthly !== undefined) update.ai_credits_monthly = monthly
  if (plan) update.plan = plan

  const { error } = await service.from('workspaces').update(update).eq('id', workspace_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
