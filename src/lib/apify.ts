/**
 * Apify API client — backend engine for community lead scraping.
 * Token comes from APIFY_API_TOKEN server env var only (never user-facing).
 */

const APIFY_BASE = 'https://api.apify.com/v2'

// Well-known public actor IDs on Apify marketplace
export const APIFY_ACTORS = {
  reddit:   process.env.APIFY_REDDIT_ACTOR   ?? 'trudax/reddit-scraper',
  linkedin: process.env.APIFY_LINKEDIN_ACTOR ?? 'curious_coder/linkedin-post-search-scraper',
} as const

export interface ApifyRedditPost {
  id?: string
  postId?: string
  title?: string
  text?: string
  selftext?: string
  body?: string
  url?: string
  link?: string
  permalink?: string
  subreddit?: string
  communityName?: string
  author?: string
  username?: string
  score?: number
  upvotes?: number
  ups?: number
  numberOfComments?: number
  numComments?: number
  commentsCount?: number
  createdAt?: string
  createdUtc?: number
  created?: number
}

export interface ApifyRedditComment {
  id?: string
  commentId?: string
  text?: string
  body?: string
  permalink?: string
  url?: string
  postTitle?: string
  postUrl?: string
  postPermalink?: string
  subreddit?: string
  communityName?: string
  author?: string
  username?: string
  score?: number
  upvotes?: number
  ups?: number
  createdAt?: string
  createdUtc?: number
  created?: number
}

export interface ApifyLinkedInPost {
  url?: string
  postUrl?: string
  text?: string
  content?: string
  authorName?: string
  author?: string
  likesCount?: number
  commentsCount?: number
  repostsCount?: number
  postedAt?: string
  date?: string
}

// Run an Apify actor and wait for results
export async function runApifyActor<T>(
  token: string,
  actorId: string,
  input: Record<string, unknown>,
  timeoutSecs = 55,
): Promise<T[]> {
  // Start the actor run (waitForFinish polls until done or timeout)
  const runRes = await fetch(
    `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${token}&waitForFinish=${timeoutSecs}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
      signal: AbortSignal.timeout((timeoutSecs + 15) * 1000),
    }
  )

  if (!runRes.ok) {
    const body = await runRes.text().catch(() => '')
    throw new Error(`Apify actor "${actorId}" failed: HTTP ${runRes.status} — ${body.slice(0, 300)}`)
  }

  const run = await runRes.json()
  const datasetId: string | undefined = run.data?.defaultDatasetId
  if (!datasetId) throw new Error('Apify run has no defaultDatasetId')

  // Fetch dataset items
  const dataRes = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&format=json&clean=true&limit=50`,
    { cache: 'no-store', signal: AbortSignal.timeout(15000) }
  )
  if (!dataRes.ok) throw new Error(`Apify dataset fetch failed: ${dataRes.status}`)

  const items = await dataRes.json()
  return Array.isArray(items) ? items : []
}

// Validate an Apify API token
export async function validateApifyToken(token: string): Promise<{ ok: boolean; user?: string }> {
  try {
    const res = await fetch(`${APIFY_BASE}/users/me?token=${token}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { ok: false }
    const data = await res.json()
    return { ok: true, user: data?.data?.username ?? data?.data?.email }
  } catch {
    return { ok: false }
  }
}

// Search Reddit via Apify — maps raw actor output to normalized posts
export async function apifySearchReddit(
  token: string,
  keyword: string,
  limit = 25,
): Promise<NormalizedPost[]> {
  const raw = await runApifyActor<ApifyRedditPost>(token, APIFY_ACTORS.reddit, {
    searches: [keyword],
    type: 'posts',
    sort: 'relevance',
    time: 'year',
    maxItems: limit,
    proxy: { useApifyProxy: true },
  })

  return raw
    .filter(p => p.title || p.text)
    .map((p, i) => ({
      id:          p.id ?? p.postId ?? `apify_r_${i}`,
      title:       p.title ?? '',
      body:        (p.text ?? p.selftext ?? p.body ?? '').slice(0, 300),
      url:         p.url ?? p.link ?? (p.permalink ? `https://reddit.com${p.permalink}` : ''),
      community:   `r/${p.subreddit ?? p.communityName ?? 'reddit'}`,
      author:      p.author ?? p.username ?? 'unknown',
      score:       p.score ?? p.upvotes ?? p.ups ?? 0,
      comments:    p.numberOfComments ?? p.numComments ?? p.commentsCount ?? 0,
      created_utc: p.createdUtc ?? p.created ?? Math.floor(new Date(p.createdAt ?? Date.now()).getTime() / 1000),
      platform:    'reddit' as const,
    }))
}

// Search Reddit comments via Apify
export async function apifySearchRedditComments(
  token: string,
  keyword: string,
  limit = 25,
): Promise<NormalizedPost[]> {
  const raw = await runApifyActor<ApifyRedditComment>(token, APIFY_ACTORS.reddit, {
    searches: [keyword],
    type: 'comments',
    sort: 'relevance',
    time: 'year',
    maxItems: limit,
    proxy: { useApifyProxy: true },
  })

  return raw
    .filter(c => c.text ?? c.body)
    .map((c, i) => {
      const commentText = (c.text ?? c.body ?? '').trim()
      const subreddit = c.subreddit ?? c.communityName ?? 'reddit'
      const permalink = c.permalink ?? c.url ?? (c.postPermalink ? `https://reddit.com${c.postPermalink}` : '')
      return {
        id:          `rc_${c.id ?? c.commentId ?? i}`,
        title:       c.postTitle ? `[Comment] ${c.postTitle}` : `[Comment in r/${subreddit}]`,
        body:        commentText.slice(0, 400),
        url:         permalink.startsWith('http') ? permalink : `https://reddit.com${permalink}`,
        community:   `r/${subreddit}`,
        author:      c.author ?? c.username ?? 'unknown',
        score:       c.score ?? c.upvotes ?? c.ups ?? 0,
        comments:    0,
        created_utc: c.createdUtc ?? c.created ?? Math.floor(new Date(c.createdAt ?? Date.now()).getTime() / 1000),
        platform:    'reddit' as const,
        kind:        'comment' as const,
      }
    })
}

// Search LinkedIn posts via Apify
export async function apifySearchLinkedIn(
  token: string,
  keyword: string,
  limit = 20,
): Promise<NormalizedPost[]> {
  const raw = await runApifyActor<ApifyLinkedInPost>(token, APIFY_ACTORS.linkedin, {
    keywords: keyword,
    maxPosts: limit,
    proxy: { useApifyProxy: true },
  })

  return raw
    .filter(p => p.text ?? p.content)
    .map((p, i) => ({
      id:          `apify_li_${i}`,
      title:       (p.text ?? p.content ?? '').slice(0, 100),
      body:        (p.text ?? p.content ?? '').slice(0, 300),
      url:         p.url ?? p.postUrl ?? '',
      community:   'LinkedIn',
      author:      p.authorName ?? p.author ?? 'LinkedIn user',
      score:       p.likesCount ?? 0,
      comments:    p.commentsCount ?? 0,
      created_utc: Math.floor(new Date(p.postedAt ?? p.date ?? Date.now()).getTime() / 1000),
      platform:    'linkedin' as const,
    }))
}

export interface NormalizedPost {
  id: string
  title: string
  body: string
  url: string
  community: string
  author: string
  score: number
  comments: number
  created_utc: number
  platform: 'reddit' | 'hackernews' | 'linkedin'
  kind?: 'post' | 'comment'
}
