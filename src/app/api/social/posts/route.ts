import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SOCIAL_CHANNELS = ['linkedin', 'facebook', 'reddit', 'x', 'youtube'] as const

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
    if (!profile?.current_workspace_id) return NextResponse.json({ posts: [] })

    const { data: business } = await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    if (!business) return NextResponse.json({ posts: [] })

    const url = new URL(request.url)
    const channel = url.searchParams.get('channel')
    const status  = url.searchParams.get('status')

    let query = supabase
      .from('posts')
      .select('id, channel, content, status, scheduled_at, published_at, created_at, slug')
      .eq('business_id', business.id)
      .in('channel', channel ? [channel] : SOCIAL_CHANNELS)
      .order('created_at', { ascending: false })
      .limit(100)

    if (status) query = query.eq('status', status)

    const { data: posts, error } = await query
    if (error) throw error
    return NextResponse.json({ posts: posts || [] })
  } catch (err) {
    console.error('GET /api/social/posts error:', err)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
    if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    const { data: business } = await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

    const { channel, content, status } = await request.json()
    if (!channel || !content) return NextResponse.json({ error: 'channel and content required' }, { status: 400 })
    if (!SOCIAL_CHANNELS.includes(channel)) return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })

    const { data: post, error } = await supabase.from('posts').insert({
      business_id: business.id,
      channel,
      content,
      status: status || 'pending_approval',
      created_by: user.id,
    }).select('id, channel, content, status, scheduled_at, published_at, created_at, slug').single()

    if (error) throw error
    return NextResponse.json({ post }, { status: 201 })
  } catch (err) {
    console.error('POST /api/social/posts error:', err)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}
