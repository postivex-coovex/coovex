import type { Metadata } from 'next'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import ContentClient from './content-client'

export const metadata: Metadata = { title: 'Content Calendar — CooVex' }

export default async function ContentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('*').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  const service = createServiceClient()
  const [{ data: posts }, { data: audits }, { data: geoMemory }] = await Promise.all([
    business
      ? supabase.from('posts').select('*').eq('business_id', business.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    business
      ? supabase.from('audits').select('id, score, created_at, report_json').eq('business_id', business.id).eq('type', 'website').order('created_at', { ascending: false }).limit(10)
      : Promise.resolve({ data: [] }),
    business
      ? service.from('agent_memory').select('value_text').eq('business_id', business.id).eq('key', 'geo_intelligence').maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const auditOptions = (audits ?? []).map(a => ({
    id: a.id as string,
    score: a.score as number,
    url: (a.report_json as { url?: string })?.url ?? 'Website',
    created_at: a.created_at as string,
    hasIntel: !!(a.report_json as { intel?: { services?: string[] } })?.intel?.services?.length,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const biz = business as any
  const sc = biz?.social_connections as Record<string, { connected: boolean; account_name?: string }> | null
  const connectedChannels = sc ? Object.keys(sc).filter(k => sc[k]?.connected) : []
  const hasWebhook = !!(biz?.webhook_url)

  let contentGaps: { type: string; suggestion: string; impact: 'high' | 'medium' | 'low' }[] = []
  if (geoMemory?.value_text) {
    try {
      const geo = JSON.parse(geoMemory.value_text)
      contentGaps = geo.content_gaps ?? []
    } catch { /* ignore */ }
  }

  return (
    <Suspense>
      <ContentClient
        initialPosts={posts || []}
        businessName={business?.name || ''}
        industry={business?.industry || ''}
        auditOptions={auditOptions}
        connectedChannels={connectedChannels}
        hasWebhook={hasWebhook}
        contentGaps={contentGaps}
      />
    </Suspense>
  )
}
