const REDDIT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; CooVex/1.0; +https://coovex.com)',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
}

export interface RedditPost {
  id: string
  title: string
  selftext: string
  url: string
  permalink: string
  subreddit: string
  author: string
  score: number
  num_comments: number
  created_utc: number
  source?: 'reddit'
}

interface RedditChild {
  data: {
    id: string
    title: string
    selftext: string
    url: string
    permalink: string
    subreddit: string
    author: string
    score: number
    num_comments: number
    created_utc: number
    is_self: boolean
  }
}

async function fetchRedditUrl(url: string): Promise<RedditChild[]> {
  try {
    const res = await fetch(url, {
      headers: REDDIT_HEADERS,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      console.error(`Reddit ${res.status}: ${url}`)
      return []
    }
    const json = await res.json()
    return json?.data?.children ?? []
  } catch (e) {
    console.error(`Reddit fetch error (${url}): ${e}`)
    return []
  }
}

// Global Reddit search — tries multiple sort orders for better coverage
export async function searchReddit(keyword: string, limit = 15): Promise<RedditPost[]> {
  // Try old.reddit.com first (often more permissive), then www
  const urls = [
    `https://old.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=relevance&limit=${limit}&t=all`,
    `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=new&limit=${limit}`,
  ]

  for (const url of urls) {
    const children = await fetchRedditUrl(url)
    if (children.length > 0) return children.map(c => c.data)
  }
  return []
}

// Search a specific subreddit
export async function searchSubreddit(subreddit: string, keyword: string, limit = 10): Promise<RedditPost[]> {
  const urls = [
    `https://old.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(keyword)}&restrict_sr=1&sort=new&limit=${limit}`,
    `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(keyword)}&restrict_sr=1&sort=relevance&limit=${limit}&t=all`,
  ]
  for (const url of urls) {
    const children = await fetchRedditUrl(url)
    if (children.length > 0) return children.map(c => c.data)
  }
  return []
}

// Business-relevant subreddits for lead finding
export const LEAD_SUBREDDITS = [
  'entrepreneur', 'smallbusiness', 'startups', 'freelance',
  'marketing', 'SaaS', 'webdev', 'hiring', 'forhire',
]

export function scoreLeadQuality(post: RedditPost): number {
  const text = `${post.title} ${post.selftext}`.toLowerCase()
  let score = 0

  const buyingSignals = [
    'looking for', 'need help', 'need a', 'recommend', 'suggestion',
    'anyone know', 'best tool', 'best software', 'alternative to',
    'how do i find', 'where can i', 'hiring', 'budget', 'price',
    'can anyone', 'please help', 'struggling with', 'trying to find',
  ]
  for (const signal of buyingSignals) {
    if (text.includes(signal)) score += 3
  }

  if (post.score > 10) score += 2
  if (post.num_comments > 5) score += 2

  const hoursOld = (Date.now() / 1000 - post.created_utc) / 3600
  if (hoursOld < 48)   score += 3
  else if (hoursOld < 168) score += 1

  return score
}

export function deduplicatePosts(posts: RedditPost[]): RedditPost[] {
  const seen = new Set<string>()
  return posts.filter(p => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })
}
