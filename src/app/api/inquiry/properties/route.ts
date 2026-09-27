import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: props } = await supabase
    .from('inquiry_properties')
    .select('id, domain, label, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (!props?.length) return NextResponse.json({ properties: [] })

  // Fetch unread counts per property in one query
  const { data: unreadRows } = await supabase
    .from('inquiry_submissions')
    .select('property_id')
    .in('property_id', props.map(p => p.id))
    .eq('is_read', false)

  const unreadMap: Record<string, number> = {}
  for (const row of unreadRows ?? []) {
    unreadMap[row.property_id] = (unreadMap[row.property_id] ?? 0) + 1
  }

  const properties = props.map(p => ({
    ...p,
    unread_count: unreadMap[p.id] ?? 0,
  }))

  return NextResponse.json({ properties })
}
