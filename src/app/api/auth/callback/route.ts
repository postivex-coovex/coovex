import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/email'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const type = searchParams.get('type')
  const isNewUser = searchParams.get('new') === '1'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Password recovery — go directly to reset page (skip new user logic)
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }
      // Send welcome email for new signups
      if (isNewUser && data.user?.email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.user.id)
          .single()
        const name = profile?.full_name ?? data.user.email.split('@')[0]
        sendWelcomeEmail(data.user.email, name).catch(() => null)
      }

      // Handle workspace invite acceptance
      const workspaceId = searchParams.get('workspace_id')
      if (workspaceId && data.user) {
        await supabase.from('workspace_members').upsert(
          { workspace_id: workspaceId, user_id: data.user.id, role: 'viewer' },
          { onConflict: 'workspace_id,user_id' }
        )
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
