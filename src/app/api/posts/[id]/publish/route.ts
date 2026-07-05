import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { publishPost } from '@/lib/social-publisher'
import { syncBusinessMemory } from '@/lib/agent/sync-memory'

// POST /api/posts/[id]/publish — publish immediately
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch the post
  const { data: post } = await supabase
    .from('posts')
    .select('id, business_id, channel, content, status, image_url')
    .eq('id', id)
    .single()

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (post.status === 'published') return NextResponse.json({ error: 'Already published' }, { status: 400 })

  // Verify user owns this business
  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: biz } = await supabase
    .from('businesses').select('id, social_connections')
    .eq('workspace_id', profile?.current_workspace_id ?? '').maybeSingle()

  if (!biz || biz.id !== post.business_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const social = (biz.social_connections as Record<string, unknown>) ?? {}
  const result = await publishPost(post.channel, post.content, social, post.image_url ?? undefined)

  const now = new Date().toISOString()

  if (result.success) {
    await supabase.from('posts').update({
      status: 'published',
      published_at: now,
      platform_post_id: result.platformPostId,
    }).eq('id', id)
    // Auto-sync AI memory after publish (fire-and-forget)
    if (profile?.current_workspace_id) {
      syncBusinessMemory(post.business_id, profile.current_workspace_id, 0).catch(() => {})
    }
    return NextResponse.json({ success: true, platformPostId: result.platformPostId })
  } else {
    await supabase.from('posts').update({ status: 'failed', error_message: result.error }).eq('id', id)
    return NextResponse.json({ success: false, error: result.error }, { status: 422 })
  }
}
