import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'CooVex <noreply@coovex.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.coovex.com'

const isConfigured = !!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your_resend_api_key'

// ─── Send helpers ───────────────────────────────────────────────────────────

async function send(to: string, subject: string, html: string) {
  if (!isConfigured) {
    console.log(`[email] NOT CONFIGURED — would send "${subject}" to ${to}`)
    return { ok: true, mock: true }
  }
  const { data, error } = await resend.emails.send({ from: FROM, to, subject, html })
  if (error) {
    console.error('[email] send error:', error)
    return { ok: false, error }
  }
  return { ok: true, id: data?.id }
}

// ─── Email templates ─────────────────────────────────────────────────────────

const LOGO_HTML = `
  <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr>
      <td style="vertical-align:middle;padding-right:10px;">
        <img src="${APP_URL}/logo.png" alt="CooVex" width="40" height="40" style="display:block;border:0;" />
      </td>
      <td style="vertical-align:middle;">
        <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">
          <span style="color:#3b82f6;">Coo</span><span style="color:#22c55e;">Vex</span>
        </span>
      </td>
    </tr>
  </table>`

function baseLayout(content: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

      <!-- Logo -->
      <tr><td style="padding-bottom:24px;text-align:center;">
        ${LOGO_HTML}
      </td></tr>

      <!-- Card -->
      <tr><td style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
        <div style="padding:36px;">
          ${content}
        </div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:24px 0;text-align:center;">
        <p style="color:#94a3b8;font-size:12px;margin:0;line-height:1.8;">
          © ${new Date().getFullYear()} CooVex · AI Business Agent<br/>
          <a href="${APP_URL}/settings/notifications" style="color:#7c3aed;text-decoration:none;">Manage preferences</a>
          &nbsp;·&nbsp;
          <a href="${APP_URL}/settings/notifications?unsubscribe=1" style="color:#94a3b8;text-decoration:none;">Unsubscribe</a>
        </p>
      </td></tr>

    </table>
    </td></tr>
  </table>
</body>
</html>`
}

function btn(text: string, href: string, color = '#7c3aed') {
  return `<table cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr><td>
    <a href="${href}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;">${text}</a>
  </td></tr></table>`
}

function h1(text: string) {
  return `<h1 style="color:#0f172a;font-size:22px;font-weight:700;margin:0 0 10px;line-height:1.3;">${text}</h1>`
}

function p(text: string) {
  return `<p style="color:#475569;font-size:15px;line-height:1.7;margin:10px 0;">${text}</p>`
}

// ─── Public email functions ───────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string) {
  const html = baseLayout(`
    ${h1(`Welcome to CooVex, ${name}!`)}
    ${p('Your AI Business Agent is ready. It will monitor your business 24/7 — tracking signals, scoring leads, and helping you grow.')}
    ${p('Start by completing your business profile so the agent knows your goals.')}
    ${btn('Open Dashboard', `${APP_URL}/dashboard`)}
    <div style="margin-top:28px;padding:18px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
      <p style="color:#64748b;font-size:12px;font-weight:600;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.05em;">What the agent does automatically:</p>
      <p style="color:#7c3aed;font-size:14px;margin:6px 0;">✦ Morning business brief every day at 6am</p>
      <p style="color:#7c3aed;font-size:14px;margin:6px 0;">✦ Lead scoring &amp; pipeline alerts</p>
      <p style="color:#7c3aed;font-size:14px;margin:6px 0;">✦ Review monitoring &amp; response drafts</p>
    </div>
  `)
  return send(to, 'Welcome to CooVex — your AI agent is ready', html)
}

export async function sendInviteEmail(to: string, inviterName: string, workspaceName: string, inviteUrl: string) {
  const html = baseLayout(`
    ${h1('You have been invited!')}
    ${p(`<strong style="color:#0f172a;">${inviterName}</strong> has invited you to join <strong style="color:#0f172a;">${workspaceName}</strong> on CooVex.`)}
    ${p('CooVex is an AI-powered business growth agent that runs 24/7 — monitoring signals, tracking leads, and generating content.')}
    ${btn('Accept Invitation', inviteUrl, '#059669')}
    <p style="color:#94a3b8;font-size:12px;margin-top:20px;">This invitation expires in 7 days. If you did not expect this email, you can safely ignore it.</p>
  `)
  return send(to, `${inviterName} invited you to ${workspaceName} on CooVex`, html)
}

export async function sendReviewRequestEmail(to: string, customerName: string, businessName: string, reviewUrl?: string) {
  const link = reviewUrl ?? `https://search.google.com/search?q=${encodeURIComponent(businessName)}+reviews`
  const html = baseLayout(`
    ${h1(`How was your experience with ${businessName}?`)}
    ${p(`Hi ${customerName},`)}
    ${p(`Thank you for choosing <strong style="color:#e2e8f0">${businessName}</strong>. We hope you had a great experience!`)}
    ${p('We\'d really appreciate it if you could take 2 minutes to leave us a review. Your feedback helps us serve you and others better.')}
    ${btn('Leave a Review ⭐', link, '#f59e0b')}
    <p style="color:#475569;font-size:12px;margin-top:20px">It only takes 2 minutes and means the world to us. Thank you!</p>
  `)
  return send(to, `How was your experience with ${businessName}? Leave a review ⭐`, html)
}

