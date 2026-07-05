import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL!))

  const clientId = process.env.LINKEDIN_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=not_configured#social', process.env.NEXT_PUBLIC_APP_URL!)
    )
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`
  const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  // w_organization_social requires "Community Management API" or "Marketing Developer Platform"
  // product on LinkedIn Developer App — request access at developers.linkedin.com if not available
  // Currently using personal posting scope only; expand when LinkedIn grants org access
  authUrl.searchParams.set('scope', 'openid profile w_member_social')
  authUrl.searchParams.set('state', user.id)

  return NextResponse.redirect(authUrl.toString())
}
