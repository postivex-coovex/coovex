import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GeoIdeasClient } from './geo-ideas-client'

export const metadata: Metadata = { title: 'GEO Content Ideas — CooVex' }

export default async function GeoIdeasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, name, website_url').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  let contentGaps: { type: string; suggestion: string; impact: 'high' | 'medium' | 'low' }[] = []
  let generatedAt: string | null = null

  if (business) {
    const { data: mem } = await supabase
      .from('agent_memory').select('value_text, updated_at')
      .eq('business_id', business.id).eq('key', 'geo_intelligence').maybeSingle()
    if (mem?.value_text) {
      try {
        const geo = JSON.parse(mem.value_text)
        contentGaps = geo.content_gaps ?? []
        generatedAt = mem.updated_at
      } catch { /* ignore */ }
    }
  }

  return (
    <GeoIdeasClient
      contentGaps={contentGaps}
      generatedAt={generatedAt}
      businessName={business?.name ?? ''}
      hasGeoIntel={contentGaps.length > 0}
    />
  )
}
