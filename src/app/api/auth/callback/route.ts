import { createServerClient } from '@supabase/ssr'
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

    // Build the redirect response first so we can set cookies directly on it
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
    if (!error) {
      if (isNewUser && data.user?.email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.user.id)
          .single()
        const name = profile?.full_name ?? data.user.email.split('@')[0]
        sendWelcomeEmail(data.user.email, name).catch(() => null)
      }

      const workspaceId = searchParams.get('workspace_id')
      if (workspaceId && data.user) {
        await supabase.from('workspace_members').upsert(
          { workspace_id: workspaceId, user_id: data.user.id, role: 'viewer' },
          { onConflict: 'workspace_id,user_id' }
        )
      }

      return response
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
