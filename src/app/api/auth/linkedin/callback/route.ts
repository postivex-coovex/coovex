import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BASE = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const LI_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'X-Restli-Protocol-Version': '2.0.0',
})

// Fetch LinkedIn company pages where user is ADMINISTRATOR
async function fetchLinkedInPages(accessToken: string): Promise<{ id: string; name: string }[]> {
  try {
    const aclRes = await fetch(
      'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED',
      { headers: LI_HEADERS(accessToken) }
    )
    if (!aclRes.ok) return []

    const { elements = [] } = await aclRes.json() as { elements?: { organizationalTarget: string }[] }
    const pages: { id: string; name: string }[] = []

    for (const el of elements.slice(0, 10)) {
      // organizationalTarget = "urn:li:organization:12345"
      const orgId = el.organizationalTarget?.split(':').pop()
      if (!orgId) continue

      const orgRes = await fetch(
        `https://api.linkedin.com/v2/organizations/${orgId}?fields=id,localizedName`,
        { headers: LI_HEADERS(accessToken) }
      )
      if (!orgRes.ok) continue
      const org = await orgRes.json() as { id: number; localizedName?: string }
      pages.push({ id: String(org.id), name: org.localizedName ?? `Organization ${orgId}` })
    }
    return pages
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${BASE()}/settings/integrations?error=linkedin_denied#social`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== state) {
    return NextResponse.redirect(`${BASE()}/settings/integrations?error=invalid_state#social`)
  }

  // Exchange code → access token
  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  `${BASE()}/api/auth/linkedin/callback`,
      client_id:     process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${BASE()}/settings/integrations?error=linkedin_token#social`)
  }

  const { access_token, expires_in } = await tokenRes.json() as {
    access_token: string
    expires_in: number
  }

  // Fetch personal profile
  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: LI_HEADERS(access_token),
  })
  const profile = profileRes.ok ? await profileRes.json() as { name?: string; sub?: string } : {}

  // Fetch company pages (graceful — empty array if scope not granted)
  const pages = await fetchLinkedInPages(access_token)

  // Fetch business
  const { data: prof } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: biz } = await supabase
    .from('businesses').select('id, social_connections')
    .eq('workspace_id', prof?.current_workspace_id ?? '').maybeSingle()

  if (!biz) return NextResponse.redirect(`${BASE()}/settings/integrations?error=no_business#social`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = ((biz as any).social_connections as Record<string, unknown>) ?? {}
  const updated = {
    ...existing,
    linkedin: {
      connected:        true,
      account_name:     profile.name ?? 'LinkedIn User',
      account_id:       profile.sub ?? '',
      access_token,
      expires_at:       new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString(),
      pages,
      // Keep previously selected page if reconnecting and it still exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      selected_page_id: pages.length > 0
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? ((existing.linkedin as any)?.selected_page_id ?? null)
        : null,
    },
  }

  await supabase.from('businesses').update({ social_connections: updated } as Record<string, unknown>).eq('id', biz.id)

  return NextResponse.redirect(`${BASE()}/settings/integrations?connected=linkedin#social`)
}
