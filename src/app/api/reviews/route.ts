import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNewReviewAlertEmail } from '@/lib/email'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = await supabase.from('businesses').select('id, name, workspace_id')
    .eq('workspace_id', profile?.current_workspace_id).maybeSingle()
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const { platform, reviewer_name, rating, body, posted_at } = await req.json()
  if (!platform || !reviewer_name || !rating) {
    return NextResponse.json({ error: 'platform, reviewer_name, rating required' }, { status: 400 })
  }

  const { data: review, error } = await supabase.from('reviews').insert({
    business_id: business.id,
    platform,
    reviewer_name: reviewer_name.trim(),
    rating: Number(rating),
    body: body?.trim() || null,
    status: 'new',
    posted_at: posted_at || new Date().toISOString(),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify workspace owner in background
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  ;(async () => {
    try {
      const svc = createServiceClient()
      const { data: members } = await svc.from('workspace_members')
        .select('user_id').eq('workspace_id', business.workspace_id).eq('role', 'owner').limit(1)
      if (members?.[0]) {
        const { data: ownerProfile } = await svc.from('profiles')
          .select('email, name').eq('id', members[0].user_id).single()
        if (ownerProfile?.email) {
          await sendNewReviewAlertEmail(ownerProfile.email, ownerProfile.name ?? 'there', {
            id: review.id,
            platform: review.platform,
            rating: review.rating,
            reviewer_name: review.reviewer_name,
            body: review.body,
            business_name: business.name,
          })
        }
      }
    } catch { /* non-fatal */ }
  })()

  return NextResponse.json({ review })
}
