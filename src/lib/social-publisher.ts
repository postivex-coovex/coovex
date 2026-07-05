const GRAPH = 'https://graph.facebook.com/v19.0'

export type PublishResult = { success: true; platformPostId: string } | { success: false; error: string }

interface FacebookPage {
  id: string
  name: string
  access_token: string
}

interface FacebookConnections {
  pages?: FacebookPage[]
  selected_page_id?: string | null
}

interface InstagramConnection {
  account_id: string
  page_id: string
  page_token: string
}

interface LinkedInConnection {
  account_id: string
  access_token: string
  expires_at?: string
  pages?: { id: string; name: string }[]
  selected_page_id?: string | null
}

// ── Facebook ──────────────────────────────────────────────────────────────────

export async function publishToFacebook(
  content: string,
  fb: FacebookConnections,
  imageUrl?: string
): Promise<PublishResult> {
  if (!fb.pages?.length) return { success: false, error: 'No Facebook Page connected' }

  // Use selected page, fallback to first
  const page = fb.selected_page_id
    ? fb.pages.find(p => p.id === fb.selected_page_id) ?? fb.pages[0]
    : fb.pages[0]

  const params: Record<string, string> = {
    message: content,
    access_token: page.access_token,
  }
  if (imageUrl) params.link = imageUrl

  const res = await fetch(`${GRAPH}/${page.id}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  const data = await res.json()
  if (!res.ok || data.error) {
    return { success: false, error: data.error?.message ?? 'Facebook publish failed' }
  }
  return { success: true, platformPostId: data.id }
}

// ── Instagram ────��────────────────────────────────────────────────────────────

export async function publishToInstagram(
  content: string,
  ig: InstagramConnection,
  imageUrl?: string
): Promise<PublishResult> {
  if (!imageUrl) {
    return { success: false, error: 'Instagram requires an image URL. Add an image to publish.' }
  }

  const containerRes = await fetch(`${GRAPH}/${ig.account_id}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption: content, access_token: ig.page_token }),
  })
  const container = await containerRes.json()
  if (!containerRes.ok || container.error) {
    return { success: false, error: container.error?.message ?? 'Instagram media upload failed' }
  }

  const publishRes = await fetch(`${GRAPH}/${ig.account_id}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id, access_token: ig.page_token }),
  })
  const published = await publishRes.json()
  if (!publishRes.ok || published.error) {
    return { success: false, error: published.error?.message ?? 'Instagram publish failed' }
  }
  return { success: true, platformPostId: published.id }
}

// ── LinkedIn ───────────────────────────────────────��──────────────────────────

export async function publishToLinkedIn(
  content: string,
  li: LinkedInConnection,
  imageUrl?: string
): Promise<PublishResult> {
  if (li.expires_at && new Date(li.expires_at) < new Date()) {
    return { success: false, error: 'LinkedIn token expired. Please reconnect LinkedIn.' }
  }

  // Post as company page if selected, else personal profile
  const author = li.selected_page_id
    ? `urn:li:organization:${li.selected_page_id}`
    : `urn:li:person:${li.account_id}`

  const shareContent: Record<string, unknown> = {
    shareCommentary: { text: content },
    shareMediaCategory: imageUrl ? 'ARTICLE' : 'NONE',
    ...(imageUrl ? { media: [{ status: 'READY', originalUrl: imageUrl }] } : {}),
  }

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${li.access_token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: { 'com.linkedin.ugc.ShareContent': shareContent },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    return { success: false, error: data.message ?? 'LinkedIn publish failed' }
  }
  return { success: true, platformPostId: data.id }
}

// ── Dispatcher ──────────────────────────────────────��─────────────────────────

export async function publishPost(
  channel: string,
  content: string,
  socialConnections: Record<string, unknown>,
  imageUrl?: string
): Promise<PublishResult> {
  switch (channel) {
    case 'facebook':
      return publishToFacebook(content, socialConnections.facebook as FacebookConnections, imageUrl)
    case 'instagram':
      if (!socialConnections.instagram) return { success: false, error: 'Instagram not connected' }
      return publishToInstagram(content, socialConnections.instagram as InstagramConnection, imageUrl)
    case 'linkedin':
      if (!socialConnections.linkedin) return { success: false, error: 'LinkedIn not connected' }
      return publishToLinkedIn(content, socialConnections.linkedin as LinkedInConnection, imageUrl)
    default:
      return { success: false, error: `Channel "${channel}" auto-publish not supported yet` }
  }
}
