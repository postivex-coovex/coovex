// Timezone helpers built on Intl only (no extra dependency).

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Offset (local - UTC) in minutes for a timezone at a given instant. */
export function tzOffsetMinutes(tz: string, utcMs: number): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p: Record<string, number> = {}
  for (const part of dtf.formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value)
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000)
}

/** Convert a wall-clock time (date + minutes from midnight) in `tz` to a UTC epoch ms. */
export function zonedToUtcMs(ymd: string, minuteOfDay: number, tz: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, 0, 0) + minuteOfDay * 60000
  const off1 = tzOffsetMinutes(tz, guess)
  let result = guess - off1 * 60000
  const off2 = tzOffsetMinutes(tz, result)
  if (off2 !== off1) result = guess - off2 * 60000
  return result
}

/** YYYY-MM-DD of an instant as seen in `tz`. */
export function ymdInTz(utcMs: number, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(utcMs))
  const g = (t: string) => parts.find(p => p.type === t)!.value
  return `${g('year')}-${g('month')}-${g('day')}`
}

/** Minutes from midnight of an instant as seen in `tz`. */
export function minuteOfDayInTz(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(utcMs))
  const g = (t: string) => Number(parts.find(p => p.type === t)!.value)
  return g('hour') * 60 + g('minute')
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

/** 0 = Sunday … 6 = Saturday for a calendar date (timezone independent). */
export function weekdayOfYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function formatDateTimeInTz(iso: string | number | Date, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(iso))
}

export function formatTimeInTz(iso: string | number | Date, tz: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

/** Short zone label such as "GMT+6" or "EST". */
export function tzShortName(tz: string, at: string | number | Date = Date.now()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date(at))
    return parts.find(p => p.type === 'timeZoneName')?.value ?? tz
  } catch {
    return tz
  }
}
