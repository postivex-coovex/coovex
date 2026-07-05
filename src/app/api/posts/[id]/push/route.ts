import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createHmac } from 'crypto'

// POST /api/posts/[id]/push
// Manually push a specific post to the user's registered webhook URL

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('current_workspace_id').eq('id', session.user.id).single()
    if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    const { data: business } = await supabase
      .from('businesses').select('id, name, api_key, webhook_url, webhook_secret')
      .eq('workspace_id', profile.current_workspace_id).maybeSingle()
    if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

    if (!business.webhook_url) {
      return NextResponse.json({ error: 'No webhook URL configured. Add one in Settings → Integrations.' }, { status: 400 })
    }

    const { data: post } = await supabase
      .from('posts')
      .select('id, title, content, channel, status')
      .eq('id', id)
      .eq('business_id', business.id)
      .maybeSingle()

    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    const payload = {
      post_id: post.id,
      title: post.title ?? '',
      content: post.content,
      channel: post.channel,
      status: post.status,
      business: business.name,
      confirm_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/public/posts/${post.id}/confirm`,
      api_key: business.api_key,
      pushed_at: new Date().toISOString(),
    }

    const body = JSON.stringify(payload)

    // HMAC signature so user's site can verify it's really CooVex
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-CooVex-Event': 'post.push',
      'X-CooVex-Post-Id': post.id,
    }
    if (business.webhook_secret) {
      const sig = createHmac('sha256', business.webhook_secret).update(body).digest('hex')
      headers['X-CooVex-Signature'] = `sha256=${sig}`
    }

    const response = await fetch(business.webhook_url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(15000),
    })

    const service = createServiceClient()

    if (!response.ok) {
      await service.from('posts').update({ webhook_status: 'failed', updated_at: new Date().toISOString() }).eq('id', id)
      return NextResponse.json({
        error: `Webhook failed: ${response.status} ${response.statusText}`,
        hint: 'Check that your webhook URL is correct and accepting POST requests.',
      }, { status: 502 })
    }

    // Mark as pushed (awaiting confirmation from website)
    await service.from('posts').update({ webhook_status: 'pushed', updated_at: new Date().toISOString() }).eq('id', id)

    return NextResponse.json({ ok: true, message: 'Post pushed to your website. Awaiting publish confirmation.' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Push failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
