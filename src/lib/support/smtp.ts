import nodemailer from 'nodemailer'
import type { SupportProperty, SupportConversation } from './types'

export interface SendReplyOptions {
  property: SupportProperty
  conversation: SupportConversation
  replyContent: string
  replyHtml?: string
}

function buildTransport(property: SupportProperty) {
  if (!property.smtp_host || !property.smtp_user || !property.smtp_password) {
    throw new Error('SMTP not configured for this property')
  }
  return nodemailer.createTransport({
    host: property.smtp_host,
    port: property.smtp_port || 587,
    secure: property.smtp_secure,
    auth: {
      user: property.smtp_user,
      pass: property.smtp_password,
    },
    tls: { rejectUnauthorized: false },
  })
}

export async function sendReplyEmail(opts: SendReplyOptions): Promise<{ messageId: string }> {
  const { property, conversation, replyContent, replyHtml } = opts
  const transport = buildTransport(property)

  const from = property.from_name
    ? `"${property.from_name}" <${property.from_email || property.smtp_user}>`
    : (property.from_email || property.smtp_user || '')

  const to = conversation.customer_email || null
  if (!to) throw new Error('No customer email to reply to')

  const subject = conversation.subject
    ? (conversation.subject.startsWith('Re:') ? conversation.subject : `Re: ${conversation.subject}`)
    : `Re: Support conversation`

  const mailOptions: nodemailer.SendMailOptions = {
    from,
    to: to!,
    subject,
    text: replyContent,
    html: replyHtml || `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#1e293b">${replyContent.replace(/\n/g, '<br>')}</div>`,
  }

  // Thread the email reply
  if (conversation.email_thread_id) {
    mailOptions.inReplyTo = conversation.email_thread_id
    mailOptions.references = conversation.email_thread_id
  }

  const info = await transport.sendMail(mailOptions)
  return { messageId: info.messageId }
}

export async function testSmtp(property: SupportProperty, testTo: string): Promise<void> {
  const transport = buildTransport(property)
  await transport.verify()
  await transport.sendMail({
    from: property.from_email || property.smtp_user!,
    to: testTo,
    subject: 'CooVex Support — SMTP Test',
    text: `SMTP test successful for property: ${property.name}`,
  })
}
