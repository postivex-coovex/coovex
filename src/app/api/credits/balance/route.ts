import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('current_workspace_id, ai_credits_balance')
    .eq('id', user.id)
    .single()

  if (!profile?.current_workspace_id) {
    return NextResponse.json({ balance: 0, monthly: 0, business_used: 0 })
  }

  const [{ data: workspace }, { data: usageTx }] = await Promise.all([
    service
      .from('workspaces')
      .select('owner_id, ai_credits_balance, ai_credits_monthly, credits_reset_at, plan')
      .eq('id', profile.current_workspace_id)
      .single(),
    service
      .from('credit_transactions')
      .select('amount')
      .eq('workspace_id', profile.current_workspace_id)
      .eq('type', 'usage'),
  ])

  // Use profile-level balance if migration applied, else fall back to workspace balance
  const balance = (profile.ai_credits_balance != null)
    ? profile.ai_credits_balance
    : (workspace?.ai_credits_balance ?? 0)

  const business_used = (usageTx ?? []).reduce((s, t) => s + Math.abs(t.amount), 0)

  return NextResponse.json(
    { balance, monthly: workspace?.ai_credits_monthly ?? 0, reset_at: workspace?.credits_reset_at ?? null, plan: workspace?.plan ?? 'trial', business_used },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}
