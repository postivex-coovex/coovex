import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkWebsite } from '@/lib/monitoring/checker'
import { saveNotification, sendDownAlert, sendSSLAlert, sendDomainAlert, sendSlowLoadAlert, sendRecoveryAlert } from '@/lib/monitoring/notifications'
import type { MonitoredWebsite } from '@/lib/monitoring/types'

// Vercel Cron — runs every 30 minutes
// Processes all active sites not currently in retry mode

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Verify service client is working
  const { error: pingError } = await supabase.from('monitored_websites').select('id').limit(1)
  if (pingError) {
    console.error('[monitoring-cron] Supabase service client error:', pingError.message)
    return NextResponse.json({ error: 'DB error: ' + pingError.message }, { status: 500 })
  }

  const now = new Date().toISOString()

  const { data: sites } = await supabase
    .from('monitored_websites')
    .select('*')
    .eq('is_active', true)
    .eq('retry_count', 0)
    // Include sites never checked (next_check_at IS NULL) AND sites due for check
    .or(`next_check_at.is.null,next_check_at.lte.${now}`)
    .limit(100)

  if (!sites?.length) return NextResponse.json({ ok: true, processed: 0 })

  let processed = 0

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

      // Compute 7d uptime
      const cutoff = new Date(Date.now() - 7 * 86400000).toISOString()
      const { data: recent } = await supabase
        .from('website_checks').select('is_up').eq('website_id', site.id).gte('checked_at', cutoff)
      const total = recent?.length ?? 0
      const upCount = recent?.filter((c: { is_up: boolean }) => c.is_up).length ?? 0
      const uptime7d = total > 0 ? Math.round((upCount / total) * 10000) / 100 : null

      // Was previously up, now down → start retry cycle
      if (!result.isUp && site.status !== 'down') {
        const next30min = new Date(Date.now() + 30 * 60000).toISOString()
        await supabase.from('monitored_websites').update({
          status: 'checking',
          last_check_at: checkTime,
          last_load_time_ms: result.loadTimeMs,
          last_http_status: result.httpStatus,
          retry_count: 1,
          consecutive_failures: site.consecutive_failures + 1,
          next_check_at: new Date(Date.now() + 60000).toISOString(), // retry in 1 min
          uptime_7d: uptime7d,
          updated_at: checkTime,
        }).eq('id', site.id)
        return
      }

      // Site recovered
      if (result.isUp && site.status === 'down') {
        const downSince = site.down_notified_at ? new Date(site.down_notified_at) : null
        const downDuration = downSince
          ? formatDuration(Date.now() - downSince.getTime())
          : 'unknown duration'

        await saveNotification(supabase, {
          websiteId: site.id, userId: site.user_id, type: 'recovered',
          severity: 'info', title: `${site.name} is back online`,
          message: `Website recovered after being down for ${downDuration}.`,
        })
        await sendRecoveryAlert(site, downDuration)
      }

      // SSL alerts
      if (result.ssl.daysLeft !== null && site.alert_on_ssl_expiry) {
        if (result.ssl.daysLeft <= 7 && !recentlySent(site.ssl_notified_7d_at, 12)) {
          await saveNotification(supabase, {
            websiteId: site.id, userId: site.user_id, type: 'ssl_expiry',
            severity: 'critical', title: `SSL expiring in ${result.ssl.daysLeft} days`,
            message: `SSL certificate for ${site.name} expires in ${result.ssl.daysLeft} days.`,
          })
          await sendSSLAlert(site, result.ssl.daysLeft)
          await supabase.from('monitored_websites').update({ ssl_notified_7d_at: checkTime }).eq('id', site.id)
        } else if (result.ssl.daysLeft <= 30 && !recentlySent(site.ssl_notified_30d_at, 48)) {
          await saveNotification(supabase, {
            websiteId: site.id, userId: site.user_id, type: 'ssl_expiry',
            severity: 'warning', title: `SSL expiring in ${result.ssl.daysLeft} days`,
            message: `SSL certificate for ${site.name} expires in ${result.ssl.daysLeft} days.`,
          })
          await sendSSLAlert(site, result.ssl.daysLeft)
          await supabase.from('monitored_websites').update({ ssl_notified_30d_at: checkTime }).eq('id', site.id)
        }
      }

      // Domain expiry alerts
      if (result.domain.daysLeft !== null && site.alert_on_domain_expiry) {
        if (result.domain.daysLeft <= 7 && !recentlySent(site.domain_notified_7d_at, 12)) {
          await saveNotification(supabase, {
            websiteId: site.id, userId: site.user_id, type: 'domain_expiry',
            severity: 'critical', title: `Domain expiring in ${result.domain.daysLeft} days`,
            message: `Domain for ${site.name} expires in ${result.domain.daysLeft} days.`,
          })
          await sendDomainAlert(site, result.domain.daysLeft)
          await supabase.from('monitored_websites').update({ domain_notified_7d_at: checkTime }).eq('id', site.id)
        } else if (result.domain.daysLeft <= 30 && !recentlySent(site.domain_notified_30d_at, 48)) {
          await saveNotification(supabase, {
            websiteId: site.id, userId: site.user_id, type: 'domain_expiry',
            severity: 'warning', title: `Domain expiring in ${result.domain.daysLeft} days`,
            message: `Domain for ${site.name} expires in ${result.domain.daysLeft} days.`,
          })
          await sendDomainAlert(site, result.domain.daysLeft)
          await supabase.from('monitored_websites').update({ domain_notified_30d_at: checkTime }).eq('id', site.id)
        }
      }

      // Slow load alert
      if (result.isUp && result.loadTimeMs !== null && result.loadTimeMs > site.slow_load_threshold_ms && site.alert_on_slow_load) {
        await saveNotification(supabase, {
          websiteId: site.id, userId: site.user_id, type: 'slow_load',
          severity: 'warning', title: `Slow response on ${site.name}`,
          message: `Response time was ${(result.loadTimeMs / 1000).toFixed(2)}s (threshold: ${(site.slow_load_threshold_ms / 1000).toFixed(1)}s).`,
        })
        await sendSlowLoadAlert(site, result.loadTimeMs)
      }

      // Normal update
      const nextCheck = new Date(Date.now() + 30 * 60000).toISOString()
      const update: Record<string, unknown> = {
        status: result.isUp ? 'up' : 'down',
        last_check_at: checkTime,
        last_load_time_ms: result.loadTimeMs,
        last_http_status: result.httpStatus,
        ssl_valid: result.ssl.valid,
        ssl_expiry_date: result.ssl.expiryDate?.toISOString() ?? site.ssl_expiry_date,
        ssl_days_left: result.ssl.daysLeft,
        domain_expiry_date: result.domain.expiryDate?.toISOString() ?? site.domain_expiry_date,
        domain_days_left: result.domain.daysLeft,
        uptime_7d: uptime7d,
        retry_count: 0,
        consecutive_failures: result.isUp ? 0 : site.consecutive_failures + 1,
        next_check_at: nextCheck,
        updated_at: checkTime,
      }
      if (result.isUp && result.loadTimeMs !== null) {
        update.avg_load_time_ms = site.avg_load_time_ms
          ? Math.round(site.avg_load_time_ms * 0.8 + result.loadTimeMs * 0.2)
          : result.loadTimeMs
      }
      await supabase.from('monitored_websites').update(update).eq('id', site.id)
      processed++
    } catch (e) {
      console.error(`[monitoring-cron] site ${site.id} failed:`, e)
    }
  }))

  return NextResponse.json({ ok: true, processed })
}

function recentlySent(sentAt: string | null, hoursAgo: number): boolean {
  if (!sentAt) return false
  return Date.now() - new Date(sentAt).getTime() < hoursAgo * 3600000
}

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''}`
  const hrs = Math.floor(mins / 60)
  return `${hrs} hour${hrs !== 1 ? 's' : ''} ${mins % 60}m`
}
