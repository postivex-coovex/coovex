import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { searchSubreddit, deduplicatePosts } from '@/lib/reddit-client'

export const maxDuration = 30

export interface RedditTrend {
  title: string
  subreddit: string
  reddit_url: string
  score: number
  num_comments: number
  content_angle: string
  why: string
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: biz } = await supabase
    .from('businesses').select('id, name, industry, integrations')
    .eq('workspace_id', profile?.current_workspace_id ?? '').maybeSingle()

  if (!biz) return NextResponse.json({ trends: [] })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reddit = (biz.integrations as any)?.reddit
  const subreddits: string[] = reddit?.subreddits ?? []

  if (subreddits.length === 0) {
    return NextResponse.json({ trends: [], message: 'No subreddits configured. Add subreddits in Integrations → Reddit.' })
  }

  // Fetch hot posts from each subreddit (sort=hot, this week)
  const allPosts = []
  for (const sub of subreddits.slice(0, 5)) {
    const res = await fetch(
      `https://www.reddit.com/r/${sub}/hot.json?limit=10&t=week`,
      { headers: { 'User-Agent': 'CooVex/1.0' }, next: { revalidate: 0 } }
    )
    if (!res.ok) continue
    const json = await res.json()
    const children = json?.data?.children ?? []
    allPosts.push(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...children.map((c: any) => ({
        id:           c.data.id,
        title:        c.data.title,
        selftext:     c.data.selftext ?? '',
        permalink:    c.data.permalink,
        subreddit:    c.data.subreddit,
        score:        c.data.score,
        num_comments: c.data.num_comments,
      }))
    )
  }

  const unique = deduplicatePosts(allPosts)
  const top = unique
    .filter(p => p.score > 5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)

  if (top.length === 0) {
    return NextResponse.json({ trends: [], message: 'No trending posts found yet. Try again later.' })
  }

  // Claude Haiku: analyze trends and suggest content angles
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const postsText = top.map((p, i) =>
    `${i + 1}. [r/${p.subreddit}] "${p.title}" (${p.score} upvotes, ${p.num_comments} comments)`
  ).join('\n')

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `You are a content strategist for "${biz.name}", a ${biz.industry} business.

Here are trending Reddit posts this week from their industry subreddits:
${postsText}

Pick the 5 most relevant trends for this business. For each, suggest a content angle they can post on LinkedIn or Facebook.

Respond ONLY with a JSON array, no markdown:
[
  {
    "index": 1,
    "content_angle": "one-sentence post angle tailored to ${biz.industry}",
    "why": "one sentence: why this trend matters for their audience"
  }
]`,
    }],
  })

  let aiSuggestions: { index: number; content_angle: string; why: string }[] = []
  try {
    const raw = (msg.content[0] as { type: string; text: string }).text.trim()
    const jsonStr = raw.startsWith('[') ? raw : raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1)
    aiSuggestions = JSON.parse(jsonStr)
  } catch {
    // fallback: return posts without AI angles
    const trends: RedditTrend[] = top.slice(0, 5).map(p => ({
      title:         p.title,
      subreddit:     p.subreddit,
      reddit_url:    `https://reddit.com${p.permalink}`,
      score:         p.score,
      num_comments:  p.num_comments,
      content_angle: `Share your perspective on: "${p.title}"`,
      why:           'Trending in your industry this week',
    }))
    return NextResponse.json({ trends })
  }

  const trends: RedditTrend[] = aiSuggestions.map(s => {
    const post = top[s.index - 1]
    if (!post) return null
    return {
      title:         post.title,
      subreddit:     post.subreddit,
      reddit_url:    `https://reddit.com${post.permalink}`,
      score:         post.score,
      num_comments:  post.num_comments,
      content_angle: s.content_angle,
      why:           s.why,
    }
  }).filter(Boolean) as RedditTrend[]

  return NextResponse.json({ trends })
}
