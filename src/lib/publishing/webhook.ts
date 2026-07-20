import crypto from 'crypto'
import type { PostPayload, PublishResult } from './types'

export interface WebhookPublishCredentials {
  url: string
  secret?: string
}

export async function publishToWebhook(
  credentials: WebhookPublishCredentials,
  post: PostPayload,
): Promise<PublishResult> {
  const { url, secret } = credentials
  const body = JSON.stringify({ ...post, published_at: new Date().toISOString() })

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (secret) {
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex')
    headers['X-CooVex-Signature'] = `sha256=${sig}`
  }

  try {
    const res = await fetch(url, { method: 'POST', headers, body })
    if (!res.ok) return { integration: 'webhook_publish', success: false, error: `HTTP ${res.status}` }
    return { integration: 'webhook_publish', success: true }
  } catch (e) {
    return { integration: 'webhook_publish', success: false, error: String(e) }
  }
}

export async function testWebhookConnection(credentials: WebhookPublishCredentials): Promise<{ ok: boolean; msg: string }> {
  const body = JSON.stringify({ event: 'test', timestamp: new Date().toISOString() })
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (credentials.secret) {
    const sig = crypto.createHmac('sha256', credentials.secret).update(body).digest('hex')
    headers['X-CooVex-Signature'] = `sha256=${sig}`
  }
  try {
    const res = await fetch(credentials.url, { method: 'POST', headers, body })
    if (res.status >= 500) return { ok: false, msg: `Server error: ${res.status}` }
    return { ok: true, msg: `Endpoint reachable (HTTP ${res.status})` }
  } catch {
    return { ok: false, msg: 'Cannot reach webhook URL' }
  }
}
