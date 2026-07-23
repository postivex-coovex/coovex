import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const allowed = ['content', 'status', 'slug'] // slug stores published_url for social posts
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }
    if (body.status === 'published') updates.published_at = new Date().toISOString()

    const { data: post, error } = await supabase
      .from('posts').update(updates).eq('id', id)
      .select('id, channel, content, status, scheduled_at, published_at, created_at, slug').single()

    if (error) throw error
    return NextResponse.json({ post })
  } catch (err) {
    console.error('PATCH /api/social/posts/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('posts').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/social/posts/[id] error:', err)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}
