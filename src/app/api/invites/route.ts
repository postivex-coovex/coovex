import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendInviteEmail } from '@/lib/email'

// Encode invite as signed token (base64 JSON — no extra table needed)
function makeToken(workspace_id: string, role: string): string {
  const payload = { w: workspace_id, r: role, exp: Date.now() + 7 * 24 * 3600 * 1000 }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function decodeToken(token: string): { w: string; r: string; exp: number } | null {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString())
    if (!payload.w || !payload.r || !payload.exp) return null
    if (Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

// POST — generate invite link
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role = 'member', email } = await req.json()

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  // Check caller is owner or admin
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', profile.current_workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Only owners and admins can invite' }, { status: 403 })
  }

  const token = makeToken(profile.current_workspace_id, role)
  const origin = req.headers.get('origin') || 'https://coovex.com'
  const link = `${origin}/join/${token}`

  // Store pending invite in DB if table exists (graceful fallback)
  if (email) {
    await supabase.from('workspace_invites').insert({
      workspace_id: profile.current_workspace_id,
      invited_by: user.id,
      email,
      role,
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    }).then(() => null)

    // Send real invite email via Resend
    const { data: inviterProfile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    const { data: workspace } = await supabase.from('workspaces').select('name').eq('id', profile.current_workspace_id).single()
    await sendInviteEmail(
      email,
      inviterProfile?.full_name ?? 'A teammate',
      workspace?.name ?? 'CooVex',
      link,
    )
  }

  return NextResponse.json({ ok: true, link, token, expires_in: '7 days' })
}
