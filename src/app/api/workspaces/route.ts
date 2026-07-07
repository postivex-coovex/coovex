import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET — list all workspaces the user belongs to (with business info)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single()

  // Get all workspace memberships
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(id, name, plan, created_at)')
    .eq('user_id', user.id)

  if (!memberships?.length) return NextResponse.json({ workspaces: [] })

  // Get businesses for each workspace
  const workspaceIds = memberships.map(m => m.workspace_id)
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, industry, logo_url, workspace_id')
    .in('workspace_id', workspaceIds)

  type BizRow = { id: string; name: string; industry: string; logo_url: string | null; workspace_id: string }
  const bizMap: Record<string, BizRow> = {}
  for (const b of (businesses ?? []) as BizRow[]) {
    if (b.workspace_id) bizMap[b.workspace_id] = b
  }

  const result = memberships.map(m => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws = (m.workspaces as any) as { id: string; name: string; plan: string; created_at: string } | null
    const biz = bizMap[m.workspace_id]
    return {
      workspace_id:   m.workspace_id,
      workspace_name: ws?.name ?? 'Untitled',
      plan:           ws?.plan ?? 'starter',
      role:           m.role,
      business_id:    biz?.id ?? null,
      business_name:  biz?.name ?? 'My Business',
      industry:       biz?.industry ?? '',
      logo_url:       biz?.logo_url ?? null,
      is_current:     m.workspace_id === profile?.current_workspace_id,
    }
  })

  return NextResponse.json({ workspaces: result })
}

// POST — create a new workspace + business and switch to it
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { business_name, industry, website_url } = await req.json()
  if (!business_name || !industry) {
    return NextResponse.json({ error: 'business_name and industry are required' }, { status: 400 })
  }

  // Use service client to bypass RLS for workspace/business creation
  const admin = await createServiceClient()

  // 1. Create workspace with 30 welcome credits
  const { data: workspace, error: wsErr } = await admin
    .from('workspaces')
    .insert({ name: business_name, owner_id: user.id, ai_credits_balance: 30 })
    .select()
    .single()
  if (wsErr || !workspace) return NextResponse.json({ error: wsErr?.message ?? 'Failed to create workspace' }, { status: 500 })

  // Log welcome credit transaction
  await admin.from('credit_transactions').insert({
    workspace_id: workspace.id,
    amount: 30,
    type: 'bonus',
    description: 'Welcome bonus — 30 free credits',
    balance_after: 30,
  }).then(() => {})

  // 2. Add user as owner member
  await admin.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: 'owner',
  })

  // 3. Create business
  const { data: business } = await admin
    .from('businesses')
    .insert({
      workspace_id: workspace.id,
      name: business_name,
      industry,
      website_url: website_url || null,
    })
    .select()
    .single()

  // 4. Switch to this workspace (admin bypasses RLS — user.id already verified above)
  await admin.from('profiles').update({ current_workspace_id: workspace.id }).eq('id', user.id)

  return NextResponse.json({ workspace, business })
}
