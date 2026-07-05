import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('*').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const intg = (business as any).integrations as Record<string, any> ?? {}
  const gmb = intg.google_mybusiness ?? {}

  if (!gmb.access_token && !gmb.client_id) {
    return NextResponse.json({ status: 'not_configured' })
  }

  // ── Try Google Business Profile API ────────────────────────────────────
  // Requires: access_token (OAuth2) + location_id
  const accessToken = gmb.access_token
  const locationId  = gmb.location_id // e.g. "accounts/123/locations/456"

  if (!accessToken || !locationId) {
    return NextResponse.json({ status: 'incomplete_config', message: 'Access token and location ID required' })
  }

  try {
    const apiRes = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationId}/reviews?pageSize=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (apiRes.status === 401) {
      return NextResponse.json({ status: 'token_expired', message: 'Re-connect Google Business Profile to refresh your token.' })
    }
    if (!apiRes.ok) {
      const err = await apiRes.text()
      return NextResponse.json({ status: 'api_error', message: err }, { status: 502 })
    }

    const { reviews: gmbReviews = [] } = await apiRes.json()
    let imported = 0

    for (const r of gmbReviews) {
      const externalId = r.reviewId
      // Skip duplicates
      const { data: existing } = await supabase.from('reviews')
        .select('id').eq('business_id', business.id).eq('platform', 'google')
        // store external_id in body as fallback — check reviewer + date combo
        .eq('reviewer_name', r.reviewer?.displayName ?? 'Anonymous')
        .eq('posted_at', r.createTime)
        .maybeSingle()
      if (existing) continue

      await supabase.from('reviews').insert({
        business_id:   business.id,
        platform:      'google',
        reviewer_name: r.reviewer?.displayName ?? 'Anonymous',
        rating:        ['ONE','TWO','THREE','FOUR','FIVE'].indexOf(r.starRating) + 1,
        body:          r.comment ?? null,
        title:         null,
        status:        r.reviewReply ? 'responded' : 'new',
        response:      r.reviewReply?.comment ?? null,
        posted_at:     r.createTime,
      })
      imported++
      void externalId
    }

    return NextResponse.json({ status: 'ok', imported, total: gmbReviews.length })
  } catch (err) {
    console.error('GMB sync error:', err)
    return NextResponse.json({ status: 'error', message: String(err) }, { status: 500 })
  }
}
