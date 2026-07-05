import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReviewsClient from './reviews-client'

export const metadata: Metadata = { title: 'Reviews — CooVex' }
export const dynamic = 'force-dynamic'

export default async function ReviewsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()

  let reviews: Record<string, unknown>[] = []
  let gmbConfigured = false

  try {
    const { data: business } = profile?.current_workspace_id
      ? await supabase.from('businesses').select('*').eq('workspace_id', profile.current_workspace_id).maybeSingle()
      : { data: null }

    if (business) {
      const { data: rows } = await supabase
        .from('reviews')
        .select('*')
        .eq('business_id', business.id)
        .order('posted_at', { ascending: false })
        .limit(100)
      reviews = rows ?? []

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const intg = (business as any).integrations as Record<string, any> ?? {}
      const gmb = intg.google_mybusiness ?? {}
      gmbConfigured = !!(gmb.access_token || gmb.client_id)
    }
  } catch {
    // columns may not exist yet
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ReviewsClient reviews={reviews as any} gmbConfigured={gmbConfigured} />
}
