import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  searchSubreddit,
  searchReddit,
  scoreLeadQuality,
  deduplicatePosts,
  type RedditPost,
} from '@/lib/reddit-client'

// Vercel Cron: every 3 hours — "0 */3 * * *"
// Authorization: Bearer $CRON_SECRET

export const maxDuration = 60

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results = { businesses: 0, signals: 0 }

  // Get all businesses with Reddit monitoring enabled
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, integrations')
    .not('integrations->reddit', 'is', null)
    .limit(100)

  if (!businesses?.length) return NextResponse.json({ ok: true, ...results })

  for (const biz of businesses) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reddit = (biz.integrations as any)?.reddit
    if (!reddit?.enabled) continue

    const subreddits: string[] = reddit.subreddits ?? []
    const keywords: string[]   = reddit.keywords ?? []
    const brandKeywords: string[] = reddit.brand_keywords ?? []

    if (subreddits.length === 0 && keywords.length === 0 && brandKeywords.length === 0) continue

    const allPosts: RedditPost[] = []

    for (const sub of subreddits.slice(0, 5)) {
      for (const kw of keywords.slice(0, 5)) {
        const posts = await searchSubreddit(sub, kw, 5)
        allPosts.push(...posts)
      }
    }

    for (const kw of brandKeywords.slice(0, 3)) {
      const posts = await searchReddit(kw, 5)
      allPosts.push(...posts)
    }

    const unique = deduplicatePosts(allPosts)

    // Fetch existing Reddit signal URLs for this business
    const { data: existing } = await supabase
      .from('agent_signals')
      .select('action_data_json')
      .eq('business_id', biz.id)
      .eq('source', 'reddit')

    const existingUrls = new Set(
      (existing ?? []).map(s => {
        const d = s.action_data_json as Record<string, string> | null
        return d?.url ?? ''
      })
    )

    for (const post of unique) {
      const postUrl = `https://reddit.com${post.permalink}`
      if (existingUrls.has(postUrl)) continue

      const quality = scoreLeadQuality(post)
      if (quality < 3) continue

      const isBrandMention = brandKeywords.some(kw =>
        `${post.title} ${post.selftext}`.toLowerCase().includes(kw.toLowerCase())
      )

      const type = isBrandMention ? 'insight' : 'opportunity'
      const title = isBrandMention
        ? `Brand mention on r/${post.subreddit}`
        : `Lead opportunity on r/${post.subreddit}`

      const preview = post.selftext?.slice(0, 120) || post.title
      const body = `"${preview}${preview.length >= 120 ? '…' : ''}" — u/${post.author} · ${post.score} upvotes`

      await supabase.from('agent_signals').insert({
        business_id:      biz.id,
        type,
        source:           'reddit',
        title,
        body,
        action_label:     'View on Reddit',
        action_type:      'open_url',
        action_data_json: { url: postUrl },
      })
      results.signals++
    }

    // Update last_scan_at
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const integrations = (biz.integrations as any) ?? {}
    await supabase.from('businesses').update({
      integrations: {
        ...integrations,
        reddit: { ...integrations.reddit, last_scan_at: new Date().toISOString() },
      },
    } as Record<string, unknown>).eq('id', biz.id)

    results.businesses++
  }

  return NextResponse.json({ ok: true, ...results })
}
