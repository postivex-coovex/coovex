export type EmailStage = 'welcome' | 'day2' | 'day5' | 'day14' | 'day30'

export interface ReengagementContext {
  name: string
  email: string
  businessName: string
  pendingSignals: number
  setupPct: number
  newLeads: number
  stage: EmailStage
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.coovex.com'

const STAGE_META: Record<EmailStage, {
  subject: string
  preheader: string
  headline: string
  body: string[]
  cta: string
  ctaUrl: string
  tone: 'welcome' | 'curious' | 'urgent' | 'last_chance' | 'winback'
}> = {
  welcome: {
    subject: 'Welcome to CooVex — get started in 10 minutes',
    preheader: 'Your AI business agent is ready. Here\'s how to unlock everything.',
    headline: 'Your AI agent is ready to work.',
    body: [
      'CooVex is now monitoring your business 24/7 — generating leads, scanning competitors, and surfacing insights while you focus on running your company.',
      'To get the most out of it, complete these 3 steps first:',
    ],
    cta: 'Go to Dashboard →',
    ctaUrl: `${APP_URL}/dashboard`,
    tone: 'welcome',
  },
  day2: {
    subject: 'Your AI agent found something while you were away',
    preheader: 'New signals, insights, and opportunities are waiting in your inbox.',
    headline: 'Your agent has been working.',
    body: [
      'While you were away, your AI agent has been scanning your leads, competitors, and market for signals that need your attention.',
      'A few things have come up that you should review today.',
    ],
    cta: 'See what AI found →',
    ctaUrl: `${APP_URL}/dashboard`,
    tone: 'curious',
  },
  day5: {
    subject: 'You\'re leaving AI power on the table',
    preheader: 'Your setup is incomplete — these features are still locked.',
    headline: 'Most of your AI features are still locked.',
    body: [
      'CooVex can automatically score your leads, track competitors, and generate content — but only when your setup is complete.',
      'Here\'s what\'s holding back your AI agent right now:',
    ],
    cta: 'Complete my setup →',
    ctaUrl: `${APP_URL}/dashboard`,
    tone: 'urgent',
  },
  day14: {
    subject: 'Your business insights are getting stale',
    preheader: 'Two weeks of data. Let\'s look at what your AI has been tracking.',
    headline: 'Two weeks of insights. One click to see them.',
    body: [
      'Your AI agent has continued monitoring your business — tracking leads, competitor moves, and market signals.',
      'Don\'t let another week go by without acting on what it found.',
    ],
    cta: 'View my insights →',
    ctaUrl: `${APP_URL}/dashboard`,
    tone: 'last_chance',
  },
  day30: {
    subject: 'It\'s been a month — a lot has changed in CooVex',
    preheader: 'New features, smarter AI, and your business data is still here.',
    headline: 'We\'ve been busy. Come see what\'s new.',
    body: [
      'A month is a long time in business. While you were away, we\'ve shipped new features — smarter signal generation, better lead scoring, and a redesigned dashboard.',
      'Your business data is still here, and your AI agent is ready to pick up where you left off.',
    ],
    cta: 'See what\'s new →',
    ctaUrl: `${APP_URL}/dashboard`,
    tone: 'winback',
  },
}

const SETUP_STEPS = [
  { icon: '🔍', label: 'Run your first website audit', url: '/audit' },
  { icon: '📦', label: 'Add your products & services', url: '/products' },
  { icon: '🎯', label: 'Find your first leads with AI', url: '/leads' },
]

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

export function buildReengagementEmail(ctx: ReengagementContext): {
  subject: string
  html: string
  text: string
} {
  const { name, businessName, pendingSignals, setupPct, newLeads, stage } = ctx
  const meta = STAGE_META[stage]
  const firstName = name?.split(' ')[0] || 'there'

  const showStats   = ['day2', 'day14'].includes(stage)
  const showSetup   = ['welcome', 'day5'].includes(stage)
  const showWinback = stage === 'day30'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${meta.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <div style="display:none;max-height:0;overflow:hidden;color:#f1f5f9;">${meta.preheader}</div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

      <!-- Logo -->
      <tr><td style="padding-bottom:24px;text-align:center;">
        ${LOGO_HTML}
      </td></tr>

      <!-- Main card -->
      <tr><td style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;padding:36px;">

        <p style="margin:0 0 6px;color:#64748b;font-size:13px;">Hi ${firstName},</p>
        <h1 style="margin:0 0 14px;color:#0f172a;font-size:21px;font-weight:700;line-height:1.35;">${meta.headline}</h1>

        ${meta.body.map(p => `<p style="margin:0 0 14px;color:#475569;font-size:14px;line-height:1.7;">${p}</p>`).join('')}

        <!-- STATS block (day2, day14) -->
        ${showStats ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 28px;">
          <tr>
            <td width="33%" style="padding-right:6px;">
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center;">
                <p style="margin:0 0 2px;color:#2563eb;font-size:22px;font-weight:700;">${pendingSignals}</p>
                <p style="margin:0;color:#64748b;font-size:11px;">Pending signals</p>
              </div>
            </td>
            <td width="33%" style="padding:0 3px;">
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center;">
                <p style="margin:0 0 2px;color:#059669;font-size:22px;font-weight:700;">${newLeads}</p>
                <p style="margin:0;color:#64748b;font-size:11px;">New leads (7d)</p>
              </div>
            </td>
            <td width="33%" style="padding-left:6px;">
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center;">
                <p style="margin:0 0 2px;color:${setupPct >= 80 ? '#059669' : setupPct >= 40 ? '#d97706' : '#dc2626'};font-size:22px;font-weight:700;">${setupPct}%</p>
                <p style="margin:0;color:#64748b;font-size:11px;">Setup done</p>
              </div>
            </td>
          </tr>
        </table>` : ''}

        <!-- SETUP STEPS (welcome, day5) -->
        ${showSetup ? `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:20px 0 28px;">
          <p style="margin:0 0 12px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">Start here</p>
          ${SETUP_STEPS.map((s, i) => `
          <a href="${APP_URL}${s.url}" style="display:block;text-decoration:none;padding:10px 0;${i < SETUP_STEPS.length - 1 ? 'border-bottom:1px solid #e2e8f0;' : ''}">
            <table cellpadding="0" cellspacing="0" width="100%"><tr>
              <td style="width:28px;font-size:16px;">${s.icon}</td>
              <td style="color:#0f172a;font-size:13px;font-weight:500;">${s.label}</td>
              <td style="color:#7c3aed;font-size:13px;text-align:right;">→</td>
            </tr></table>
          </a>`).join('')}
          ${setupPct > 0 ? `
          <div style="margin-top:14px;">
            <div style="background:#e2e8f0;border-radius:99px;height:4px;overflow:hidden;">
              <div style="background:#7c3aed;height:4px;width:${setupPct}%;border-radius:99px;"></div>
            </div>
            <p style="margin:6px 0 0;color:#64748b;font-size:11px;">${setupPct}% complete — ${businessName}</p>
          </div>` : ''}
        </div>` : ''}

        <!-- WIN-BACK new features (day30) -->
        ${showWinback ? `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:20px 0 28px;">
          <p style="margin:0 0 12px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">What's new</p>
          ${[
            { icon: '🎯', text: 'Smarter lead scoring with AI-powered signals' },
            { icon: '📊', text: 'Redesigned dashboard with Today\'s Focus tasks' },
            { icon: '🏆', text: 'Competitive Intelligence Matrix with real benchmarks' },
          ].map((f, i, arr) => `
          <table cellpadding="0" cellspacing="0" width="100%" style="${i < arr.length - 1 ? 'border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin-bottom:10px;' : ''}"><tr>
            <td style="width:28px;font-size:16px;">${f.icon}</td>
            <td style="color:#475569;font-size:13px;">${f.text}</td>
          </tr></table>`).join('')}
        </div>` : ''}

        <!-- CTA Button -->
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
          <a href="${meta.ctaUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;">
            ${meta.cta}
          </a>
        </td></tr></table>

        <p style="margin:20px 0 0;color:#94a3b8;font-size:11px;text-align:center;">
          For: ${businessName}
        </p>

      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:22px 0 0;text-align:center;">
        <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.8;">
          © ${new Date().getFullYear()} CooVex · You signed up with this email address.<br />
          <a href="${APP_URL}/settings/notifications" style="color:#7c3aed;text-decoration:none;">Manage email preferences</a>
          &nbsp;·&nbsp;
          <a href="${APP_URL}/settings/notifications?unsubscribe=1" style="color:#94a3b8;text-decoration:none;">Unsubscribe</a>
        </p>
      </td></tr>

    </table>
    </td></tr>
  </table>
</body>
</html>`

  const text = `Hi ${firstName},

${meta.headline}

${meta.body.join('\n\n')}

${showStats ? `Pending signals: ${pendingSignals} | New leads (7d): ${newLeads} | Setup: ${setupPct}%\n` : ''}
${showSetup ? `Start here:\n${SETUP_STEPS.map(s => `  ${s.icon} ${s.label} → ${APP_URL}${s.url}`).join('\n')}\n` : ''}

${meta.cta}
${meta.ctaUrl}

---
CooVex — AI Business Agent
Manage preferences: ${APP_URL}/settings/notifications`

  return { subject: meta.subject, html, text }
}
