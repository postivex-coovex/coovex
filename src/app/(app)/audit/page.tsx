import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AuditClient from './audit-client'

export const metadata: Metadata = { title: 'Business Audit — CooVex' }

export default async function AuditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, name, website_url, health_score').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  const { data: audits } = business
    ? await supabase.from('audits').select('id, type, score, created_at, report_json').eq('business_id', business.id).order('created_at', { ascending: false }).limit(20)
    : { data: [] }

  return (
    <AuditClient
      audits={audits || []}
      websiteUrl={business?.website_url || ''}
      businessName={business?.name || ''}
      currentHealthScore={business?.health_score ?? 0}
    />
  )
}
