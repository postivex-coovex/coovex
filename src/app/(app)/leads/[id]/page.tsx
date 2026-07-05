import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import LeadDetailClient from './lead-detail-client'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('leads').select('name').eq('id', id).single()
  return { title: data ? `${data.name} — Leads` : 'Lead — CooVex' }
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: lead } = await supabase.from('leads').select('*').eq('id', id).single()
  if (!lead) notFound()

  const { data: activities } = await supabase
    .from('lead_activities')
    .select('*')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }
  const { data: products } = business
    ? await supabase.from('products').select('id, name, tagline, description, price, price_unit, currency, key_benefits, target_audience').eq('business_id', business.id).eq('status', 'active').order('sort_order')
    : { data: [] }

  return <LeadDetailClient lead={lead} activities={activities || []} assignedTo={lead.assigned_to} products={products ?? []} />
}
