import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, type EmailSettings } from '@/lib/send-email'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: campaign } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  if (campaign.status === 'sent') return NextResponse.json({ error: 'Already sent' }, { status: 400 })

  // Get business email settings
  const { data: business } = await supabase.from('businesses').select('*').eq('id', campaign.business_id).maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emailSettings: EmailSettings = ((business as any)?.email_settings as EmailSettings) ?? { method: 'reply_to' }

  // Fetch recipient leads — specific lead_ids takes priority over segment
  let leads: { id: string; name: string; email: string | null }[] | null = null
  if (Array.isArray(campaign.lead_ids) && campaign.lead_ids.length > 0) {
    const { data } = await supabase
      .from('leads').select('id, name, email')
      .in('id', campaign.lead_ids)
      .not('email', 'is', null)
    leads = data
  } else {
    const q = supabase.from('leads').select('id, name, email').eq('business_id', campaign.business_id).not('email', 'is', null)
    if (campaign.segment && campaign.segment !== 'all') q.eq('stage', campaign.segment)
    const { data } = await q
    leads = data
  }

  if (!leads?.length) {
    return NextResponse.json({ status: 'no_recipients', message: 'No leads with email addresses in this segment.' })
  }

  // Mark as sending
  await supabase.from('email_campaigns')
    .update({ status: 'sending', updated_at: new Date().toISOString() })
    .eq('id', id)

  let sentCount = 0
  const settings: EmailSettings = {
    ...emailSettings,
    from_name: emailSettings.from_name || campaign.from_name || 'The Team',
  }

  for (const lead of leads) {
    if (!lead.email) continue
    const firstName = (lead.name || '').split(' ')[0] || 'there'
    const text = (campaign.content || '').replace(/\{\{first_name\}\}/g, firstName)

    const result = await sendEmail({ to: lead.email, subject: campaign.subject, text }, settings)
    if (result.ok) sentCount++
  }

  await supabase.from('email_campaigns').update({
    status:     'sent',
    sent_count: sentCount,
    sent_at:    new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  return NextResponse.json({ status: 'ok', sent: sentCount, total: leads.length })
}
