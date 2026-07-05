import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail, type EmailSettings } from '@/lib/send-email'

// Vercel Cron: every 15 minutes — "*/15 * * * *"
export async function GET() {
  const supabase = await createServiceClient()

  const { data: due } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())

  if (!due?.length) return NextResponse.json({ status: 'ok', sent: 0 })

  let totalSent = 0

  for (const campaign of due) {
    // Optimistic lock — only proceed if still 'scheduled'
    const { data: locked } = await supabase
      .from('email_campaigns')
      .update({ status: 'sending', updated_at: new Date().toISOString() })
      .eq('id', campaign.id)
      .eq('status', 'scheduled')
      .select('id')

    if (!locked || locked.length === 0) continue // another instance grabbed it

    // Get business email settings
    const { data: business } = await supabase.from('businesses').select('*').eq('id', campaign.business_id).maybeSingle()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emailSettings: EmailSettings = ((business as any)?.email_settings as EmailSettings) ?? { method: 'reply_to' }

    const q = supabase.from('leads').select('name, email').eq('business_id', campaign.business_id).not('email', 'is', null)
    if (campaign.segment && campaign.segment !== 'all') q.eq('stage', campaign.segment)
    const { data: leads } = await q

    let sentCount = 0
    const settings: EmailSettings = {
      ...emailSettings,
      from_name: emailSettings.from_name || campaign.from_name || 'The Team',
    }

    for (const lead of leads ?? []) {
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
    }).eq('id', campaign.id)

    totalSent += sentCount
  }

  return NextResponse.json({ status: 'ok', campaigns_sent: due.length, emails_sent: totalSent })
}
