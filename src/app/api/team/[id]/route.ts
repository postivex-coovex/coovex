import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function getCallerCtx(userId: string) {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', userId).single()
  if (!profile?.current_workspace_id) return null

  const service = createServiceClient()
  const { data: mem } = await service
    .from('workspace_members').select('role')
    .eq('workspace_id', profile.current_workspace_id).eq('user_id', userId).maybeSingle()
  if (!mem) return null

  return { workspace_id: profile.current_workspace_id, role: mem.role as string, service }
}

// PATCH — update member role or permissions
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getCallerCtx(user.id)
  if (!ctx) return NextResponse.json({ error: 'No workspace' }, { status: 400 })
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  const body = await req.json() as { role?: string; permissions?: Record<string, boolean> }
  const update: Record<string, unknown> = {}
  if (body.role)        update.role        = body.role
  if (body.permissions) update.permissions = body.permissions

  const { error } = await ctx.service
    .from('workspace_members')
    .update(update)
    .eq('id', id)
    .eq('workspace_id', ctx.workspace_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — remove a member
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getCallerCtx(user.id)
  if (!ctx) return NextResponse.json({ error: 'No workspace' }, { status: 400 })
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  // Prevent removing yourself
  const { data: target } = await ctx.service
    .from('workspace_members').select('user_id, role').eq('id', id).maybeSingle()
  if (target?.user_id === user.id) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
  }
  if (target?.role === 'owner') {
    return NextResponse.json({ error: 'Cannot remove workspace owner' }, { status: 400 })
  }

  await ctx.service.from('workspace_members')
    .delete().eq('id', id).eq('workspace_id', ctx.workspace_id)

  return NextResponse.json({ ok: true })
}
