import crypto from 'crypto'
import type { PostPayload, PublishResult } from './types'

export interface GhostCredentials {
  site_url: string
  admin_api_key: string // format: id:secret_hex
  default_status?: 'draft' | 'published'
}

function signGhostJWT(apiKey: string): string {
  const [id, secret] = apiKey.split(':')
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', kid: id, typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url')
  const signingInput = `${header}.${payload}`
  const secretBuffer = Buffer.from(secret, 'hex')
  const signature = crypto.createHmac('sha256', secretBuffer).update(signingInput).digest('base64url')
  return `${signingInput}.${signature}`
}

export async function publishToGhost(
  credentials: GhostCredentials,
  post: PostPayload,
): Promise<PublishResult> {
  const { site_url, admin_api_key, default_status = 'published' } = credentials
  const base = site_url.replace(/\/$/, '')
  const token = signGhostJWT(admin_api_key)

  try {
    const res = await fetch(`${base}/ghost/api/admin/posts/`, {
      method: 'POST',
      headers: {
        Authorization: `Ghost ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        posts: [{
          title: post.title,
          html: post.content,
          slug: post.slug,
          status: post.status === 'draft' ? 'draft' : default_status,
          custom_excerpt: post.meta_description,
          tags: post.tags?.map(t => ({ name: t })),
        }],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { errors?: { message: string }[] }
      return { integration: 'ghost', success: false, error: err.errors?.[0]?.message ?? `HTTP ${res.status}` }
    }

    const data = await res.json() as { posts: [{ id: string; url: string }] }
    return { integration: 'ghost', success: true, url: data.posts[0]?.url, external_id: data.posts[0]?.id }
  } catch (e) {
    return { integration: 'ghost', success: false, error: String(e) }
  }
}

export async function testGhostConnection(credentials: GhostCredentials): Promise<{ ok: boolean; msg: string }> {
  const base = credentials.site_url.replace(/\/$/, '')
  try {
    const token = signGhostJWT(credentials.admin_api_key)
    const res = await fetch(`${base}/ghost/api/admin/site/`, {
      headers: { Authorization: `Ghost ${token}` },
    })
    if (!res.ok) return { ok: false, msg: 'Invalid API key or Ghost API not reachable' }
    const data = await res.json() as { site?: { title: string } }
    return { ok: true, msg: `Connected to "${data.site?.title ?? 'Ghost site'}"` }
  } catch {
    return { ok: false, msg: 'Cannot reach Ghost site. Check the URL.' }
  }
}
