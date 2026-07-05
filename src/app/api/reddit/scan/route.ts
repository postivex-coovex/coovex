import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  searchSubreddit,
  searchReddit,
  scoreLeadQuality,
  deduplicatePosts,
  type RedditPost,
} from '@/lib/reddit-client'

export const maxDuration = 30

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: biz } = await supabase
    .from('businesses').select('id, name, integrations')
    .eq('workspace_id', profile?.current_workspace_id ?? '').maybeSingle()

  if (!biz) return NextResponse.json({ error: 'No business' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reddit = (biz.integrations as any)?.reddit
  if (!reddit?.enabled) return NextResponse.json({ error: 'Reddit monitoring not enabled' }, { status: 400 })

  const subreddits: string[] = reddit.subreddits ?? []
  const keywords: string[] = reddit.keywords ?? []
  const brandKeywords: string[] = reddit.brand_keywords ?? []

  const allPosts: RedditPost[] = []

  // Search subreddits × keywords
  for (const sub of subreddits.slice(0, 5)) {
    for (const kw of keywords.slice(0, 5)) {
      const posts = await searchSubreddit(sub, kw, 5)
      allPosts.push(...posts)
    }
  }

  // Brand/competitor mentions across all Reddit
  for (const kw of brandKeywords.slice(0, 3)) {
    const posts = await searchReddit(kw, 5)
    allPosts.push(...posts)
  }

  const unique = deduplicatePosts(allPosts)

  // Fetch existing signal URLs to avoid duplicates
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

  let inserted = 0
  for (const post of unique) {
    const postUrl = `https://reddit.com${post.permalink}`
    if (existingUrls.has(postUrl)) continue

    const quality = scoreLeadQuality(post)
    if (quality < 3) continue // skip low-quality posts

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
    inserted++
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

  return NextResponse.json({ ok: true, scanned: unique.length, inserted })
}