export async function sendDailyBriefEmail(to: string, name: string, brief: {
  summary: string; signals: number; leads: number; healthScore: number
  auditTasks?: { title: string; priority: string }[]
  geoScore?: number; perfScore?: number
  pendingBlogTasks?: { title: string; body: string; daysOld: number }[]
}) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const html = baseLayout(`
    ${h1(`Good morning, ${name}! ☀️`)}
    <p style="color:#64748b;font-size:13px;margin:0 0 20px">${today}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="background:#f8fafc;border-radius:10px;padding:14px 16px;border:1px solid #e2e8f0;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="color:#64748b;font-size:13px;">New Signals</td>
            <td style="text-align:right;color:#7c3aed;font-size:20px;font-weight:700;">${brief.signals}</td>
          </tr></table>
        </td>
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td style="background:#f8fafc;border-radius:10px;padding:14px 16px;border:1px solid #e2e8f0;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="color:#64748b;font-size:13px;">New Leads</td>
            <td style="text-align:right;color:#059669;font-size:20px;font-weight:700;">${brief.leads}</td>
          </tr></table>
        </td>
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td style="background:#f8fafc;border-radius:10px;padding:14px 16px;border:1px solid #e2e8f0;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="color:#64748b;font-size:13px;">Health Score</td>
            <td style="text-align:right;color:${brief.healthScore >= 70 ? '#059669' : '#d97706'};font-size:20px;font-weight:700;">${brief.healthScore}/100</td>
          </tr></table>
        </td>
      </tr>
    </table>
    <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:18px;margin-bottom:24px;">
      <p style="color:#7c3aed;font-size:13px;font-weight:700;margin:0 0 8px;">Agent Summary</p>
      <p style="color:#475569;font-size:14px;line-height:1.7;margin:0;">${brief.summary}</p>
    </div>
    ${brief.auditTasks?.length ? `
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:18px;margin-bottom:24px;">
      <p style="color:#c2410c;font-size:13px;font-weight:700;margin:0 0 4px;">⚠️ Pending Website Improvements</p>
      <p style="color:#9a3412;font-size:12px;margin:0 0 14px;">
        ${brief.geoScore !== undefined ? `GEO Score: <strong>${brief.geoScore}/100</strong>` : ''}
        ${brief.perfScore !== undefined ? ` · Performance: <strong>${brief.perfScore}/100</strong>` : ''}
        — Fix these to improve AI discoverability &amp; site performance.
      </p>
      ${brief.auditTasks.map(t => `
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
          <span style="flex-shrink:0;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;background:${t.priority === 'critical' ? '#fee2e2' : t.priority === 'high' ? '#fef3c7' : '#f1f5f9'};color:${t.priority === 'critical' ? '#991b1b' : t.priority === 'high' ? '#92400e' : '#64748b'};">${t.priority}</span>
          <span style="color:#1e293b;font-size:13px;line-height:1.5;">${t.title}</span>
        </div>
      `).join('')}
      <a href="${APP_URL}/audit" style="display:inline-block;margin-top:8px;color:#c2410c;font-size:12px;font-weight:600;text-decoration:underline;">Fix with AI Agent →</a>
    </div>
    ` : ''}
    ${brief.pendingBlogTasks?.length ? `
    <div style="background:#fdf4ff;border:1px solid #e9d5ff;border-radius:10px;padding:18px;margin-bottom:24px;">
      <p style="color:#7e22ce;font-size:13px;font-weight:700;margin:0 0 4px;">📝 Pending Content Tasks</p>
      <p style="color:#6b21a8;font-size:12px;margin:0 0 14px;">These content gaps are hurting your SEO &amp; AI discoverability.</p>
      ${brief.pendingBlogTasks.map(t => `
        <div style="border-left:3px solid ${t.daysOld >= 3 ? '#dc2626' : '#7c3aed'};padding:10px 14px;margin-bottom:10px;background:${t.daysOld >= 3 ? '#fef2f2' : '#faf5ff'};border-radius:0 8px 8px 0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            ${t.daysOld >= 3 ? `<span style="background:#fee2e2;color:#991b1b;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;text-transform:uppercase;">🔴 ${t.daysOld} days pending</span>` : `<span style="background:#ede9fe;color:#6d28d9;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;text-transform:uppercase;">Pending</span>`}
          </div>
          <p style="color:#1e293b;font-size:13px;font-weight:600;margin:0 0 3px;">${t.title.replace('[Blog] ', '')}</p>
          <p style="color:#64748b;font-size:12px;margin:0;line-height:1.5;">${t.body}</p>
        </div>
      `).join('')}
      <a href="${APP_URL}/content" style="display:inline-block;margin-top:8px;color:#7c3aed;font-size:12px;font-weight:600;text-decoration:underline;">Open Content Generator →</a>
    </div>
    ` : ''}
    ${btn('Open Dashboard', `${APP_URL}/dashboard`)}
  `)
  return send(to, `Your CooVex daily brief — ${today}`, html)
}

