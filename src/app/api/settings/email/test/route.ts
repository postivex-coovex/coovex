import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, type EmailSettings } from '@/lib/send-email'

const SECRET_KEYS = [
  'smtp_pass', 'resend_api_key', 'sendgrid_api_key',
  'mailgun_api_key', 'brevo_api_key', 'postmark_api_key',
] as const

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { settings } = await req.json() as { settings: EmailSettings & Record<string, any> }

  // Fetch stored secrets to resolve masked values
  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('*').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stored = (business as any)?.email_settings as Record<string, unknown> ?? {}

  const resolved: EmailSettings = { ...settings }
  for (const k of SECRET_KEYS) {
    if ((settings as Record<string, unknown>)[k] === '••••••••') {
      (resolved as unknown as Record<string, unknown>)[k] = stored[k]
    }
  }

  const result = await sendEmail(
    {
      to:      user.email!,
      subject: 'CooVex — Email test successful ✓',
      text:    `This is a test email from your CooVex campaigns system.\n\nProvider: ${resolved.method}\nFrom: ${resolved.from_email || resolved.smtp_user || resolved.sendgrid_from_email || resolved.brevo_from_email || resolved.postmark_from_email || 'default'}\n\nIf you received this, email sending is working correctly!`,
    },
    resolved,
  )

  return NextResponse.json(result)
}
