import { NextRequest, NextResponse } from 'next/server'
import { authUser } from '@/lib/meetings/ops'
import { eventTypeSchema } from '@/lib/meetings/schemas'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const parsed = eventTypeSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const b = parsed.data
  if (b.location_type === 'host_provides') b.requires_confirmation = true

  const { data, error } = await auth.supabase
    .from('meeting_event_types').update(b).eq('id', id).eq('user_id', auth.user.id).select('*').single()
  if (error) {
    const status = error.code === '23505' ? 409 : 500
    return NextResponse.json({ error: status === 409 ? 'You already have a meeting type with that URL' : error.message }, { status })
  }
  return NextResponse.json({ eventType: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { error } = await auth.supabase.from('meeting_event_types').delete().eq('id', id).eq('user_id', auth.user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
