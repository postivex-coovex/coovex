'use client'

import { useState, useEffect } from 'react'

interface ActivityItem {
  id: string
  icon: string
  label: string
  detail: string
  category: 'insight' | 'content' | 'lead' | 'audit' | 'campaign'
  minutesSaved: number
}

const CATEGORY_COLOR: Record<ActivityItem['category'], string> = {
  insight:  'bg-violet-500/10 border-violet-500/20 text-violet-400',
  content:  'bg-blue-500/10 border-blue-500/20 text-blue-400',
  lead:     'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  audit:    'bg-amber-500/10 border-amber-500/20 text-amber-400',
  campaign: 'bg-pink-500/10 border-pink-500/20 text-pink-400',
}

export function AIActivityCard() {
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [minutesSaved, setMinutesSaved] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch('/api/agent/activity')
      .then(r => r.json())
      .then(d => {
        setActivity(d.activity ?? [])
        setMinutesSaved(d.minutesSaved ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const hours = Math.floor(minutesSaved / 60)
  const mins  = minutesSaved % 60
  const timeSaved = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`

  const visible = expanded ? activity : activity.slice(0, 3)

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 animate-pulse">
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-3" />
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-800 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (activity.length === 0) return null

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          {/* Pulse dot */}
          <div className="relative flex-shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block" />
            <span className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-50" />
          </div>
          <div>
            <h3 className="text-white text-sm font-semibold">AI Agent — Last 7 Days</h3>
            <p className="text-slate-500 text-xs">Running 24/7 on your behalf</p>
          </div>
        </div>
        {/* Time saved badge */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
            <span className="text-emerald-400 text-xs">⚡</span>
            <span className="text-emerald-300 text-xs font-medium">{timeSaved} saved</span>
          </div>
        </div>
      </div>

      {/* Activity list */}
      <div className="p-4 space-y-2">
        {visible.map(item => (
          <div
            key={item.id}
            className={`flex items-start gap-3 rounded-xl border px-3.5 py-2.5 ${CATEGORY_COLOR[item.category]}`}
          >
            <span className="text-lg leading-none flex-shrink-0 mt-0.5">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white leading-snug">{item.label}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">{item.detail}</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <span className="text-[10px] text-slate-600 font-medium">~{item.minutesSaved}m saved</span>
            </div>
          </div>
        ))}

        {activity.length > 3 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full text-center text-xs text-slate-500 hover:text-slate-300 py-1.5 transition-colors"
          >
            {expanded ? '▲ Show less' : `▼ Show ${activity.length - 3} more actions`}
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-slate-800/60 flex items-center justify-between">
        <p className="text-slate-600 text-xs">
          Your AI agent works automatically — no manual input needed
        </p>
        <div className="sm:hidden flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
          <span className="text-emerald-400 text-[10px]">⚡ {timeSaved} saved</span>
        </div>
      </div>
    </div>
  )
}
