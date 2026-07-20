import { publishToWordPress, testWordPressConnection } from './wordpress'
import { publishToWebhook, testWebhookConnection } from './webhook'
import { publishToGhost, testGhostConnection } from './ghost'
import { publishToGitHub, testGitHubConnection } from './github'
import { publishToSFTP, testSFTPConnection } from './sftp'
import type { PostPayload, PublishResult } from './types'

export type { PostPayload, PublishResult }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCredentials = any

const PUBLISHERS: Record<string, (creds: AnyCredentials, post: PostPayload) => Promise<PublishResult>> = {
  wordpress_publish: publishToWordPress,
  webhook_publish:   publishToWebhook,
  ghost:             publishToGhost,
  github:            publishToGitHub,
  sftp:              publishToSFTP,
}

const TESTERS: Record<string, (creds: AnyCredentials) => Promise<{ ok: boolean; msg: string }>> = {
  wordpress_publish: testWordPressConnection,
  webhook_publish:   testWebhookConnection,
  ghost:             testGhostConnection,
  github:            testGitHubConnection,
  sftp:              testSFTPConnection,
}

export function isWebsitePublisher(type: string): boolean {
  return type in PUBLISHERS
}

export async function publishToWebsite(
  integrations: Array<{ type: string; config: { credentials?: Record<string, string> } }>,
  post: PostPayload,
): Promise<PublishResult[]> {
  const results: PublishResult[] = []
  for (const intg of integrations) {
    const publisher = PUBLISHERS[intg.type]
    const credentials = intg.config?.credentials
    if (!publisher || !credentials) continue
    results.push(await publisher(credentials, post))
  }
  return results
}

export async function testWebsiteIntegration(
  type: string,
  credentials: Record<string, string>,
): Promise<{ ok: boolean; msg: string }> {
  const tester = TESTERS[type]
  if (!tester) return { ok: false, msg: 'Unknown integration type' }
  return tester(credentials)
}
