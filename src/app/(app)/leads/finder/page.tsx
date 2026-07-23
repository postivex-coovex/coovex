import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LeadsClient } from '../leads-client'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'AI Leads Finder — CooVex' }

export default async function LeadsFinderPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single()

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('workspace_id', profile?.current_workspace_id)
    .maybeSingle()

  const { data: leads } = business
    ? await supabase
        .from('leads')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: [] }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <LeadsClient leads={leads ?? []} businessId={business?.id ?? ''} initialTab="reddit" />
    </div>
  )
}
