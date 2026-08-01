import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('monitored_websites')
    .select('id,url,name,is_active,status,last_check_at,uptime_7d,avg_load_time_ms,last_load_time_ms,last_http_status,ssl_valid,ssl_days_left,domain_days_left,alert_emails,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { url, name, alert_emails, alert_on_down, alert_on_ssl_expiry, alert_on_domain_expiry, alert_on_slow_load, slow_load_threshold_ms } = body

  if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

  // Normalize URL
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`
  const siteName = name || new URL(normalizedUrl).hostname

  // Parse emails: accept comma-separated string or array
  const emailArr: string[] = Array.isArray(alert_emails)
    ? alert_emails
    : (typeof alert_emails === 'string' ? alert_emails.split(',').map((e: string) => e.trim()).filter(Boolean) : [])

  const { data, error } = await supabase
    .from('monitored_websites')
    .insert({
      user_id: user.id,
      url: normalizedUrl,
      name: siteName,
      alert_emails: emailArr,
      alert_on_down: alert_on_down ?? true,
      alert_on_ssl_expiry: alert_on_ssl_expiry ?? true,
      alert_on_domain_expiry: alert_on_domain_expiry ?? true,
      alert_on_slow_load: alert_on_slow_load ?? true,
      slow_load_threshold_ms: slow_load_threshold_ms ?? 3000,
      next_check_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
