import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — leads with no activity in 30+ days
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ leads: [] })

  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()

  // Leads not in terminal stages, created before cutoff
  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, email, company, job_title, source, stage, lead_score, created_at, updated_at, notes')
    .eq('business_id', business.id)
    .not('stage', 'in', '("won","lost")')
    .lt('updated_at', cutoff)
    .order('updated_at', { ascending: true })
    .limit(50)

  return NextResponse.json({ leads: leads ?? [], cutoff_days: 30 })
}
