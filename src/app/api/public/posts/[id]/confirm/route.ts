import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// POST /api/public/posts/[id]/confirm
// Called by the user's website after it successfully publishes the content
// Body: { api_key, external_url, published_at? }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: { api_key?: string; external_url?: string; published_at?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const { api_key, external_url, published_at } = body
  if (!api_key) return NextResponse.json({ error: 'api_key required' }, { status: 401 })

  const supabase = createServiceClient()

  // Validate API key
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('api_key', api_key)
    .maybeSingle()

  if (!business) return NextResponse.json({ error: 'Invalid api_key' }, { status: 401 })

  // Verify post belongs to this business
  const { data: post } = await supabase
    .from('posts')
    .select('id, title, channel, business_id')
    .eq('id', id)
    .eq('business_id', business.id)
    .maybeSingle()

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const now = new Date().toISOString()

  // Mark post as published
  await supabase
    .from('posts')
    .update({
      status: 'published',
      webhook_status: 'confirmed',
      external_url: external_url ?? null,
      published_at: published_at ?? now,
      updated_at: now,
    })
    .eq('id', id)

  // Create agent_signal notification for the inbox
  await supabase.from('agent_signals').insert({
    business_id: business.id,
    type: 'content_published',
    title: '📤 Content Published on Website',
    body: `"${post.title || 'Post'}" was successfully published${external_url ? ` at ${external_url}` : ''} via your website integration.`,
    metadata: { post_id: id, channel: post.channel, external_url },
    dismissed: false,
    created_at: now,
  })

  // Update agent_memory: log published content for GEO context
  const { data: memRow } = await supabase
    .from('agent_memory')
    .select('id, value_text')
    .eq('business_id', business.id)
    .eq('key', 'published_content_log')
    .maybeSingle()

  type PublishedEntry = { post_id: string; title: string; channel: string; url: string | null; published_at: string }
  let log: PublishedEntry[] = []
  try { if (memRow?.value_text) log = JSON.parse(memRow.value_text) } catch { log = [] }

  log.unshift({ post_id: id, title: post.title || '', channel: post.channel, url: external_url ?? null, published_at: published_at ?? now })
  if (log.length > 50) log = log.slice(0, 50) // keep last 50

  const updatedText = JSON.stringify(log)
  if (memRow) {
    await supabase.from('agent_memory')
      .update({ value_text: updatedText, updated_at: now })
      .eq('business_id', business.id).eq('key', 'published_content_log')
  } else {
    await supabase.from('agent_memory')
      .insert({ business_id: business.id, key: 'published_content_log', value_text: updatedText, updated_at: now })
  }

  return NextResponse.json({
    ok: true,
    message: 'Post marked as published',
    post_id: id,
    external_url,
  })
}
