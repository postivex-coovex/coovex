import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const property_id = searchParams.get('property_id')
  const status      = searchParams.get('status')
  const source      = searchParams.get('source')
  const search      = searchParams.get('search')
  const limit       = parseInt(searchParams.get('limit') ?? '50')
  const offset      = parseInt(searchParams.get('offset') ?? '0')

  let query = supabase
    .from('support_conversations')
    .select(`
      id, property_id, customer_email, customer_name, subject,
      status, source, is_read, last_message_at, created_at,
      support_properties!inner(id, name, domain, widget_color)
    `)
    .eq('user_id', user.id)
    .order('last_message_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (property_id) query = query.eq('property_id', property_id)
  if (status)      query = query.eq('status', status)
  if (source)      query = query.eq('source', source)
  if (search) {
    query = query.or(`customer_email.ilike.%${search}%,customer_name.ilike.%${search}%,subject.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Count unread per conversation (last message from customer not read by agent)
  return NextResponse.json(data ?? [])
}
