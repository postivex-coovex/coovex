import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { publishPost } from '@/lib/social-publisher'
import { publishToWebsite, isWebsitePublisher } from '@/lib/publishing'
import { syncBusinessMemory } from '@/lib/agent/sync-memory'
import type { PostPayload } from '@/lib/publishing'

// POST /api/posts/[id]/publish — publish immediately (social + website integrations)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const service  = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { targets?: string[] }

  // Fetch the post
  const { data: post } = await supabase
    .from('posts')
    .select('id, business_id, channel, content, status, image_url, title, meta_title, meta_description, slug, tags')
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

  const now = new Date().toISOString()
  const results: Array<{ integration: string; success: boolean; url?: string; error?: string }> = []

  // ── Social publish (existing channels) ──────────────────────────────
  const isWebsiteOnly = body.targets?.every(t => isWebsitePublisher(t))
  if (!isWebsiteOnly) {
    const social = (biz.social_connections as Record<string, unknown>) ?? {}
    const socialResult = await publishPost(post.channel, post.content, social, post.image_url ?? undefined)
    results.push({ integration: post.channel, ...socialResult })
  }

  // ── Website integrations (WordPress, Ghost, GitHub, Webhook, SFTP) ──
  const { data: websiteIntegrations } = await service
    .from('integrations')
    .select('type, config, status')
    .eq('business_id', biz.id)
    .eq('status', 'connected')
    .in('type', ['wordpress_publish', 'webhook_publish', 'ghost', 'github', 'sftp'])

  const targetFiltered = body.targets
    ? (websiteIntegrations ?? []).filter(i => body.targets!.includes(i.type))
    : (websiteIntegrations ?? [])

  if (targetFiltered.length > 0) {
    const postPayload: PostPayload = {
      title:             (post.title as string | null)            ?? post.content.replace(/<[^>]+>/g, '').slice(0, 80),
      content:           post.content,
      slug:              (post.slug as string | null)             ?? '',
      meta_title:        (post.meta_title as string | null)       ?? undefined,
      meta_description:  (post.meta_description as string | null) ?? undefined,
      tags:              (post.tags as string[] | null)           ?? undefined,
      status:            'publish',
    }
    const websiteResults = await publishToWebsite(
      targetFiltered.map(i => ({ type: i.type, config: i.config as { credentials?: Record<string, string> } })),
      postPayload,
    )
    results.push(...websiteResults)
  }

  // ── Update post status ───────────────────────────────────────────────
  const anySuccess = results.some(r => r.success)
  const allFailed  = results.length > 0 && results.every(r => !r.success)

  if (anySuccess) {
    await supabase.from('posts').update({
      status: 'published',
      published_at: now,
    }).eq('id', id)
    if (profile?.current_workspace_id) {
      syncBusinessMemory(post.business_id, profile.current_workspace_id, 0).catch(() => {})
    }
  } else if (allFailed) {
    await supabase.from('posts').update({ status: 'failed' }).eq('id', id)
  }

  return NextResponse.json({ success: anySuccess, results })
}
