import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkWebsite } from '@/lib/monitoring/checker'
import { saveNotification, sendDownAlert, sendRecoveryAlert } from '@/lib/monitoring/notifications'
import type { MonitoredWebsite } from '@/lib/monitoring/types'

// Vercel Cron — runs every minute
// Handles retry logic for sites that were detected as down

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()

  // Get sites in retry mode with next_check_at in the past
  const { data: sites } = await supabase
    .from('monitored_websites')
    .select('*')
    .eq('is_active', true)
    .gt('retry_count', 0)
    .lte('next_check_at', now)
    .limit(50)

  if (!sites?.length) return NextResponse.json({ ok: true, retried: 0 })

  let retried = 0

  await Promise.allSettled(sites.map(async (site: MonitoredWebsite) => {
    try {
      const result = await checkWebsite(site.url)
      const checkTime = new Date().toISOString()

      // Save check record
      await supabase.from('website_checks').insert({
        website_id: site.id,
        checked_at: checkTime,
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
          hsts: result.security.hasHsts, xFrame: result.security.hasXFrame,
          xContentType: result.security.hasXContentType, csp: result.security.hasCSP,
          referrerPolicy: result.security.hasReferrerPolicy, permissionsPolicy: result.security.hasPermissionsPolicy,
        },
        seo_score: result.seo.score,
        seo_data: {
          hasTitle: result.seo.hasTitle, hasMetaDescription: result.seo.hasMetaDescription,
          hasOgTitle: result.seo.hasOgTitle, hasCanonical: result.seo.hasCanonical,
          title: result.seo.title, metaDescription: result.seo.metaDescription,
        },
        error_message: result.errorMessage,
      })

      if (result.isUp) {
        // Recovered!
        const downSince = site.down_notified_at ? new Date(site.down_notified_at) : null
        const downDuration = downSince ? formatDuration(Date.now() - downSince.getTime()) : 'a few minutes'

        await saveNotification(supabase, {
          websiteId: site.id, userId: site.user_id, type: 'recovered',
          severity: 'info', title: `${site.name} is back online`,
          message: `Website recovered after being down for ${downDuration}.`,
        })
        await sendRecoveryAlert(site, downDuration)

        await supabase.from('monitored_websites').update({
          status: 'up', retry_count: 0, consecutive_failures: 0,
          last_check_at: checkTime, last_http_status: result.httpStatus,
          last_load_time_ms: result.loadTimeMs,
          next_check_at: new Date(Date.now() + 30 * 60000).toISOString(),
          updated_at: checkTime,
        }).eq('id', site.id)
      } else if (site.retry_count >= 5) {
        // 5 retries exhausted — officially down, send alert
        await saveNotification(supabase, {
          websiteId: site.user_id, userId: site.user_id, type: 'down',
          severity: 'critical', title: `${site.name} is DOWN`,
          message: `Website has been unreachable for 5+ minutes. ${result.errorMessage ?? ''}`,
        })
        // Fix: websiteId was wrong above, override:
        await supabase.from('website_notifications').insert({
          website_id: site.id, user_id: site.user_id, type: 'down',
          severity: 'critical', title: `${site.name} is DOWN`,
          message: `Website has been unreachable for 5+ minutes. ${result.errorMessage ?? ''}`,
        })
        await sendDownAlert(site)

        await supabase.from('monitored_websites').update({
          status: 'down', retry_count: 0,
          consecutive_failures: site.consecutive_failures + 1,
          last_check_at: checkTime, last_http_status: result.httpStatus,
          down_notified_at: checkTime,
          next_check_at: new Date(Date.now() + 30 * 60000).toISOString(),
          updated_at: checkTime,
        }).eq('id', site.id)
      } else {
        // Increment retry, check again in 1 minute
        await supabase.from('monitored_websites').update({
          status: 'checking',
          retry_count: site.retry_count + 1,
          consecutive_failures: site.consecutive_failures + 1,
          last_check_at: checkTime, last_http_status: result.httpStatus,
          next_check_at: new Date(Date.now() + 60000).toISOString(),
          updated_at: checkTime,
        }).eq('id', site.id)
      }

      retried++
    } catch (e) {
      console.error(`[monitoring-retry] site ${site.id} failed:`, e)
    }
  }))

  return NextResponse.json({ ok: true, retried })
}

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''}`
  const hrs = Math.floor(mins / 60)
  return `${hrs} hour${hrs !== 1 ? 's' : ''} ${mins % 60}m`
}
