import { addDaysYmd, weekdayOfYmd, ymdInTz, zonedToUtcMs } from './tz'

export interface WeeklyRule { weekday: number; start_minute: number; end_minute: number }
export interface DateOverride { date: string; start_minute: number | null; end_minute: number | null }
export interface BusyRange { start: number; end: number } // epoch ms, end exclusive

export interface SlotEventConfig {
  duration_min: number
  buffer_before_min: number
  buffer_after_min: number
  min_notice_hours: number
  max_days_ahead: number
  slot_interval_min: number
}

export interface SlotContext {
  hostTz: string
  weekly: WeeklyRule[]
  overrides: DateOverride[]
  busy: BusyRange[]
  event: SlotEventConfig
  now?: number
}

/** Available intervals (minutes from midnight, host tz) for one host-local date. */
function intervalsForDate(ymd: string, ctx: SlotContext): { start: number; end: number }[] {
  const overrides = ctx.overrides.filter(o => o.date === ymd)
  if (overrides.length > 0) {
    if (overrides.some(o => o.start_minute === null || o.end_minute === null)) return [] // blocked day
    return overrides.map(o => ({ start: o.start_minute as number, end: o.end_minute as number }))
  }
  const wd = weekdayOfYmd(ymd)
  return ctx.weekly.filter(r => r.weekday === wd).map(r => ({ start: r.start_minute, end: r.end_minute }))
}

/**
 * Bookable slot start times (ISO, UTC) for host-local dates in [fromYmd, toYmd].
 * Respects notice, horizon, buffers and existing bookings.
 */
export function computeSlots(ctx: SlotContext, fromYmd: string, toYmd: string): string[] {
  const now = ctx.now ?? Date.now()
  const { event } = ctx
  const earliest = now + event.min_notice_hours * 3600_000
  const latest = now + event.max_days_ahead * 86400_000
  const durMs = event.duration_min * 60_000
  const beforeMs = event.buffer_before_min * 60_000
  const afterMs = event.buffer_after_min * 60_000
  const step = Math.max(5, event.slot_interval_min)

  const out = new Set<number>()
  let day = fromYmd
  for (let guard = 0; day <= toYmd && guard < 400; guard++, day = addDaysYmd(day, 1)) {
    for (const iv of intervalsForDate(day, ctx)) {
      for (let t = iv.start; t + event.duration_min <= iv.end; t += step) {
        const startMs = zonedToUtcMs(day, t, ctx.hostTz)
        if (startMs < earliest || startMs > latest) continue
        const endMs = startMs + durMs
        const clash = ctx.busy.some(b => startMs - beforeMs < b.end && endMs + afterMs > b.start)
        if (!clash) out.add(startMs)
      }
    }
  }
  return [...out].sort((a, b) => a - b).map(ms => new Date(ms).toISOString())
}

/** Is `startIso` a currently bookable slot? (server-side re-validation) */
export function isSlotAvailable(ctx: SlotContext, startIso: string): boolean {
  const ms = new Date(startIso).getTime()
  if (!Number.isFinite(ms)) return false
  const day = ymdInTz(ms, ctx.hostTz)
  return computeSlots(ctx, addDaysYmd(day, -1), addDaysYmd(day, 1)).includes(new Date(ms).toISOString())
}
