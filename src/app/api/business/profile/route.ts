import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()

  if (!profile?.current_workspace_id) return NextResponse.json({ business: null })

  const { data: business } = await supabase
    .from('businesses')
    .select('id,name,website_url,pricing_page_url,pricing_packages,pricing_mode,service_page_url,business_stage,current_mrr,currency,target_market,knows_icp,knows_competitors,has_marketing_plan')
    .eq('workspace_id', profile.current_workspace_id)
    .maybeSingle()

  return NextResponse.json({ business })
}
