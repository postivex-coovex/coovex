'use client'

import { useMemo } from 'react'
import { Globe2 } from 'lucide-react'
import { tzShortName } from '@/lib/meetings/tz'

export function allTimeZones(extra: string[] = []): string[] {
  let list: string[] = []
  try {
    list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
  } catch { /* older browsers */ }
  return [...new Set([...extra, ...list])].sort()
}

export function TimezoneSelect({ value, onChange, className = '' }: { value: string; onChange: (tz: string) => void; className?: string }) {
  const zones = useMemo(() => allTimeZones([value, 'UTC']), [value])
  return (
    <label className={`inline-flex items-center gap-1.5 text-xs text-slate-500 ${className}`}>
      <Globe2 className="w-3.5 h-3.5 shrink-0" />
      <select value={value} onChange={e => onChange(e.target.value)}
        className="bg-transparent border-0 text-xs text-slate-600 focus:outline-none focus:ring-0 max-w-[220px] cursor-pointer"
        aria-label="Timezone">
        {zones.map(z => <option key={z} value={z}>{z.replace(/_/g, ' ')} ({tzShortName(z)})</option>)}
      </select>
    </label>
  )
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
