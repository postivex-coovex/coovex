import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RedditPost, searchReddit, scoreLeadQuality, deduplicatePosts } from '@/lib/reddit-client'
import { HNPost, searchHackerNews } from '@/lib/hn-client'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

type Lead = (RedditPost & { source: 'reddit'; quality: number }) | (HNPost & { quality: number })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { product_id } = await req.json()
  if (!product_id) return NextResponse.json({ error: 'product_id required' }, { status: 400 })

  const { data: product } = await supabase
    .from('products')
    .select('id, name, category, target_audience, type, tagline, description')
    .eq('id', product_id)
    .single()

  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const aiRes = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `You are a lead generation expert for online communities.

Product/Service: ${product.name}
Type: ${product.type}
Category: ${product.category ?? 'N/A'}
Target audience: ${product.target_audience ?? 'N/A'}
Tagline: ${product.tagline ?? 'N/A'}
Description: ${product.description ?? 'N/A'}

Generate search queries to find people who need this product/service on Reddit and HackerNews.
Think about PROBLEMS people post about, not the product name itself.

Respond ONLY with valid JSON (no markdown):
{
  "subreddits": ["sub1", "sub2", "sub3"],
  "queries": ["problem query 1", "query 2", "query 3", "query 4", "query 5"]
}

Rules:
- subreddits: real Reddit communities (3 max)
- queries: describe PROBLEMS or NEEDS in English. e.g. "how to track student attendance", "school management system", "automate attendance tracking"
- Keep queries short (3-7 words)`,
    }],
  })

  let subreddits: string[] = []
  let queries: string[] = []

  try {
    const raw = (aiRes.content[0] as { type: string; text: string }).text.trim()
    const jsonStr = raw.startsWith('{') ? raw : raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
    const parsed = JSON.parse(jsonStr)
    subreddits = parsed.subreddits ?? []
    queries    = parsed.queries ?? []
  } catch {
    subreddits = ['education', 'Teachers', 'edtech']
    queries    = ['track student attendance', 'school management software', 'classroom attendance system', 'automate attendance', 'student tracking app']
  }

  console.log('[FindLeads] Subreddits:', subreddits)
  console.log('[FindLeads] Queries:', queries)

  // Run Reddit (global only — more reliable than subreddit-specific) + HN in parallel
  const redditPromises = queries.slice(0, 4).map(q => searchReddit(q, 10))
  const hnPromises     = queries.slice(0, 4).map(q => searchHackerNews(q, 8))

  const [redditResults, hnResults] = await Promise.all([
    Promise.allSettled(redditPromises),
    Promise.allSettled(hnPromises),
  ])

  const redditPosts: RedditPost[] = redditResults
    .filter((r): r is PromiseFulfilledResult<RedditPost[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)

  const hnPosts: HNPost[] = hnResults
    .filter((r): r is PromiseFulfilledResult<HNPost[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)

  console.log('[FindLeads] Reddit posts:', redditPosts.length, '| HN posts:', hnPosts.length)

  // Deduplicate Reddit posts, score everything
  const uniqueReddit = deduplicatePosts(redditPosts)
  const scoredReddit = uniqueReddit.map(p => ({
    ...p,
    source: 'reddit' as const,
    quality: scoreLeadQuality(p),
    url: `https://reddit.com${p.permalink}`,
  }))

  // Deduplicate HN by id
  const seenHN = new Set<string>()
  const uniqueHN = hnPosts.filter(p => {
    if (seenHN.has(p.id)) return false
    seenHN.add(p.id)
    return true
  })
  const scoredHN = uniqueHN.map(p => ({
    ...p,
    quality: scoreLeadQuality({ id: p.id, title: p.title, selftext: p.selftext, score: p.score, num_comments: p.num_comments, created_utc: p.created_utc, subreddit: p.subreddit, author: p.author, permalink: p.url, url: p.url, source: 'reddit' as const }),
  }))

  // Merge and sort by quality
  const all: Lead[] = [...scoredReddit, ...scoredHN]
  all.sort((a, b) => b.quality - a.quality)
  const top = all.slice(0, 20)

  console.log('[FindLeads] Total returning:', top.length)

  return NextResponse.json({
    leads: top.map(p => ({
      id:           p.id,
      title:        p.title,
      selftext:     p.selftext?.slice(0, 300) ?? '',
      subreddit:    p.subreddit,
      author:       p.author,
      score:        p.score,
      num_comments: p.num_comments,
      url:          p.url,
      quality:      p.quality,
      created_utc:  p.created_utc,
      source:       p.source,
    })),
    product_name:        product.name,
    subreddits_searched: subreddits,
    queries_used:        queries,
    total_found:         top.length,
  })
}
