import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL!))

  const appId = process.env.FACEBOOK_APP_ID
  if (!appId) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=not_configured#social', process.env.NEXT_PUBLIC_APP_URL!)
    )
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/facebook/callback`
  const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth')
  authUrl.searchParams.set('client_id', appId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', 'pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish')
  authUrl.searchParams.set('state', user.id)
  authUrl.searchParams.set('response_type', 'code')

  return NextResponse.redirect(authUrl.toString())
}
