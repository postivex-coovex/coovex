'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { WebsiteCheck } from '@/lib/monitoring/types'

interface Props {
  checks: Pick<WebsiteCheck, 'checked_at' | 'load_time_ms' | 'is_up'>[]
  threshold?: number
}

export function ResponseTimeChart({ checks, threshold }: Props) {
  const data = [...checks]
    .reverse()
    .map(c => ({
      time: new Date(c.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ms: c.is_up ? (c.load_time_ms ?? null) : null,
      down: c.is_up ? null : 0,
    }))

  if (!data.length) {
    return <div className="flex items-center justify-center h-40 text-sm text-slate-400">No data yet</div>
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          interval="preserveStartEnd"
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={false}
          tickFormatter={v => `${v}ms`}
          width={48}
        />
        <Tooltip
          contentStyle={{ background: 'var(--background)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 8, fontSize: 12 }}
          formatter={(v: number) => [`${v}ms`, 'Response time']}
        />
        {threshold && (
          <ReferenceLine y={threshold} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'threshold', fontSize: 10, fill: '#f59e0b' }} />
        )}
        <Line
          type="monotone"
          dataKey="ms"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          activeDot={{ r: 4, fill: '#3b82f6' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