export async function sendWeeklyReportEmail(to: string, name: string, stats: { won: number; leads: number; reviews: number; healthScore: number }) {
  const html = baseLayout(`
    ${h1('Your Weekly Business Report 📊')}
    ${p(`Here's what happened in your business this week, ${name}:`)}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td style="padding:14px 16px;background:#f8fafc;border-radius:10px 10px 0 0;border:1px solid #e2e8f0;color:#64748b;font-size:13px;">Won Deals</td>
        <td style="padding:14px 16px;background:#f8fafc;border-radius:10px 10px 0 0;border:1px solid #e2e8f0;border-left:none;color:#059669;font-size:18px;font-weight:700;text-align:right;">${stats.won}</td>
      </tr>
      <tr><td colspan="2" style="height:4px;background:#ffffff;"></td></tr>
      <tr>
        <td style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;font-size:13px;">New Leads</td>
        <td style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-left:none;color:#7c3aed;font-size:18px;font-weight:700;text-align:right;">${stats.leads}</td>
      </tr>
      <tr><td colspan="2" style="height:4px;background:#ffffff;"></td></tr>
      <tr>
        <td style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;font-size:13px;">Reviews Received</td>
        <td style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-left:none;color:#d97706;font-size:18px;font-weight:700;text-align:right;">${stats.reviews}</td>
      </tr>
      <tr><td colspan="2" style="height:4px;background:#ffffff;"></td></tr>
      <tr>
        <td style="padding:14px 16px;background:#f8fafc;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;color:#64748b;font-size:13px;">Health Score</td>
        <td style="padding:14px 16px;background:#f8fafc;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-left:none;color:${stats.healthScore >= 70 ? '#059669' : '#d97706'};font-size:18px;font-weight:700;text-align:right;">${stats.healthScore}/100</td>
      </tr>
    </table>
    ${btn('View Full Report', `${APP_URL}/reports`)}
  `)
  return send(to, 'Your CooVex weekly business report 📊', html)
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const html = baseLayout(`
    ${h1('Reset your password')}
    ${p('We received a request to reset your CooVex password. Click the button below to choose a new one.')}
    ${btn('Reset Password', resetUrl, '#dc2626')}
    <p style="color:#475569;font-size:12px;margin-top:20px">This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
  `)
  return send(to, 'Reset your CooVex password', html)
}

// ── Integration Service Emails ───────────────────────────────────────────────

export async function sendIntegrationInquiryEmail(opts: {
  to: string
  inquiryId: string
  name: string
  email: string
  service_type: string
  description: string
  budget: string
  businessName: string
}) {
  const { inquiryId, name, email, service_type, description, budget, businessName } = opts
  const adminUrl = `${APP_URL}/admin/inquiries`
  const html = baseLayout(`
    ${h1('New Integration Service Inquiry 🔧')}
    ${p('A user has submitted an integration service request and is waiting for a budget proposal.')}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-collapse:collapse;">
      <tr><td style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px 8px 0 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Inquiry #${inquiryId.slice(-8).toUpperCase()}</td></tr>
      <tr>
        <td style="padding:14px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;">
          <p style="margin:0 0 8px;color:#0f172a;font-size:14px;"><strong>Name:</strong> ${name}</p>
          <p style="margin:0 0 8px;color:#0f172a;font-size:14px;"><strong>Email:</strong> <a href="mailto:${email}" style="color:#7c3aed;">${email}</a></p>
          <p style="margin:0 0 8px;color:#0f172a;font-size:14px;"><strong>Business:</strong> ${businessName}</p>
          <p style="margin:0 0 8px;color:#0f172a;font-size:14px;"><strong>Service Needed:</strong> ${service_type}</p>
          <p style="margin:0 0 8px;color:#0f172a;font-size:14px;"><strong>Budget:</strong> ${budget}</p>
          <p style="margin:12px 0 4px;color:#475569;font-size:13px;font-weight:600;">Description:</p>
          <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;background:#f8fafc;padding:10px;border-radius:6px;border-left:3px solid #7c3aed;">${description}</p>
        </td>
      </tr>
    </table>
    ${btn('View in Admin Panel', adminUrl, '#2563eb')}
    <p style="color:#94a3b8;font-size:12px;margin-top:20px;text-align:center;">Reply directly to <a href="mailto:${email}" style="color:#7c3aed;">${email}</a> or open the admin panel to send a proposal.</p>
  `)
  return send(opts.to, `New Integration Inquiry: ${service_type} — ${name}`, html)
}

export async function sendInquiryConfirmationEmail(opts: {
  to: string
  name: string
  service_type: string
}) {
  const { name, service_type } = opts
  const html = baseLayout(`
    ${h1(`Thanks, ${name}! We received your inquiry.`)}
    ${p(`Your request for <strong>${service_type}</strong> integration has been received. Our team will review it and send you a detailed budget proposal within <strong>24 hours</strong>.`)}
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin:20px 0;">
      <p style="color:#166534;font-size:14px;margin:0;font-weight:600;">What happens next:</p>
      <p style="color:#166534;font-size:13px;margin:8px 0 0;line-height:1.7;">
        1. We review your requirements<br/>
        2. We prepare a custom proposal with timeline and cost<br/>
        3. You receive the proposal by email within 24h<br/>
        4. We schedule a quick call to discuss details
      </p>
    </div>
    ${p('In the meantime, you can explore CooVex and connect any integrations yourself from your Settings page.')}
    ${btn('Go to Settings', `${APP_URL}/settings/integrations`)}
  `)
  return send(opts.to, 'We received your integration inquiry — proposal coming soon', html)
}

export async function sendNewLeadAlertEmail(to: string, ownerName: string, lead: {
  id: string
  name: string
  email?: string | null
  company?: string | null
  source?: string | null
  score?: number | null
}) {
  const sourceLabel: Record<string, string> = {
    website_form: 'Website Form', linkedin: 'LinkedIn', facebook: 'Facebook',
    google_ads: 'Google Ads', referral: 'Referral', manual: 'Manual', email: 'Email', other: 'Other',
  }
  const leadUrl = `${APP_URL}/leads/${lead.id}`
  const html = baseLayout(`
    ${h1('🎯 New Lead Captured!')}
    ${p(`Hi ${ownerName}, a new lead has just been added to your CooVex pipeline.`)}
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;width:120px;">Name</td>
          <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${lead.name}</td>
        </tr>
        ${lead.company ? `<tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">Company</td>
          <td style="padding:6px 0;color:#0f172a;font-size:14px;">${lead.company}</td>
        </tr>` : ''}
        ${lead.email ? `<tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">Email</td>
          <td style="padding:6px 0;"><a href="mailto:${lead.email}" style="color:#7c3aed;font-size:14px;">${lead.email}</a></td>
        </tr>` : ''}
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">Source</td>
          <td style="padding:6px 0;color:#0f172a;font-size:14px;">${sourceLabel[lead.source ?? ''] ?? lead.source ?? 'Unknown'}</td>
        </tr>
        ${lead.score != null ? `<tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">AI Score</td>
          <td style="padding:6px 0;color:#7c3aed;font-size:14px;font-weight:700;">${lead.score}/100</td>
        </tr>` : ''}
      </table>
    </div>
    ${p('Follow up fast — leads contacted within 1 hour are 7× more likely to convert.')}
    ${btn('View Lead', leadUrl, '#7c3aed')}
  `)
  return send(to, `🎯 New Lead: ${lead.name}${lead.company ? ` — ${lead.company}` : ''}`, html)
}

export async function sendNewReviewAlertEmail(to: string, ownerName: string, review: {
  id: string
  platform?: string | null
  rating?: number | null
  reviewer_name?: string | null
  body?: string | null
  business_name: string
}) {
  const stars = '⭐'.repeat(Math.min(5, Math.max(0, review.rating ?? 0)))
  const reviewUrl = `${APP_URL}/reviews`
  const isPositive = (review.rating ?? 0) >= 4
  const html = baseLayout(`
    ${h1(`${isPositive ? '⭐' : '⚠️'} New ${review.platform ?? 'Review'} Review`)}
    ${p(`Hi ${ownerName}, <strong>${review.reviewer_name ?? 'A customer'}</strong> left a ${review.rating ?? '?'}-star review for <strong>${review.business_name}</strong>.`)}
    <div style="background:${isPositive ? '#f0fdf4' : '#fff7ed'};border:1px solid ${isPositive ? '#bbf7d0' : '#fed7aa'};border-radius:12px;padding:20px;margin:20px 0;">
      <p style="color:${isPositive ? '#166534' : '#c2410c'};font-size:18px;margin:0 0 10px;">${stars}</p>
      ${review.body ? `<p style="color:#374151;font-size:14px;line-height:1.7;margin:0;font-style:italic;">"${review.body}"</p>` : '<p style="color:#9ca3af;font-size:13px;margin:0;">No review text.</p>'}
    </div>
    ${p(isPositive ? 'Great review! Reply to thank them — it builds loyalty and signals care to future customers.' : 'Respond promptly and professionally — how you handle negative reviews defines your brand reputation.')}
    ${btn('Respond Now', reviewUrl, isPositive ? '#059669' : '#dc2626')}
  `)
  const subject = isPositive
    ? `⭐ New ${review.rating}-star review from ${review.reviewer_name ?? 'a customer'} on ${review.platform ?? 'review site'}`
    : `⚠️ New ${review.rating}-star review needs your response`
  return send(to, subject, html)
}

export async function sendCompetitorAlertEmail(to: string, ownerName: string, opts: {
  competitorName: string
  changes: string[]
  businessId: string
}) {
  const url = `${APP_URL}/competitors`
  const changeItems = opts.changes.map(c => `<li style="color:#374151;font-size:14px;margin:4px 0;">${c}</li>`).join('')
  const html = baseLayout(`
    ${h1(`👁️ Competitor Activity: ${opts.competitorName}`)}
    ${p(`Hi ${ownerName}, we detected new activity from <strong>${opts.competitorName}</strong>.`)}
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0;">
      <ul style="margin:0;padding-left:20px;">
        ${changeItems}
      </ul>
    </div>
    ${p('Stay ahead — review their changes and consider how to differentiate your offering.')}
    ${btn('View Competitor Intel', url, '#0ea5e9')}
  `)
  return send(to, `👁️ ${opts.competitorName} just updated — competitor alert`, html)
}

export async function sendProposalEmail(opts: {
  to: string
  name: string
  service_type: string
  proposal: string
}) {
  const { name, service_type, proposal } = opts
  const html = baseLayout(`
    ${h1(`Your Integration Proposal is Ready, ${name}!`)}
    ${p(`Here is your custom budget proposal for <strong>${service_type}</strong>:`)}
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:20px 0;white-space:pre-line;color:#0f172a;font-size:14px;line-height:1.8;">
      ${proposal.replace(/\n/g, '<br/>')}
    </div>
    ${p('If you have any questions or want to discuss, reply to this email or contact us directly.')}
    ${btn('Go to CooVex', APP_URL)}
  `)
  return send(opts.to, `Your CooVex Integration Proposal — ${service_type}`, html)
}
