import { NextRequest, NextResponse } from 'next/server'
import { eventTypeSchema } from '@/lib/meetings/schemas'
import { authUser } from '@/lib/meetings/ops'
import { slugify } from '@/lib/meetings/service'

export async function GET() {
  const auth = await authUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await auth.supabase
    .from('meeting_event_types').select('*').eq('user_id', auth.user.id).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ eventTypes: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await authUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = eventTypeSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const b = parsed.data
  // The host adds the link at confirmation time, so confirmation is mandatory
  if (b.location_type === 'host_provides') b.requires_confirmation = true

  const base = b.slug || slugify(b.title) || 'meeting'
  let lastErr = ''
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 5)}`
    const { data, error } = await auth.supabase
      .from('meeting_event_types').insert({ ...b, slug, user_id: auth.user.id }).select('*').single()
    if (!error) return NextResponse.json({ eventType: data })
    if (error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 })
    if (b.slug) return NextResponse.json({ error: 'You already have a meeting type with that URL' }, { status: 409 })
    lastErr = error.message
  }
  return NextResponse.json({ error: lastErr || 'Could not create meeting type' }, { status: 500 })
}
