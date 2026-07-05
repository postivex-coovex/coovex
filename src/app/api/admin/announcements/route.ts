import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) return null
  return user
}

export async function GET() {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServiceClient()
  const { data: announcements } = await supabase
    .from('admin_announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ announcements: announcements || [] })
}

export async function POST(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, body: msgBody, type, target } = body

  if (!title || !msgBody) return NextResponse.json({ error: 'Title and body required' }, { status: 400 })

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('admin_announcements')
    .insert({ title, body: msgBody, type, target, created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ announcement: data })
}

export async function PATCH(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, action } = body

  if (action !== 'send') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  const supabase = await createServiceClient()

  // Get announcement
  const { data: ann } = await supabase.from('admin_announcements').select('*').eq('id', id).single()
  if (!ann) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (ann.status === 'sent') return NextResponse.json({ error: 'Already sent' }, { status: 400 })

  // Count target users
  let query = supabase.from('profiles').select('id, email', { count: 'exact' })

  if (ann.target === 'trialing') {
    const { data: wsIds } = await supabase.from('subscriptions').select('workspace_id').eq('status', 'trialing')
    const ids = (wsIds || []).map(w => w.workspace_id)
    if (ids.length > 0) {
      const { data: members } = await supabase.from('workspace_members').select('user_id').in('workspace_id', ids)
      const userIds = [...new Set((members || []).map(m => m.user_id))]
      query = query.in('id', userIds)
    }
  } else if (ann.target === 'paid') {
    const { data: wsIds } = await supabase.from('subscriptions').select('workspace_id').eq('status', 'active')
    const ids = (wsIds || []).map(w => w.workspace_id)
    if (ids.length > 0) {
      const { data: members } = await supabase.from('workspace_members').select('user_id').in('workspace_id', ids)
      const userIds = [...new Set((members || []).map(m => m.user_id))]
      query = query.in('id', userIds)
    }
  } else if (ann.target === 'inactive') {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString()
    query = query.lt('updated_at', cutoff)
  }

  const { count } = await query
  const sentCount = count ?? 0

  // In production: trigger email sending via Resend/SendGrid here
  // For now: mark as sent with count
  await supabase.from('admin_announcements').update({
    status: 'sent',
    sent_count: sentCount,
    sent_at: new Date().toISOString(),
  }).eq('id', id)

  return NextResponse.json({ sent_count: sentCount })
}
