import { NextRequest, NextResponse } from 'next/server'
import { authUser } from '@/lib/meetings/ops'
import { availabilitySchema } from '@/lib/meetings/schemas'

export async function GET() {
  const auth = await authUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const today = new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10)
  const [weekly, overrides] = await Promise.all([
    auth.supabase.from('meeting_availability').select('weekday, start_minute, end_minute').eq('user_id', auth.user.id).order('weekday').order('start_minute'),
    auth.supabase.from('meeting_date_overrides').select('date, start_minute, end_minute').eq('user_id', auth.user.id).gte('date', today).order('date'),
  ])
  return NextResponse.json({ weekly: weekly.data ?? [], overrides: overrides.data ?? [] })
}

export async function PUT(req: NextRequest) {
  const auth = await authUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = availabilitySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { weekly, overrides } = parsed.data

  // Overlapping intervals on the same weekday would produce duplicate slots
  const byDay = new Map<number, { s: number; e: number }[]>()
  for (const w of weekly) byDay.set(w.weekday, [...(byDay.get(w.weekday) ?? []), { s: w.start_minute, e: w.end_minute }])
  for (const list of byDay.values()) {
    list.sort((a, b) => a.s - b.s)
    for (let i = 1; i < list.length; i++) {
      if (list[i].s < list[i - 1].e) return NextResponse.json({ error: 'Time ranges on the same day must not overlap' }, { status: 400 })
    }
  }

  const uid = auth.user.id
  const { error: d1 } = await auth.supabase.from('meeting_availability').delete().eq('user_id', uid)
  const { error: d2 } = await auth.supabase.from('meeting_date_overrides').delete().eq('user_id', uid)
  if (d1 || d2) return NextResponse.json({ error: (d1 || d2)!.message }, { status: 500 })

  if (weekly.length) {
    const { error } = await auth.supabase.from('meeting_availability').insert(weekly.map(w => ({ ...w, user_id: uid })))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (overrides.length) {
    const { error } = await auth.supabase.from('meeting_date_overrides').insert(overrides.map(o => ({ ...o, user_id: uid })))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
