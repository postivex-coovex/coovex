const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.coovex.com'

export interface WeeklyDigestContext {
  name: string
  businessName: string
  weekOf: string
  stats: {
    newLeads: number
    signals: number
    postsCreated: number
    reviewsNew: number
    proposalsSent: number
    dealsOpen: number
    pipelineValue: number
  }
  topSignal?: string
  healthScore: number
}

export function buildWeeklyDigestEmail(ctx: WeeklyDigestContext): {
  subject: string
  html: string
  text: string
} {
  const { name, businessName, weekOf, stats, topSignal, healthScore } = ctx
  const firstName = name?.split(' ')[0] || 'there'

  const subject = `${businessName} — weekly recap (${weekOf})`

  const statItems = [
    { icon: '🎯', label: 'New Leads',     value: stats.newLeads,      color: '#059669' },
    { icon: '🧠', label: 'AI Signals',    value: stats.signals,       color: '#2563eb' },
    { icon: '✍️', label: 'Posts Created', value: stats.postsCreated,  color: '#7c3aed' },
    { icon: '⭐', label: 'New Reviews',   value: stats.reviewsNew,    color: '#d97706' },
    { icon: '📄', label: 'Proposals',     value: stats.proposalsSent, color: '#0891b2' },
    { icon: '💼', label: 'Open Deals',    value: stats.dealsOpen,     color: '#db2777' },
  ]

  const scoreColor = healthScore >= 70 ? '#059669' : healthScore >= 40 ? '#d97706' : '#dc2626'

  const LOGO_HTML = `
    <table cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:middle;padding-right:9px;">
          <img src="${APP_URL}/logo.png" alt="CooVex" width="36" height="36" style="display:block;border:0;" />
        </td>
        <td style="vertical-align:middle;">
          <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;">
            <span style="color:#3b82f6;">Coo</span><span style="color:#22c55e;">Vex</span>
          </span>
        </td>
      </tr>
    </table>`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <div style="display:none;max-height:0;overflow:hidden;color:#f1f5f9;">Your AI agent worked all week. Here's what happened.</div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

      <!-- Logo -->
      <tr><td style="padding-bottom:24px;text-align:center;">
        ${LOGO_HTML}
      </td></tr>

      <!-- Card -->
      <tr><td style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;padding:36px;">

        <p style="margin:0 0 6px;color:#64748b;font-size:13px;">Hi ${firstName},</p>
        <h1 style="margin:0 0 6px;color:#0f172a;font-size:20px;font-weight:700;line-height:1.3;">Here's your week in review.</h1>
        <p style="margin:0 0 24px;color:#64748b;font-size:13px;">Your AI agent was running 24/7 for <strong style="color:#0f172a;">${businessName}</strong>. Week of ${weekOf}.</p>

        <!-- Health score banner -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="color:#64748b;font-size:13px;">Business Health Score</td>
            <td style="text-align:right;">
              <span style="color:${scoreColor};font-size:18px;font-weight:700;">${healthScore}/100</span>
              <span style="color:#94a3b8;font-size:11px;margin-left:6px;">${healthScore >= 70 ? '↑ Good' : healthScore >= 40 ? '→ Fair' : '↓ Needs work'}</span>
            </td>
          </tr></table>
        </div>

        <!-- Stats grid (2 cols) -->
        <p style="margin:0 0 10px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">This week</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          ${[0, 1, 2].map(row => `
          <tr>
            <td width="50%" style="padding:4px 4px 4px 0;">
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;">
                <table cellpadding="0" cellspacing="0" width="100%"><tr>
                  <td style="font-size:15px;width:22px;">${statItems[row * 2].icon}</td>
                  <td style="color:#64748b;font-size:12px;padding-left:7px;">${statItems[row * 2].label}</td>
                  <td style="text-align:right;color:${statItems[row * 2].color};font-size:18px;font-weight:700;">${statItems[row * 2].value}</td>
                </tr></table>
              </div>
            </td>
            <td width="50%" style="padding:4px 0 4px 4px;">
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;">
                <table cellpadding="0" cellspacing="0" width="100%"><tr>
                  <td style="font-size:15px;width:22px;">${statItems[row * 2 + 1].icon}</td>
                  <td style="color:#64748b;font-size:12px;padding-left:7px;">${statItems[row * 2 + 1].label}</td>
                  <td style="text-align:right;color:${statItems[row * 2 + 1].color};font-size:18px;font-weight:700;">${statItems[row * 2 + 1].value}</td>
                </tr></table>
              </div>
            </td>
          </tr>`).join('')}
        </table>

        ${stats.pipelineValue > 0 ? `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-left:3px solid #2563eb;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:20px;">
          <p style="margin:0;color:#1e40af;font-size:13px;">Open pipeline value: <strong>$${stats.pipelineValue.toLocaleString()}</strong></p>
        </div>` : ''}

        ${topSignal ? `
        <div style="background:#faf5ff;border:1px solid #e9d5ff;border-left:3px solid #7c3aed;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:24px;">
          <p style="margin:0 0 4px;color:#7c3aed;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Top AI insight this week</p>
          <p style="margin:0;color:#475569;font-size:13px;">${topSignal}</p>
        </div>` : ''}

        <!-- CTA -->
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
          <a href="${APP_URL}/dashboard" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;">
            View full dashboard →
          </a>
        </td></tr></table>

        <p style="margin:20px 0 0;color:#94a3b8;font-size:11px;text-align:center;">Next week's report will arrive on Monday morning.</p>

      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:22px 0 0;text-align:center;">
        <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.8;">
          © ${new Date().getFullYear()} CooVex · Weekly digest for ${businessName}<br />
          <a href="${APP_URL}/settings/notifications" style="color:#7c3aed;text-decoration:none;">Manage preferences</a>
          &nbsp;·&nbsp;
          <a href="${APP_URL}/settings/notifications?unsubscribe=weekly=1" style="color:#94a3b8;text-decoration:none;">Unsubscribe</a>
        </p>
      </td></tr>

    </table>
    </td></tr>
  </table>
</body>
</html>`

  const text = `Hi ${firstName},

Your week in review — ${businessName}
Week of ${weekOf}

Health Score: ${healthScore}/100

This week:
🎯 New Leads: ${stats.newLeads}
🧠 AI Signals: ${stats.signals}
✍️ Posts Created: ${stats.postsCreated}
⭐ New Reviews: ${stats.reviewsNew}
📄 Proposals: ${stats.proposalsSent}
💼 Open Deals: ${stats.dealsOpen}
${stats.pipelineValue > 0 ? `💰 Pipeline Value: $${stats.pipelineValue.toLocaleString()}` : ''}
${topSignal ? `\nTop insight: ${topSignal}` : ''}

View dashboard: ${APP_URL}/dashboard

---
CooVex weekly digest · Unsubscribe: ${APP_URL}/settings/notifications`

  return { subject, html, text }
}
