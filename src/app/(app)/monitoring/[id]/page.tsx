import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WebsiteDetail } from '@/components/monitoring/website-detail'
import type { MonitoredWebsite, WebsiteCheck, WebsiteNotification } from '@/lib/monitoring/types'

type Props = { params: Promise<{ id: string }> }

export default async function MonitoringDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: site } = await supabase
    .from('monitored_websites')
    .select('*')
    .eq('id', id)
    .single()

  if (!site) notFound()

  const isOwner = site.user_id === user.id

  // Non-owner notes visibility check
  if (!isOwner) {
    if (site.notes_visibility !== 'team') {
      site.credential_notes = null
    } else {
      const [ownerP, viewerP] = await Promise.all([
        supabase.from('profiles').select('current_workspace_id').eq('id', site.user_id).single(),
        supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single(),
      ])
      if (ownerP.data?.current_workspace_id !== viewerP.data?.current_workspace_id) {
        site.credential_notes = null
      }
    }
  }

  const [{ data: checks }, { data: notifications }] = await Promise.all([
    supabase
      .from('website_checks')
      .select('id,checked_at,is_up,http_status,load_time_ms,ssl_valid,ssl_expiry_date,ssl_days_left,domain_expiry_date,domain_days_left,has_robots_txt,has_sitemap,has_https,security_score,security_headers,seo_score,seo_data,error_message')
      .eq('website_id', id)
      .order('checked_at', { ascending: false })
      .limit(96),
    supabase
      .from('website_notifications')
      .select('*')
      .eq('website_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  return (
    <div className="p-6">
      <WebsiteDetail
        site={site as MonitoredWebsite}
        initialChecks={(checks ?? []) as WebsiteCheck[]}
        initialNotifications={(notifications ?? []) as WebsiteNotification[]}
        isOwner={isOwner}
      />
    </div>
  )
}
