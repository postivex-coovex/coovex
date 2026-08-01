import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WebsiteList } from '@/components/monitoring/website-list'
import type { MonitoredWebsite } from '@/lib/monitoring/types'

export const metadata = { title: 'Website Monitoring — CooVex' }

export default async function MonitoringPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: sites } = await supabase
    .from('monitored_websites')
    .select('id,url,name,is_active,status,last_check_at,uptime_7d,avg_load_time_ms,last_load_time_ms,last_http_status,ssl_valid,ssl_days_left,domain_days_left,alert_emails,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <WebsiteList initial={(sites ?? []) as MonitoredWebsite[]} />
    </div>
  )
}
