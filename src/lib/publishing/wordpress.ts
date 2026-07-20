import type { PostPayload, PublishResult } from './types'

export interface WordPressCredentials {
  site_url: string
  username: string
  app_password: string
  default_status?: 'draft' | 'publish'
}

export async function publishToWordPress(
  credentials: WordPressCredentials,
  post: PostPayload,
): Promise<PublishResult> {
  const { site_url, username, app_password, default_status = 'publish' } = credentials
  const base = site_url.replace(/\/$/, '')
  const token = Buffer.from(`${username}:${app_password}`).toString('base64')

  try {
    const res = await fetch(`${base}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: post.title,
        content: post.content,
        status: post.status ?? default_status,
        slug: post.slug,
        excerpt: post.meta_description ?? '',
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string }
      return { integration: 'wordpress_publish', success: false, error: err.message ?? `HTTP ${res.status}` }
    }

    const data = await res.json() as { id: number; link: string }
    return { integration: 'wordpress_publish', success: true, url: data.link, external_id: String(data.id) }
  } catch (e) {
    return { integration: 'wordpress_publish', success: false, error: String(e) }
  }
}

export async function testWordPressConnection(credentials: WordPressCredentials): Promise<{ ok: boolean; msg: string }> {
  const base = credentials.site_url.replace(/\/$/, '')
  const token = Buffer.from(`${credentials.username}:${credentials.app_password}`).toString('base64')
  try {
    const res = await fetch(`${base}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: `Basic ${token}` },
    })
    if (!res.ok) return { ok: false, msg: 'Invalid credentials or REST API is disabled' }
    const data = await res.json() as { name: string }
    return { ok: true, msg: `Connected as ${data.name}` }
  } catch {
    return { ok: false, msg: 'Cannot reach WordPress site. Check the URL.' }
  }
}
