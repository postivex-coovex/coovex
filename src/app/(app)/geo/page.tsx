import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import GeoClient from './geo-client'

export const metadata: Metadata = { title: 'GEO Optimizer — CooVex' }

export default async function GeoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single()

  const { data: business } = profile?.current_workspace_id
    ? await supabase
        .from('businesses')
        .select('id, name, website_url, website_intel')
        .eq('workspace_id', profile.current_workspace_id)
        .maybeSingle()
    : { data: null }

  const service = createServiceClient()

  // Fetch latest audit + cached intelligence + generated gaps in parallel
  const [auditResult, intelResult, gapsResult] = await Promise.all([
    business
      ? supabase
          .from('audits')
          .select('id, score, created_at, report_json')
          .eq('business_id', business.id)
          .not('report_json->geo', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    business
      ? service
          .from('agent_memory')
          .select('value_text')
          .eq('business_id', business.id)
          .eq('key', 'geo_intelligence')
          .maybeSingle()
      : Promise.resolve({ data: null }),
    business
      ? service
          .from('agent_memory')
          .select('value_text')
          .eq('business_id', business.id)
          .eq('key', 'geo_generated_gaps')
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const latestAudit = auditResult.data

  // Safe JSON parse — clear corrupted records rather than crashing
  let cachedIntelligence = null
  if (intelResult.data?.value_text) {
    try {
      cachedIntelligence = JSON.parse(intelResult.data.value_text)
    } catch {
      // Corrupted JSON — delete the bad row so it regenerates cleanly
      if (business?.id) {
        await service.from('agent_memory')
          .delete()
          .eq('business_id', business.id)
          .eq('key', 'geo_intelligence')
      }
    }
  }

  let generatedGaps: string[] = []
  if (gapsResult.data?.value_text) {
    try {
      generatedGaps = JSON.parse(gapsResult.data.value_text)
    } catch { /* ignore */ }
  }

  return (
    <GeoClient
      geo={latestAudit?.report_json?.geo ?? null}
      intel={latestAudit?.report_json?.intel ?? (business?.website_intel as object | null) ?? null}
      websiteUrl={latestAudit?.report_json?.url ?? business?.website_url ?? ''}
      businessName={business?.name ?? ''}
      lastScanned={latestAudit?.created_at ?? null}
      cachedIntelligence={cachedIntelligence}
      generatedGaps={generatedGaps}
    />
  )
}
