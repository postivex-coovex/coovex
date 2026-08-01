import { Resend } from 'resend'
import type { MonitoredWebsite } from './types'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.RESEND_FROM_EMAIL ?? 'CooVex Monitor <noreply@coovex.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.coovex.com'

// ── DB helper (uses service client passed in) ──────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveNotification(supabase: any, params: {
  websiteId: string
  userId: string
  type: string
  severity: string
  title: string
  message: string
}) {
  const { error } = await supabase.from('website_notifications').insert({
    website_id: params.websiteId,
    user_id: params.userId,
    type: params.type,
    severity: params.severity,
    title: params.title,
    message: params.message,
  })
  if (error) console.error('[monitoring] notification insert:', error.message)
}

// ── Email sending ─────────────────────────────────────────────────────────

function emailLayout(content: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
<tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
<tr><td style="padding-bottom:24px;text-align:center;">
  <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">
    <span style="color:#3b82f6;">Coo</span><span style="color:#22c55e;">Vex</span>
  </span>
  <span style="color:#64748b;font-size:14px;margin-left:8px;">Website Monitor</span>
</td></tr>
<tr><td style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
  <div style="padding:36px;">${content}</div>
</td></tr>
<tr><td style="padding:24px 0;text-align:center;">
  <p style="color:#94a3b8;font-size:12px;margin:0;">
    © ${new Date().getFullYear()} CooVex ·
    <a href="${APP_URL}/monitoring" style="color:#3b82f6;text-decoration:none;">View Dashboard</a>
  </p>
</td></tr>
</table></td></tr></table></body></html>`
}

function statusBadge(isDown: boolean) {
  const color = isDown ? '#ef4444' : '#22c55e'
  const text  = isDown ? 'DOWN' : 'UP'
  return `<span style="display:inline-block;background:${color};color:#fff;padding:3px 10px;border-radius:6px;font-size:13px;font-weight:700;">${text}</span>`
}

async function sendToEmails(emails: string[], subject: string, html: string) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'your_resend_api_key') {
    console.log(`[monitoring-email] NOT CONFIGURED — would send "${subject}" to ${emails.join(', ')}`)
    return
  }
  if (!emails.length) return
  // Resend supports up to 50 recipients; chunk if needed
  for (let i = 0; i < emails.length; i += 50) {
    const chunk = emails.slice(i, i + 50)
    const { error } = await resend.emails.send({ from: FROM, to: chunk, subject, html })
    if (error) console.error('[monitoring-email] send error:', error)
  }
}

export async function sendDownAlert(site: MonitoredWebsite) {
  if (!site.alert_on_down || !site.alert_emails.length) return
  const subject = `🔴 Website Down: ${site.name}`
  const html = emailLayout(`
    <h2 style="color:#ef4444;margin:0 0 16px;">Website Down ${statusBadge(true)}</h2>
    <p style="color:#475569;font-size:15px;margin:0 0 8px;">Your website <strong>${site.name}</strong> is currently unreachable.</p>
    <p style="color:#475569;font-size:15px;margin:0 0 24px;">
      URL: <a href="${site.url}" style="color:#3b82f6;">${site.url}</a><br/>
      Detected at: ${new Date().toUTCString()}
    </p>
    <table cellpadding="0" cellspacing="0"><tr><td>
      <a href="${APP_URL}/monitoring/${site.id}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;">View Details</a>
    </td></tr></table>
  `)
  await sendToEmails(site.alert_emails, subject, html)
}

export async function sendRecoveryAlert(site: MonitoredWebsite, downDuration: string) {
  if (!site.alert_on_down || !site.alert_emails.length) return
  const subject = `✅ Website Recovered: ${site.name}`
  const html = emailLayout(`
    <h2 style="color:#22c55e;margin:0 0 16px;">Website Recovered ${statusBadge(false)}</h2>
    <p style="color:#475569;font-size:15px;margin:0 0 24px;">
      <strong>${site.name}</strong> is back online.<br/>
      URL: <a href="${site.url}" style="color:#3b82f6;">${site.url}</a><br/>
      Was down for: ${downDuration}
    </p>
    <table cellpadding="0" cellspacing="0"><tr><td>
      <a href="${APP_URL}/monitoring/${site.id}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;">View Details</a>
    </td></tr></table>
  `)
  await sendToEmails(site.alert_emails, subject, html)
}

export async function sendSSLAlert(site: MonitoredWebsite, daysLeft: number) {
  if (!site.alert_on_ssl_expiry || !site.alert_emails.length) return
  const urgent = daysLeft <= 7
  const subject = `${urgent ? '🚨' : '⚠️'} SSL Certificate Expiring Soon: ${site.name}`
  const html = emailLayout(`
    <h2 style="color:${urgent ? '#ef4444' : '#f59e0b'};margin:0 0 16px;">SSL Certificate Expiring in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}</h2>
    <p style="color:#475569;font-size:15px;margin:0 0 24px;">
      The SSL certificate for <strong>${site.name}</strong> will expire soon.<br/>
      URL: <a href="${site.url}" style="color:#3b82f6;">${site.url}</a><br/>
      Expires in: <strong style="color:${urgent ? '#ef4444' : '#f59e0b'};">${daysLeft} days</strong>
    </p>
    <p style="color:#475569;font-size:14px;">Please renew your SSL certificate immediately to avoid security warnings.</p>
    <table cellpadding="0" cellspacing="0"><tr><td>
      <a href="${APP_URL}/monitoring/${site.id}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;">View Details</a>
    </td></tr></table>
  `)
  await sendToEmails(site.alert_emails, subject, html)
}

export async function sendDomainAlert(site: MonitoredWebsite, daysLeft: number) {
  if (!site.alert_on_domain_expiry || !site.alert_emails.length) return
  const urgent = daysLeft <= 7
  const subject = `${urgent ? '🚨' : '⚠️'} Domain Expiring Soon: ${site.name}`
  const html = emailLayout(`
    <h2 style="color:${urgent ? '#ef4444' : '#f59e0b'};margin:0 0 16px;">Domain Expiring in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}</h2>
    <p style="color:#475569;font-size:15px;margin:0 0 24px;">
      The domain for <strong>${site.name}</strong> will expire soon.<br/>
      URL: <a href="${site.url}" style="color:#3b82f6;">${site.url}</a><br/>
      Expires in: <strong style="color:${urgent ? '#ef4444' : '#f59e0b'};">${daysLeft} days</strong>
    </p>
    <p style="color:#475569;font-size:14px;">Renew your domain through your registrar to avoid losing it.</p>
    <table cellpadding="0" cellspacing="0"><tr><td>
      <a href="${APP_URL}/monitoring/${site.id}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;">View Details</a>
    </td></tr></table>
  `)
  await sendToEmails(site.alert_emails, subject, html)
}

export async function sendSlowLoadAlert(site: MonitoredWebsite, loadTimeMs: number) {
  if (!site.alert_on_slow_load || !site.alert_emails.length) return
  const subject = `⚡ Slow Response Detected: ${site.name}`
  const html = emailLayout(`
    <h2 style="color:#f59e0b;margin:0 0 16px;">Slow Response Time Detected</h2>
    <p style="color:#475569;font-size:15px;margin:0 0 24px;">
      <strong>${site.name}</strong> is responding slowly.<br/>
      URL: <a href="${site.url}" style="color:#3b82f6;">${site.url}</a><br/>
      Response time: <strong style="color:#f59e0b;">${(loadTimeMs / 1000).toFixed(2)}s</strong>
      (threshold: ${(site.slow_load_threshold_ms / 1000).toFixed(1)}s)
    </p>
    <table cellpadding="0" cellspacing="0"><tr><td>
      <a href="${APP_URL}/monitoring/${site.id}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;">View Details</a>
    </td></tr></table>
  `)
  await sendToEmails(site.alert_emails, subject, html)
}
