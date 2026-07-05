import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendReviewRequestEmail } from '@/lib/email'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, name').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business found' }, { status: 404 })

  const { data: lead } = await supabase
    .from('leads')
    .select('id, name, email, company, stage')
    .eq('id', id)
    .eq('business_id', business.id)
    .single()

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  if (lead.stage !== 'won') return NextResponse.json({ error: 'Lead is not in won stage' }, { status: 400 })

  const leadLabel = lead.name + (lead.company ? ` @ ${lead.company}` : '')

  // Create agent signal
  await supabase.from('agent_signals').insert({
    business_id: business.id,
    title: `Review request sent to ${leadLabel}`,
    description: `A review request was triggered for ${leadLabel}${lead.email ? ` (${lead.email})` : ''}. Follow up to ensure they leave a review on Google or your preferred platform.`,
    signal_type: 'action',
    priority: 'medium',
    status: 'active',
  }).then(() => null)

  // Log activity on lead
  await supabase.from('lead_activities').insert({
    lead_id: id,
    type: 'email',
    note: `Review request sent${lead.email ? ` to ${lead.email}` : ''}`,
    created_by: user.id,
  }).then(() => null)

  // Send real review request email if lead has email
  if (lead.email) {
    await sendReviewRequestEmail(lead.email, lead.name, business.name)
  }

  return NextResponse.json({ ok: true, message: `Review request sent to ${leadLabel}`, email_sent: !!lead.email })
}
