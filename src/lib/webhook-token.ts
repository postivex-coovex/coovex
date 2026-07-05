import { createHmac } from 'node:crypto'

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? 'coovex-webhook-secret'

export function generateWebhookToken(businessId: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(businessId).digest('hex').slice(0, 32)
}
