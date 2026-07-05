import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createServiceClient()

  // token = workspace_id
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, industry, country, health_score')
    .eq('workspace_id', token)
    .maybeSingle()

  if (!business) {
    return NextResponse.json({ error: 'Portal not found' }, { status: 404 })
  }

  // White-label config
  const { data: wl } = await supabase
    .from('white_label_configs')
    .select('*')
    .eq('business_id', business.id)
    .maybeSingle()

  if (wl && !wl.portal_enabled) {
    return NextResponse.json({ error: 'Portal is disabled' }, { status: 403 })
  }

  // Metrics
  const [leadsRes, signalsRes, postsRes] = await Promise.all([
    supabase.from('leads').select('id, stage, score').eq('business_id', business.id),
    supabase.from('agent_signals').select('id, type, title, created_at').eq('business_id', business.id).eq('dismissed', false).order('created_at', { ascending: false }).limit(5),
    supabase.from('posts').select('id, status').eq('business_id', business.id),
  ])

  const leads = leadsRes.data || []
  const signals = signalsRes.data || []
  const posts = postsRes.data || []

  const totalLeads = leads.length
  const wonLeads = leads.filter((l: { stage: string }) => l.stage === 'won').length
  const scheduledPosts = posts.filter((p: { status: string }) => p.status === 'scheduled').length
  const publishedPosts = posts.filter((p: { status: string }) => p.status === 'published').length

  return NextResponse.json({
    business: {
      name: business.name,
      industry: business.industry,
      country: business.country,
      health_score: business.health_score || 72,
    },
    wl: wl || { brand_name: null, logo_url: null, primary_color: '#7c3aed', portal_welcome_message: null, hide_powered_by: false },
    metrics: { totalLeads, wonLeads, scheduledPosts, publishedPosts },
    signals,
  })
}
