import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { GtmClient } from './gtm-client'

export const metadata: Metadata = { title: 'GTM Autopilot — CooVex' }

export default async function GtmAgentPage() {
  const supabase = await createClient()
  const service  = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  let lastRun = null
  if (business) {
    const { data: mem } = await service
      .from('agent_memory').select('value_text')
      .eq('business_id', business.id).eq('key', 'gtm_last_run').maybeSingle()
    if (mem?.value_text) {
      try { lastRun = JSON.parse(mem.value_text) } catch {}
    }
  }

  return <GtmClient initialLastRun={lastRun} />
}
