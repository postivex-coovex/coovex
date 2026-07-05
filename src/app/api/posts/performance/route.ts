import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ posts: [], mock: false, no_business: true })

  const { data: posts } = await supabase
    .from('posts')
    .select('id, title, content, channel, status, created_at, scheduled_at')
    .eq('business_id', business.id)
    .in('status', ['published', 'scheduled', 'draft'])
    .order('created_at', { ascending: false })
    .limit(50)

  if (!posts || posts.length === 0) {
    return NextResponse.json({ posts: [], mock: false, empty: true })
  }

  // Real posts — engagement zeros until social OAuth connected
  const postsWithStats = posts.map(p => ({
    ...p,
    views:    0,
    likes:    0,
    comments: 0,
    shares:   0,
    ctr:      0,
  }))

  const byChannel: Record<string, { channel: string; posts: number; total_views: number; total_likes: number }> = {}
  for (const p of postsWithStats) {
    if (!byChannel[p.channel]) byChannel[p.channel] = { channel: p.channel, posts: 0, total_views: 0, total_likes: 0 }
    byChannel[p.channel].posts++
  }

  return NextResponse.json({
    posts: postsWithStats,
    by_channel: Object.values(byChannel),
    mock: false,
  })
}
