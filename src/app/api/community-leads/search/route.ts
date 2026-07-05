import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  searchReddit, searchSubreddit, scoreLeadQuality, deduplicatePosts, LEAD_SUBREDDITS
} from '@/lib/reddit-client'
import { searchHackerNews } from '@/lib/hn-client'
import { apifySearchReddit, apifySearchRedditComments, apifySearchLinkedIn } from '@/lib/apify'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { keyword, platform } = await req.json() as {
    keyword: string
    platform: 'reddit' | 'hackernews' | 'linkedin'
  }

  if (!keyword?.trim()) return NextResponse.json({ error: 'keyword required' }, { status: 400 })
  const query = keyword.trim()

  // Apify is CooVex's backend engine — token comes from server env only
  const apifyToken: string = process.env.APIFY_API_TOKEN || ''
  const useApify = !!apifyToken

  // ── Reddit ────────────────────────────────────────────────────────────────
  if (platform === 'reddit') {
    let leads: {
      id: string; title: string; body: string; community: string; author: string
      score: number; comments: number; url: string; quality: number; created_utc: number; platform: string
    }[] = []

    if (useApify) {
      try {
        // Fetch posts and comments in parallel for richer lead coverage
        const [posts, comments] = await Promise.allSettled([
          apifySearchReddit(apifyToken, query, 25),
          apifySearchRedditComments(apifyToken, query, 25),
        ])

        const allItems = [
          ...(posts.status === 'fulfilled' ? posts.value : []),
          ...(comments.status === 'fulfilled' ? comments.value : []),
        ]

        if (allItems.length === 0) throw new Error('No results from Apify')

        const seen = new Set<string>()
        leads = allItems
          .filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true })
          .map(p => ({
            ...p,
            quality: scoreLeadQuality({
              id: p.id, title: p.title, selftext: p.body, url: p.url,
              permalink: '', subreddit: p.community.replace('r/', ''),
              author: p.author, score: p.score, num_comments: p.comments, created_utc: p.created_utc,
            }),
          }))
          .sort((a, b) => b.quality - a.quality)
          .slice(0, 40)
      } catch (e) {
        console.error('Apify Reddit search failed, falling back:', e)
        leads = await directRedditSearch(query)
      }
    } else {
      leads = await directRedditSearch(query)
    }

    return NextResponse.json({ leads, platform: 'reddit', query, via: useApify ? 'apify' : 'direct' })
  }

  // ── Hacker News ───────────────────────────────────────────────────────────
  if (platform === 'hackernews') {
    const results = await Promise.allSettled([
      searchHackerNews(query, 20),
      searchHackerNews(`${query} ask`, 10),
      searchHackerNews(`${query} looking for`, 10),
    ])

    const all = results
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof searchHackerNews>>> => r.status === 'fulfilled')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .flatMap((r: any) => r.value)

    const seen = new Set<string>()
    const unique = all.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true })
    const scored = unique.filter(p => p.title?.length > 5).sort((a, b) => b.score - a.score).slice(0, 25)

    return NextResponse.json({
      leads: scored.map(p => ({
        id: p.id, title: p.title, body: p.selftext?.slice(0, 250) ?? '',
        community: 'Hacker News', author: p.author,
        score: p.score, comments: p.num_comments, url: p.url,
        quality: p.quality ?? 0, created_utc: p.created_utc, platform: 'hackernews',
      })),
      platform: 'hackernews', query,
    })
  }

  // ── LinkedIn (Apify only) ─────────────────────────────────────────────────
  if (platform === 'linkedin') {
    if (!useApify) {
      return NextResponse.json({ error: 'Apify token required for LinkedIn scraping', needs_apify: true }, { status: 402 })
    }
    try {
      const posts = await apifySearchLinkedIn(apifyToken, query, 25)
      return NextResponse.json({
        leads: posts.map(p => ({ ...p, quality: 5 })),
        platform: 'linkedin', query, via: 'apify',
      })
    } catch (e) {
      console.error('Apify LinkedIn failed:', e)
      return NextResponse.json({ error: 'LinkedIn scraping failed', leads: [] })
    }
  }

  return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
}

// ── Direct Reddit (no Apify) ──────────────────────────────────────────────

async function directRedditSearch(query: string) {
  const subredditResults = await Promise.allSettled(
    LEAD_SUBREDDITS.slice(0, 5).map(sub => searchSubreddit(sub, query, 8))
  )
  const globalResults = await Promise.allSettled([
    searchReddit(query, 15),
    searchReddit(`${query} help`, 10),
  ])

  const allPosts = [...subredditResults, ...globalResults]
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof searchReddit>>> => r.status === 'fulfilled')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .flatMap((r: any) => r.value)

  const unique = deduplicatePosts(allPosts)
  return unique
    .filter(p => p.title?.length > 5)
    .map(p => ({
      id:          p.id,
      title:       p.title,
      body:        p.selftext?.slice(0, 250) ?? '',
      community:   `r/${p.subreddit}`,
      author:      p.author,
      score:       p.score,
      comments:    p.num_comments,
      url:         p.url?.startsWith('http') ? p.url : `https://reddit.com${p.permalink}`,
      quality:     scoreLeadQuality(p),
      created_utc: p.created_utc,
      platform:    'reddit',
    }))
    .sort((a, b) => b.quality - a.quality)
    .slice(0, 30)
}

