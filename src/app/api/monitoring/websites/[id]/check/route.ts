import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkWebsite } from '@/lib/monitoring/checker'
import type { MonitoredWebsite } from '@/lib/monitoring/types'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: site } = await supabase
    .from('monitored_websites')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const result = await checkWebsite(site.url)
  const now = new Date().toISOString()

  // Save check record
  await supabase.from('website_checks').insert({
    website_id: id,
    checked_at: now,
    is_up: result.isUp,
    http_status: result.httpStatus,
    load_time_ms: result.loadTimeMs,
    ssl_valid: result.ssl.valid,
    ssl_expiry_date: result.ssl.expiryDate?.toISOString() ?? null,
    ssl_days_left: result.ssl.daysLeft,
    domain_expiry_date: result.domain.expiryDate?.toISOString() ?? null,
    domain_days_left: result.domain.daysLeft,
    has_robots_txt: result.hasRobotsTxt,
    has_sitemap: result.hasSitemap,
    has_https: result.hasHttps,
    security_score: result.security.score,
    security_headers: {
      hsts: result.security.hasHsts,
      xFrame: result.security.hasXFrame,
      xContentType: result.security.hasXContentType,
      csp: result.security.hasCSP,
      referrerPolicy: result.security.hasReferrerPolicy,
      permissionsPolicy: result.security.hasPermissionsPolicy,
    },
    seo_score: result.seo.score,
    seo_data: {
      hasTitle: result.seo.hasTitle,
      hasMetaDescription: result.seo.hasMetaDescription,
      hasOgTitle: result.seo.hasOgTitle,
      hasCanonical: result.seo.hasCanonical,
      title: result.seo.title,
      metaDescription: result.seo.metaDescription,
    },
    error_message: result.errorMessage,
  })

  // Compute 7d uptime
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: recent } = await supabase
    .from('website_checks')
    .select('is_up')
    .eq('website_id', id)
    .gte('checked_at', cutoff)
  const total = recent?.length ?? 0
  const upCount = recent?.filter(c => c.is_up).length ?? 0
  const uptime7d = total > 0 ? Math.round((upCount / total) * 10000) / 100 : null

  // Update website record
  const s = site as MonitoredWebsite
  const newStatus = result.isUp ? 'up' : 'down'
  const update: Record<string, unknown> = {
    status: newStatus,
    last_check_at: now,
    last_load_time_ms: result.loadTimeMs,
    last_http_status: result.httpStatus,
    ssl_valid: result.ssl.valid,
    ssl_expiry_date: result.ssl.expiryDate?.toISOString() ?? s.ssl_expiry_date,
    ssl_days_left: result.ssl.daysLeft,
    domain_expiry_date: result.domain.expiryDate?.toISOString() ?? s.domain_expiry_date,
    domain_days_left: result.domain.daysLeft,
    uptime_7d: uptime7d,
    retry_count: 0,
    consecutive_failures: result.isUp ? 0 : (s.consecutive_failures + 1),
    updated_at: now,
  }

  // Update avg load time (rolling average)
  if (result.loadTimeMs !== null && result.isUp) {
    update.avg_load_time_ms = s.avg_load_time_ms
      ? Math.round((s.avg_load_time_ms * 0.8 + result.loadTimeMs * 0.2))
      : result.loadTimeMs
  }

  await supabase.from('monitored_websites').update(update).eq('id', id)

  return NextResponse.json({ ok: true, result })
}
