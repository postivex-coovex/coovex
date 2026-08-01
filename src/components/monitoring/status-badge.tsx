'use client'

import type { WebsiteStatus } from '@/lib/monitoring/types'

const CONFIG: Record<WebsiteStatus, { label: string; dot: string; bg: string; text: string }> = {
  up:       { label: 'UP',       dot: 'bg-green-500',  bg: 'bg-green-50 dark:bg-green-950/40',  text: 'text-green-700 dark:text-green-400' },
  down:     { label: 'DOWN',     dot: 'bg-red-500',    bg: 'bg-red-50 dark:bg-red-950/40',      text: 'text-red-700 dark:text-red-400' },
  checking: { label: 'CHECKING', dot: 'bg-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-950/40',text: 'text-yellow-700 dark:text-yellow-400' },
  unknown:  { label: 'UNKNOWN',  dot: 'bg-slate-400',  bg: 'bg-slate-100 dark:bg-slate-800',    text: 'text-slate-600 dark:text-slate-400' },
}

export function StatusBadge({ status, size = 'sm' }: { status: WebsiteStatus; size?: 'sm' | 'md' | 'lg' }) {
  const c = CONFIG[status] ?? CONFIG.unknown
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${c.bg} ${c.text} ${size === 'lg' ? 'px-3 py-1.5 text-sm' : size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-xs'}`}>
      <span className={`inline-block rounded-full ${c.dot} ${size === 'lg' ? 'w-2.5 h-2.5' : 'w-2 h-2'} ${status === 'checking' ? 'animate-pulse' : ''}`} />
      {c.label}
    </span>
  )
}

export function StatusDot({ status }: { status: WebsiteStatus }) {
  const c = CONFIG[status] ?? CONFIG.unknown
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${c.dot} ${status === 'checking' ? 'animate-pulse' : ''} flex-shrink-0`} />
  )
}
