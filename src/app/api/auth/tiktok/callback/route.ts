import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BASE = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${BASE()}/settings/integrations?error=tiktok_denied#social`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== state) {
    return NextResponse.redirect(`${BASE()}/settings/integrations?error=invalid_state#social`)
  }

  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key:    process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type:    'authorization_code',
      redirect_uri:  `${BASE()}/api/auth/tiktok/callback`,
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${BASE()}/settings/integrations?error=tiktok_token#social`)
  }

  const tokenData = await tokenRes.json()
  const { access_token, expires_in, open_id } = tokenData.data ?? tokenData

  // Fetch user info
  const infoRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name,username', {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  const info = infoRes.ok ? await infoRes.json() : {}
  const displayName = info.data?.user?.display_name ?? info.data?.user?.username ?? 'TikTok User'

  const { data: prof } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: biz } = await supabase
    .from('businesses').select('id, social_connections')
    .eq('workspace_id', prof?.current_workspace_id ?? '').maybeSingle()

  if (!biz) return NextResponse.redirect(`${BASE()}/settings/integrations?error=no_business#social`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = ((biz as any).social_connections as Record<string, unknown>) ?? {}
  const updated = {
    ...existing,
    tiktok: {
      connected:    true,
      account_name: displayName,
      open_id,
      access_token,
      expires_at: new Date(Date.now() + (expires_in ?? 86400) * 1000).toISOString(),
    },
  }

  await supabase.from('businesses').update({ social_connections: updated } as Record<string, unknown>).eq('id', biz.id)

  return NextResponse.redirect(`${BASE()}/settings/integrations?connected=tiktok#social`)
}
