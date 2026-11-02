import { NextResponse } from 'next/server'
import { db, getHostById } from '@/lib/meetings/service'
import { notifyBooking } from '@/lib/meetings/notify'
import type { MeetingBooking } from '@/lib/meetings/types'

export const maxDuration = 60

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = db()
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  let sent = 0

  // 1) Mark finished meetings as completed
  await supabase.from('meeting_bookings').update({ status: 'completed' }).eq('status', 'confirmed').lt('end_at', nowIso)

  // 2) Reminders. Claim the row first (flag flip) so overlapping runs never double-send.
  const jobs = [
    { kind: 'reminder_24h' as const, flag: 'reminder_24h_sent', until: now + 24 * 3600_000, minLead: 24 * 3600_000 },
    { kind: 'reminder_1h' as const, flag: 'reminder_1h_sent', until: now + 3600_000, minLead: 0 },
  ]
  const hosts = new Map<string, Awaited<ReturnType<typeof getHostById>>>()

  for (const job of jobs) {
    const { data } = await supabase.from('meeting_bookings').select('*')
      .eq('status', 'confirmed').eq(job.flag, false)
      .gt('start_at', nowIso).lte('start_at', new Date(job.until).toISOString()).limit(50)

    for (const row of (data ?? []) as MeetingBooking[]) {
      // Skip the 24h reminder for meetings booked less than 24h ahead
      if (new Date(row.start_at).getTime() - new Date(row.created_at).getTime() < job.minLead) {
        await supabase.from('meeting_bookings').update({ [job.flag]: true }).eq('id', row.id)
        continue
      }
      const { data: claimed } = await supabase.from('meeting_bookings')
        .update({ [job.flag]: true }).eq('id', row.id).eq(job.flag, false).select('id')
      if (!claimed?.length) continue

      if (!hosts.has(row.user_id)) hosts.set(row.user_id, await getHostById(supabase, row.user_id))
      const host = hosts.get(row.user_id)
      if (!host) continue
      await notifyBooking(supabase, job.kind, row, host)
      sent++
    }
  }

  return NextResponse.json({ ok: true, reminders_sent: sent })
}
