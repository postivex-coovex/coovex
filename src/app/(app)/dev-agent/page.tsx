import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import DevAgentClient from './dev-agent-client'
import { CVD_CURRENT_VERSION } from '@/app/api/wp-dev/update/route'

export const metadata: Metadata = { title: 'WordPress Dev Agent — CooVex' }

export default async function DevAgentPage() {
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
        .select('id, name, website_url, api_key, workspace_id')
        .eq('workspace_id', profile.current_workspace_id)
        .maybeSingle()
    : { data: null }

  // Generate API key if missing
  let apiKey = business?.api_key ?? ''
  if (business && !apiKey) {
    const { randomBytes } = await import('crypto')
    apiKey = 'cvx_' + randomBytes(24).toString('hex')
    await supabase.from('businesses').update({ api_key: apiKey }).eq('id', business.id)
  }

  // Fetch connected sites via service client (RLS requires service role for wp_dev_licenses)
  const service = createServiceClient()
  const { data: licenses } = business?.workspace_id
    ? await service
        .from('wp_dev_licenses')
        .select('id, site_url, plugin_version, last_validated, revoked, mismatch_count')
        .eq('workspace_id', business.workspace_id)
        .order('last_validated', { ascending: false })
    : { data: [] }

  return (
    <DevAgentClient
      apiKey={apiKey}
      businessName={business?.name ?? ''}
      licenses={licenses ?? []}
      pluginVersion={CVD_CURRENT_VERSION}
    />
  )
}
