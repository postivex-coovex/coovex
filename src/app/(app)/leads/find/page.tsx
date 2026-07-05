import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LeadWorkerClient } from './lead-worker-client'

export default async function LeadFinderPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = await supabase.from('businesses').select('id').eq('workspace_id', profile?.current_workspace_id ?? '').maybeSingle()

  const { data: audits } = await supabase
    .from('audits')
    .select('id, score, created_at, report_json')
    .eq('business_id', business?.id ?? '')
    .eq('type', 'website')
    .order('created_at', { ascending: false })
    .limit(10)

  const auditOptions = (audits ?? []).map(a => ({
    id: a.id,
    score: a.score,
    url: (a.report_json as { url?: string })?.url ?? 'Website',
    created_at: a.created_at,
    hasIntel: !!(a.report_json as { intel?: { services?: string[] } })?.intel?.services?.length,
  }))

  return <LeadWorkerClient audits={auditOptions} />
}
