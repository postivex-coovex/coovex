export interface HNPost {
  id: string
  title: string
  selftext: string
  subreddit: string
  author: string
  score: number
  num_comments: number
  url: string
  quality: number
  created_utc: number
  source: 'hackernews'
}

interface HNHit {
  objectID: string
  title: string
  story_text: string | null
  author: string
  points: number
  num_comments: number
  created_at: string
}

export async function searchHackerNews(query: string, limit = 10): Promise<HNPost[]> {
  try {
    const params = new URLSearchParams({
      query,
      tags: 'story',
      hitsPerPage: String(limit),
      numericFilters: 'points>0',
    })
    const res = await fetch(`https://hn.algolia.com/api/v1/search?${params}`, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const json = await res.json()
    const hits: HNHit[] = (json.hits ?? []).filter((h: HNHit) => h.title && h.points > 0)
    return hits.map(h => ({
      id:           `hn_${h.objectID}`,
      title:        h.title ?? '',
      selftext:     (h.story_text ?? '').replace(/<[^>]*>/g, '').slice(0, 300),
      subreddit:    'HackerNews',
      author:       h.author ?? '',
      score:        h.points ?? 0,
      num_comments: h.num_comments ?? 0,
      url:          `https://news.ycombinator.com/item?id=${h.objectID}`,
      quality:      0,
      created_utc:  Math.floor(new Date(h.created_at).getTime() / 1000),
      source:       'hackernews' as const,
    }))
  } catch (e) {
    console.error(`HN fetch failed: ${e}`)
    return []
  }
}
