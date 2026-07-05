import nodemailer from 'nodemailer'

export interface EmailSettings {
  method: 'smtp' | 'gmail' | 'outlook' | 'resend' | 'coovex' | 'reply_to' | 'sendgrid' | 'mailgun' | 'brevo' | 'postmark'
  from_name?: string
  from_email?: string
  reply_to?: string
  // SMTP / Gmail / Outlook
  smtp_host?: string
  smtp_port?: number
  smtp_user?: string
  smtp_pass?: string
  smtp_secure?: boolean
  // Resend (user's own account)
  resend_api_key?: string
  resend_from_email?: string
  // SendGrid
  sendgrid_api_key?: string
  sendgrid_from_email?: string
  // Mailgun
  mailgun_api_key?: string
  mailgun_domain?: string
  mailgun_region?: 'us' | 'eu'
  // Brevo (smtp-relay with API key as password)
  brevo_api_key?: string
  brevo_login?: string
  brevo_from_email?: string
  // Postmark
  postmark_api_key?: string
  postmark_from_email?: string
  // CooVex subdomain
  coovex_subdomain?: string
}

export interface SendResult {
  ok: boolean
  error?: string
}

interface Envelope {
  to: string
  subject: string
  text: string
  html?: string
}

export async function sendEmail(env: Envelope, settings: EmailSettings): Promise<SendResult> {
  try {
    switch (settings.method) {
      case 'gmail':
        return await viaSMTP(env, settings, 'smtp.gmail.com', 587, false)
      case 'outlook':
        return await viaSMTP(env, settings, 'smtp.office365.com', 587, false)
      case 'smtp':
        return await viaSMTP(env, settings, settings.smtp_host!, settings.smtp_port ?? 587, settings.smtp_secure ?? false)
      case 'brevo':
        return await viaBrevo(env, settings)
      case 'sendgrid':
        return await viaSendGrid(env, settings)
      case 'mailgun':
        return await viaMailgun(env, settings)
      case 'postmark':
        return await viaPostmark(env, settings)
      case 'resend':
        return await viaResend(env, settings, settings.resend_api_key!, settings.resend_from_email || settings.from_email)
      case 'coovex': {
        const fromAddr = settings.coovex_subdomain
          ? `${settings.coovex_subdomain}@mail.coovex.com`
          : (process.env.RESEND_FROM_EMAIL || 'noreply@coovex.com')
        return await viaResend(env, settings, process.env.RESEND_API_KEY!, fromAddr)
      }
      case 'reply_to':
      default: {
        const fromAddr = process.env.RESEND_FROM_EMAIL || 'noreply@coovex.com'
        return await viaResend(env, settings, process.env.RESEND_API_KEY!, fromAddr)
      }
    }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

async function viaSMTP(
  env: Envelope,
  s: EmailSettings,
  host: string,
  port: number,
  secure: boolean,
): Promise<SendResult> {
  if (!s.smtp_user || !s.smtp_pass) return { ok: false, error: 'Email and password required' }
  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user: s.smtp_user, pass: s.smtp_pass } })
  await transporter.sendMail({
    from:    `${s.from_name || s.smtp_user} <${s.from_email || s.smtp_user}>`,
    to:      env.to,
    subject: env.subject,
    text:    env.text,
    html:    env.html,
    replyTo: s.reply_to,
  })
  return { ok: true }
}

async function viaBrevo(env: Envelope, s: EmailSettings): Promise<SendResult> {
  if (!s.brevo_login || !s.brevo_api_key) return { ok: false, error: 'Brevo login email and API key required' }
  const fromEmail = s.brevo_from_email || s.brevo_login
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user: s.brevo_login, pass: s.brevo_api_key },
  })
  await transporter.sendMail({
    from:    `${s.from_name || fromEmail} <${fromEmail}>`,
    to:      env.to,
    subject: env.subject,
    text:    env.text,
    html:    env.html,
    replyTo: s.reply_to,
  })
  return { ok: true }
}

async function viaSendGrid(env: Envelope, s: EmailSettings): Promise<SendResult> {
  if (!s.sendgrid_api_key) return { ok: false, error: 'SendGrid API key required' }
  const fromEmail = s.sendgrid_from_email || s.from_email
  if (!fromEmail) return { ok: false, error: 'From email required (must be verified in SendGrid)' }
  const content = env.html
    ? [{ type: 'text/html', value: env.html }]
    : [{ type: 'text/plain', value: env.text }]
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${s.sendgrid_api_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: env.to }] }],
      from: { email: fromEmail, name: s.from_name || fromEmail },
      subject: env.subject,
      content,
      ...(s.reply_to ? { reply_to: { email: s.reply_to } } : {}),
    }),
  })
  if (!res.ok) return { ok: false, error: `SendGrid: ${await res.text()}` }
  return { ok: true }
}

async function viaMailgun(env: Envelope, s: EmailSettings): Promise<SendResult> {
  if (!s.mailgun_api_key || !s.mailgun_domain) return { ok: false, error: 'API key and domain required' }
  const base = s.mailgun_region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net'
  const fromEmail = s.from_email || `noreply@${s.mailgun_domain}`
  const formData = new FormData()
  formData.append('from', `${s.from_name || fromEmail} <${fromEmail}>`)
  formData.append('to', env.to)
  formData.append('subject', env.subject)
  formData.append('text', env.text)
  if (env.html) formData.append('html', env.html)
  if (s.reply_to) formData.append('h:Reply-To', s.reply_to)
  const res = await fetch(`${base}/v3/${s.mailgun_domain}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${Buffer.from(`api:${s.mailgun_api_key}`).toString('base64')}` },
    body: formData,
  })
  if (!res.ok) return { ok: false, error: `Mailgun: ${await res.text()}` }
  return { ok: true }
}

async function viaPostmark(env: Envelope, s: EmailSettings): Promise<SendResult> {
  if (!s.postmark_api_key) return { ok: false, error: 'Postmark server token required' }
  const fromEmail = s.postmark_from_email || s.from_email
  if (!fromEmail) return { ok: false, error: 'From email required (must be verified in Postmark)' }
  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: { 'X-Postmark-Server-Token': s.postmark_api_key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      From:     `${s.from_name || fromEmail} <${fromEmail}>`,
      To:       env.to,
      Subject:  env.subject,
      TextBody: env.text,
      ...(env.html ? { HtmlBody: env.html } : {}),
      ...(s.reply_to ? { ReplyTo: s.reply_to } : {}),
    }),
  })
  if (!res.ok) return { ok: false, error: `Postmark: ${await res.text()}` }
  return { ok: true }
}

async function viaResend(
  env: Envelope,
  s: EmailSettings,
  apiKey: string | undefined,
  fromAddr: string | undefined,
): Promise<SendResult> {
  if (!apiKey) return { ok: false, error: 'Resend API key not set' }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:     `${s.from_name || 'CooVex'} <${fromAddr || 'noreply@coovex.com'}>`,
      to:       [env.to],
      subject:  env.subject,
      text:     env.text,
      html:     env.html,
      reply_to: s.reply_to || undefined,
    }),
  })
  if (!res.ok) return { ok: false, error: `Resend: ${await res.text()}` }
  return { ok: true }
}
