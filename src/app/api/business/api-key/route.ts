import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { randomBytes } from 'crypto'

function generateApiKey() {
  return 'cvx_' + randomBytes(24).toString('hex')
}

// GET — fetch current api_key (or generate if missing)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('current_workspace_id').eq('id', session.user.id).single()
    if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    const { data: business } = await supabase
      .from('businesses').select('id, api_key, webhook_url, webhook_secret, auto_push').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

    // Auto-generate if missing
    if (!business.api_key) {
      const newKey = generateApiKey()
      const service = createServiceClient()
      await service.from('businesses').update({ api_key: newKey }).eq('id', business.id)
      return NextResponse.json({ api_key: newKey, webhook_url: business.webhook_url, webhook_secret: business.webhook_secret, auto_push: business.auto_push ?? false })
    }

    return NextResponse.json({ api_key: business.api_key, webhook_url: business.webhook_url, webhook_secret: business.webhook_secret, auto_push: business.auto_push ?? false })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// POST — regenerate api_key
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('current_workspace_id').eq('id', session.user.id).single()
    if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    const { data: business } = await supabase
      .from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

    const newKey = generateApiKey()
    const service = createServiceClient()
    await service.from('businesses').update({ api_key: newKey }).eq('id', business.id)

    return NextResponse.json({ api_key: newKey })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// PATCH — save webhook_url + webhook_secret
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { webhook_url?: string; webhook_secret?: string; auto_push?: boolean }

    const { data: profile } = await supabase
      .from('profiles').select('current_workspace_id').eq('id', session.user.id).single()
    if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    const { data: business } = await supabase
      .from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

    const updates: Record<string, string | boolean> = {}
    if (body.webhook_url    !== undefined) updates.webhook_url    = body.webhook_url
    if (body.webhook_secret !== undefined) updates.webhook_secret = body.webhook_secret
    if (body.auto_push      !== undefined) updates.auto_push      = body.auto_push

    const service = createServiceClient()
    await service.from('businesses').update(updates).eq('id', business.id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
