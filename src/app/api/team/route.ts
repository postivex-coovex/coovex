import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { randomBytes } from 'crypto'

export const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  geo:         true,
  leads:       true,
  competitors: true,
  content:     true,
  proposals:   true,
  tools:       true,
  audit:       true,
  reports:     true,
  settings:    false,
  billing:     false,
}

async function getWorkspaceAndRole(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', userId).single()
  if (!profile?.current_workspace_id) return null

  const service = createServiceClient()
  const { data: mem } = await service
    .from('workspace_members').select('role')
    .eq('workspace_id', profile.current_workspace_id).eq('user_id', userId).maybeSingle()

  return mem ? { workspace_id: profile.current_workspace_id, role: mem.role as string, service } : null
}

// GET — list all members + credit/activity summary
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getWorkspaceAndRole(supabase, user.id)
  if (!ctx) return NextResponse.json({ members: [] })

  const { workspace_id, role: callerRole, service } = ctx

  const { data: members } = await service
    .from('workspace_members')
    .select('id, user_id, email, name, role, status, permissions, invite_token, created_at')
    .eq('workspace_id', workspace_id)
    .order('created_at', { ascending: true })

  // Credit + action count per user from activity_logs
  const { data: logs } = await service
    .from('activity_logs')
    .select('user_id, credits_used')
    .eq('workspace_id', workspace_id)

  const creditMap: Record<string, number> = {}
  const actionMap: Record<string, number> = {}
  for (const row of (logs ?? []) as { user_id: string; credits_used: number }[]) {
    creditMap[row.user_id] = (creditMap[row.user_id] ?? 0) + (row.credits_used ?? 0)
    actionMap[row.user_id] = (actionMap[row.user_id] ?? 0) + 1
  }

  const result = (members ?? []).map(m => ({
    ...m,
    permissions:  (m.permissions && Object.keys(m.permissions).length > 0) ? m.permissions : DEFAULT_PERMISSIONS,
    credits_used: creditMap[m.user_id ?? ''] ?? 0,
    action_count: actionMap[m.user_id ?? ''] ?? 0,
    invite_link:  m.invite_token
      ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.coovex.com'}/join?token=${m.invite_token}`
      : null,
  }))

  return NextResponse.json({ members: result, caller_role: callerRole })
}

// POST — invite a new team member
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getWorkspaceAndRole(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const { workspace_id, role: callerRole, service } = ctx
  if (callerRole !== 'owner' && callerRole !== 'admin') {
    return NextResponse.json({ error: 'Only owners and admins can invite' }, { status: 403 })
  }

  const { email, role = 'member', permissions, name } = await req.json() as {
    email: string; role?: string; permissions?: Record<string, boolean>; name?: string
  }
  if (!email?.trim()) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const normalEmail = email.trim().toLowerCase()
  const invite_token = randomBytes(24).toString('hex')
  const effectivePerms = permissions ?? DEFAULT_PERMISSIONS

  // Check if already invited
  const { data: existing } = await service
    .from('workspace_members').select('id, status')
    .eq('workspace_id', workspace_id).eq('email', normalEmail).maybeSingle()

  if (existing) {
    await service.from('workspace_members')
      .update({ invite_token, permissions: effectivePerms, role })
      .eq('id', existing.id)
    const link = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.coovex.com'}/join?token=${invite_token}`
    return NextResponse.json({ ok: true, invite_link: link, resent: true })
  }

  // Check if user already has an account with this email
  const { data: existingProfile } = await service
    .from('profiles').select('id').eq('email', normalEmail).maybeSingle()

  await service.from('workspace_members').insert({
    workspace_id,
    invited_by:  user.id,
    email:       normalEmail,
    name:        name ?? null,
    user_id:     existingProfile?.id ?? null,
    role,
    status:      existingProfile ? 'active' : 'pending',
    permissions: effectivePerms,
    invite_token,
  })

  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.coovex.com'}/join?token=${invite_token}`
  return NextResponse.json({ ok: true, invite_link: link, status: existingProfile ? 'active' : 'pending' })
}
