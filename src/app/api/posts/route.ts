import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
    if (!profile?.current_workspace_id) return NextResponse.json({ posts: [] })

    const { data: business } = await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    if (!business) return NextResponse.json({ posts: [] })

    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ posts: posts || [] })
  } catch (error) {
    console.error('GET /api/posts error:', error)
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
    if (!business) return NextResponse.json({ error: 'No business found' }, { status: 400 })

    const body = await request.json()
    const { channel, content, status, scheduled_at } = body

    if (!channel || !content) return NextResponse.json({ error: 'channel and content are required' }, { status: 400 })

    const validChannels = ['linkedin', 'facebook', 'instagram', 'tiktok', 'wordpress']
    if (!validChannels.includes(channel)) return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })

    const { data: post, error } = await supabase.from('posts').insert({
      business_id: business.id,
      channel,
      content,
      status: status || 'draft',
      scheduled_at: scheduled_at || null,
      created_by: user.id,
    }).select().single()

    if (error) throw error
    return NextResponse.json({ post }, { status: 201 })
  } catch (error) {
    console.error('POST /api/posts error:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}
