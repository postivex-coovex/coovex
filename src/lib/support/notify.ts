// Notify property owner when a new support message arrives
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL || 'CooVex Support <noreply@coovex.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.coovex.com'

export async function notifyOwnerNewMessage(opts: {
  ownerEmail: string
  propertyName: string
  conversationId: string
  customerName: string | null
  customerEmail: string | null
  subject: string | null
  preview: string
  source: 'widget' | 'email' | 'api'
}) {
  const { ownerEmail, propertyName, conversationId, customerName, customerEmail, subject, preview, source } = opts
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'your_resend_api_key') return

  const from = customerName || customerEmail || 'Anonymous visitor'
  const sourceLabel = source === 'email' ? '📧 Email' : source === 'widget' ? '💬 Widget' : 'API'
  const link = `${APP_URL}/support/${conversationId}`

  await resend.emails.send({
    from: FROM,
    to: ownerEmail,
    subject: `[${propertyName}] New ${source} message from ${from}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <div style="background:#2563eb;border-radius:12px 12px 0 0;padding:20px 24px">
          <h2 style="color:white;margin:0;font-size:18px">New Support Message</h2>
          <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px">${propertyName} · ${sourceLabel}</p>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px;padding:24px">
          <table style="width:100%;margin-bottom:16px">
            <tr>
              <td style="color:#64748b;font-size:13px;padding:4px 0;width:80px">From</td>
              <td style="font-size:13px;font-weight:600;color:#1e293b">${from}${customerEmail ? ` &lt;${customerEmail}&gt;` : ''}</td>
            </tr>
            ${subject ? `<tr><td style="color:#64748b;font-size:13px;padding:4px 0">Subject</td><td style="font-size:13px;color:#1e293b">${subject}</td></tr>` : ''}
            <tr>
              <td style="color:#64748b;font-size:13px;padding:4px 0">Source</td>
              <td style="font-size:13px;color:#1e293b">${sourceLabel}</td>
            </tr>
          </table>
          <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin-bottom:20px">
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.6">${preview.slice(0, 300)}${preview.length > 300 ? '…' : ''}</p>
          </div>
          <a href="${link}"
            style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600">
            View &amp; Reply →
          </a>
          <p style="font-size:12px;color:#94a3b8;margin-top:20px">
            You are receiving this because you own the property <strong>${propertyName}</strong> on CooVex.<br>
            <a href="${APP_URL}/support/properties" style="color:#2563eb">Manage notification settings</a>
          </p>
        </div>
      </div>
    `,
  }).catch(() => { /* silent — don't fail the ingest */ })
}
