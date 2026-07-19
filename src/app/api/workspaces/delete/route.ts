import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// DELETE — permanently delete a workspace and all its data
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspace_id, confirm_name } = await req.json()
  if (!workspace_id || !confirm_name) {
    return NextResponse.json({ error: 'workspace_id and confirm_name are required' }, { status: 400 })
  }

  const admin = await createServiceClient()

  // Verify caller is the owner of this workspace
  const { data: member } = await admin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || member.role !== 'owner') {
    return NextResponse.json({ error: 'Only the workspace owner can delete it' }, { status: 403 })
  }

  // Verify the business name matches (server-side safety check)
  const { data: business } = await admin
    .from('businesses')
    .select('name')
    .eq('workspace_id', workspace_id)
    .maybeSingle()

  if (business && business.name.trim().toLowerCase() !== confirm_name.trim().toLowerCase()) {
    return NextResponse.json({ error: 'Business name does not match' }, { status: 400 })
  }

  // Find another workspace to switch to before deleting
  const { data: profile } = await admin
    .from('profiles')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single()

  const { data: memberships } = await admin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .neq('workspace_id', workspace_id)

  const nextWorkspaceId = memberships?.[0]?.workspace_id ?? null

  // Switch to another workspace first (or null)
  if (profile?.current_workspace_id === workspace_id) {
    await admin
      .from('profiles')
      .update({ current_workspace_id: nextWorkspaceId })
      .eq('id', user.id)
  }

  // Delete the workspace — DB cascades to business, leads, signals, etc.
  const { error } = await admin
    .from('workspaces')
    .delete()
    .eq('id', workspace_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, next_workspace_id: nextWorkspaceId })
}
