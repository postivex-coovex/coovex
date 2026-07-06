import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sendWelcomeEmail } from '@/lib/email'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const type = searchParams.get('type')
  const isNewUser = searchParams.get('new') === '1'

  if (code) {
    const cookieStore = await cookies()

    const redirectTo = type === 'recovery' ? `${origin}/reset-password` : `${origin}${next}`
    const response = NextResponse.redirect(redirectTo)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      const admin = createServiceClient()

      // Sync email to profiles table
      admin.from('profiles')
        .update({ email: data.user.email })
        .eq('id', data.user.id)
        .then(() => {})

      // Auto-create workspace for new users (no current_workspace_id)
      const { data: profile } = await admin
        .from('profiles')
        .select('current_workspace_id')
        .eq('id', data.user.id)
        .single()

      if (!profile?.current_workspace_id) {
        const displayName =
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          data.user.email?.split('@')[0] ||
          'My Business'

        const { data: workspace } = await admin
          .from('workspaces')
          .insert({ name: displayName, owner_id: data.user.id, ai_credits_balance: 30 })
          .select()
          .single()

        if (workspace) {
          await Promise.all([
            admin.from('workspace_members').insert({
              workspace_id: workspace.id, user_id: data.user.id, role: 'owner',
            }),
            admin.from('businesses').insert({
              workspace_id: workspace.id, name: displayName, industry: 'Other',
            }),
            admin.from('profiles').update({ current_workspace_id: workspace.id }).eq('id', data.user.id),
            admin.from('credit_transactions').insert({
              workspace_id: workspace.id, amount: 30, type: 'bonus',
              description: 'Welcome bonus — 30 free credits', balance_after: 30,
            }),
          ])

          if (data.user.email) {
            sendWelcomeEmail(data.user.email, displayName).catch(() => null)
          }
        }
      } else if (isNewUser && data.user.email) {
        // Existing workspace but explicitly flagged as new (email confirmation flow)
        const { data: prof } = await admin.from('profiles').select('full_name').eq('id', data.user.id).single()
        const name = prof?.full_name ?? data.user.email.split('@')[0]
        sendWelcomeEmail(data.user.email, name).catch(() => null)
      }

      const workspaceId = searchParams.get('workspace_id')
      if (workspaceId) {
        await admin.from('workspace_members').upsert(
          { workspace_id: workspaceId, user_id: data.user.id, role: 'viewer' },
          { onConflict: 'workspace_id,user_id' }
        )
      }

      return response
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
