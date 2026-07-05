import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TrendsClient from './trends-client'

export const metadata: Metadata = { title: 'Industry Trends' }
export const dynamic = 'force-dynamic'

export default async function TrendsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()

  let industry     = 'Business'
  let country      = ''
  let initialTrends: unknown[]  = []
  let generatedAt:  string | null = null
  let nextRefreshIn = 0

  if (profile?.current_workspace_id) {
    const { data: business } = await supabase
      .from('businesses')
      .select('industry, country, integrations')
      .eq('workspace_id', profile.current_workspace_id)
      .maybeSingle()

    if (business) {
      industry = business.industry || industry
      country  = business.country  || country

      const integrations = (business.integrations as Record<string, unknown>) ?? {}
      const cache = integrations.__trends as { data: unknown[]; generated_at: string } | undefined

      if (cache?.data && cache.generated_at) {
        const ageHours = (Date.now() - new Date(cache.generated_at).getTime()) / 3600000
        initialTrends  = cache.data
        generatedAt    = cache.generated_at
        nextRefreshIn  = Math.max(0, Math.round((6 - ageHours) * 10) / 10)
      }
    }
  }

  return (
    <TrendsClient
      industry={industry}
      country={country}
      initialTrends={initialTrends}
      generatedAt={generatedAt}
      nextRefreshIn={nextRefreshIn}
    />
  )
}
