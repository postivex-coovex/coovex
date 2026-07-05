import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BASE = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const GRAPH = 'https://graph.facebook.com/v19.0'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${BASE()}/settings/integrations?error=facebook_denied#social`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== state) {
    return NextResponse.redirect(`${BASE()}/settings/integrations?error=invalid_state#social`)
  }

  const redirectUri = `${BASE()}/api/auth/facebook/callback`

  // Exchange code → short-lived user token
  const tokenRes = await fetch(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({
      client_id:     process.env.FACEBOOK_APP_ID!,
      client_secret: process.env.FACEBOOK_APP_SECRET!,
      redirect_uri:  redirectUri,
      code,
    })}`
  )
  if (!tokenRes.ok) {
    return NextResponse.redirect(`${BASE()}/settings/integrations?error=facebook_token#social`)
  }
  const { access_token: shortToken } = await tokenRes.json()

  // Exchange → long-lived user token (60 days)
  const longRes = await fetch(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({
      grant_type:        'fb_exchange_token',
      client_id:         process.env.FACEBOOK_APP_ID!,
      client_secret:     process.env.FACEBOOK_APP_SECRET!,
      fb_exchange_token: shortToken,
    })}`
  )
  const longData = longRes.ok ? await longRes.json() : { access_token: shortToken }
  const userToken = longData.access_token

  // Get user info + pages
  const meRes = await fetch(`${GRAPH}/me?fields=id,name&access_token=${userToken}`)
  const me = meRes.ok ? await meRes.json() : {}

  const pagesRes = await fetch(`${GRAPH}/me/accounts?access_token=${userToken}`)
  const pagesData = pagesRes.ok ? await pagesRes.json() : { data: [] }
  const pages: { id: string; name: string; access_token: string }[] = pagesData.data ?? []

  // Check for Instagram business accounts
  let igAccountName: string | null = null
  let igAccountId: string | null = null
  if (pages.length > 0) {
    const igRes = await fetch(
      `${GRAPH}/${pages[0].id}?fields=instagram_business_account&access_token=${pages[0].access_token}`
    )
    if (igRes.ok) {
      const igData = await igRes.json()
      if (igData.instagram_business_account?.id) {
        const igInfoRes = await fetch(
          `${GRAPH}/${igData.instagram_business_account.id}?fields=id,username&access_token=${pages[0].access_token}`
        )
        if (igInfoRes.ok) {
          const igInfo = await igInfoRes.json()
          igAccountId = igInfo.id
          igAccountName = igInfo.username
        }
      }
    }
  }

  // Fetch business
  const { data: prof } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: biz } = await supabase
    .from('businesses').select('id, social_connections')
    .eq('workspace_id', prof?.current_workspace_id ?? '').maybeSingle()

  if (!biz) return NextResponse.redirect(`${BASE()}/settings/integrations?error=no_business#social`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = ((biz as any).social_connections as Record<string, unknown>) ?? {}
  const updated: Record<string, unknown> = {
    ...existing,
    facebook: {
      connected:    true,
      account_name: me.name ?? 'Facebook User',
      account_id:   me.id ?? '',
      user_token:   userToken,
      pages:        pages.map(p => ({ id: p.id, name: p.name, access_token: p.access_token })),
    },
  }

  // Also save Instagram if found
  if (igAccountId) {
    updated.instagram = {
      connected:    true,
      account_name: igAccountName ?? 'Instagram Account',
      account_id:   igAccountId,
      page_id:      pages[0]?.id,
      page_token:   pages[0]?.access_token,
    }
  }

  await supabase.from('businesses').update({ social_connections: updated } as Record<string, unknown>).eq('id', biz.id)

  const connectedParam = igAccountId ? 'facebook,instagram' : 'facebook'
  return NextResponse.redirect(`${BASE()}/settings/integrations?connected=${connectedParam}#social`)
}
