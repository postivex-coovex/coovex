import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: site } = await supabase
    .from('monitored_websites')
    .select('user_id')
    .eq('id', id)
    .single()
  if (!site || site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '96'), 500)

  const { data, error } = await supabase
    .from('website_checks')
    .select('id,checked_at,is_up,http_status,load_time_ms,ssl_valid,ssl_expiry_date,ssl_days_left,domain_expiry_date,domain_days_left,has_https,has_robots_txt,has_sitemap,security_score,security_headers,seo_score,seo_data,error_message')
    .eq('website_id', id)
    .order('checked_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
