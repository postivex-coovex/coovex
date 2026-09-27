import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Properties with unread count from submissions join
  const { data } = await supabase
    .from('inquiry_properties')
    .select(`
      id, domain, label, created_at,
      inquiry_submissions(count)
    `)
    .eq('user_id', user.id)
    .eq('inquiry_submissions.is_read', false)
    .order('created_at', { ascending: false })

  const properties = (data ?? []).map(p => ({
    id: p.id,
    domain: p.domain,
    label: p.label,
    created_at: p.created_at,
    // @ts-expect-error supabase count type
    unread_count: p.inquiry_submissions?.[0]?.count ?? 0,
  }))

  return NextResponse.json({ properties })
}
