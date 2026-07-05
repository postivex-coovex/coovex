import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { publishPost } from '@/lib/social-publisher'

// Vercel Cron: every 15 minutes — "*/15 * * * *"
// Authorization: Bearer $CRON_SECRET

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const results = { published: 0, failed: 0, skipped: 0 }

  // Find all posts due to be published
  const { data: posts } = await supabase
    .from('posts')
    .select('id, business_id, channel, content, image_url')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .limit(50)

  if (!posts?.length) return NextResponse.json({ ok: true, ...results })

  // Get unique business IDs
  const bizIds = [...new Set(posts.map(p => p.business_id))]

  // Fetch social connections for all businesses at once
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, social_connections')
    .in('id', bizIds)

  const bizMap = new Map(businesses?.map(b => [b.id, b]) ?? [])

  for (const post of posts) {
    const biz = bizMap.get(post.business_id)
    if (!biz) { results.skipped++; continue }

    const social = (biz.social_connections as Record<string, unknown>) ?? {}

    const result = await publishPost(post.channel, post.content, social, post.image_url ?? undefined)

    if (result.success) {
      await supabase.from('posts').update({
        status: 'published',
        published_at: now,
        platform_post_id: result.platformPostId,
      }).eq('id', post.id)
      results.published++
    } else {
      await supabase.from('posts').update({
        status: 'failed',
        error_message: result.error,
      }).eq('id', post.id)
      results.failed++
    }
  }

  return NextResponse.json({ ok: true, ...results })
}
