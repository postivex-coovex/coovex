import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Make (Integromat) inbound webhook
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-hook-secret') || req.headers.get('x-webhook-secret')
  const expectedSecret = process.env.WEBHOOK_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  const body = await req.json()
  // Make wraps payload in a bundle structure OR sends flat payload
  const payload = body.bundle?.inputData ?? body
  const { event, data, workspace_id } = payload

  if (!event || !workspace_id) {
    return NextResponse.json({ error: 'event and workspace_id required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('workspace_id', workspace_id)
    .maybeSingle()

  if (!business) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  switch (event) {
    case 'create_lead': {
      const { name, email, company, phone, source, notes } = data || {}
      if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
      const { data: lead, error } = await supabase.from('leads').insert({
        business_id: business.id, name, email: email || null,
        company: company || null, phone: phone || null,
        source: source || 'make', notes: notes || null,
        stage: 'new', score: 50,
      }).select('id, name').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, lead_id: lead.id, message: `Lead "${lead.name}" created` })
    }

    case 'create_signal': {
      const { title, body: signalBody, type = 'info', action_type } = data || {}
      if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
      await supabase.from('agent_signals').insert({
        business_id: business.id, type, title,
        body: signalBody || null, action_type: action_type || null, dismissed: false,
      })
      return NextResponse.json({ ok: true, message: 'Signal created' })
    }

    case 'update_lead_stage': {
      const { lead_id, stage } = data || {}
      if (!lead_id || !stage) return NextResponse.json({ error: 'lead_id and stage required' }, { status: 400 })
      await supabase.from('leads').update({ stage }).eq('id', lead_id).eq('business_id', business.id)
      return NextResponse.json({ ok: true, message: `Stage updated to ${stage}` })
    }

    case 'create_post': {
      const { content, channel, scheduled_for } = data || {}
      if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })
      const { data: post, error } = await supabase.from('posts').insert({
        business_id: business.id, content, channel: channel || 'linkedin',
        status: scheduled_for ? 'scheduled' : 'draft',
        scheduled_for: scheduled_for || null,
      }).select('id').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, post_id: post.id, message: 'Post created' })
    }

    default:
      return NextResponse.json({ error: `Unknown event: ${event}` }, { status: 400 })
  }
}

// Make polls this GET endpoint to verify connection
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const expectedSecret = process.env.WEBHOOK_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }
  return NextResponse.json({
    ok: true,
    service: 'CooVex',
    version: '1.0',
    supported_events: ['create_lead', 'create_signal', 'update_lead_stage', 'create_post'],
    timestamp: new Date().toISOString(),
  })
}
