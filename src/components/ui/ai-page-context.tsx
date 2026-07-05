'use client'

import { useState } from 'react'

interface AIPageContextProps {
  title: string
  subtitle: string
  automations: string[]
  manual?: string[]
  accent?: 'violet' | 'emerald' | 'blue' | 'amber'
}

const ACCENT = {
  violet: {
    border: 'border-violet-500/20',
    bg:     'bg-violet-500/5',
    icon:   'bg-violet-500/15 border-violet-500/25',
    badge:  'bg-violet-500/15 text-violet-300 border-violet-500/25',
    dot:    'bg-violet-500',
    title:  'text-violet-300',
  },
  emerald: {
    border: 'border-emerald-500/20',
    bg:     'bg-emerald-500/5',
    icon:   'bg-emerald-500/15 border-emerald-500/25',
    badge:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    dot:    'bg-emerald-500',
    title:  'text-emerald-300',
  },
  blue: {
    border: 'border-blue-500/20',
    bg:     'bg-blue-500/5',
    icon:   'bg-blue-500/15 border-blue-500/25',
    badge:  'bg-blue-500/15 text-blue-300 border-blue-500/25',
    dot:    'bg-blue-500',
    title:  'text-blue-300',
  },
  amber: {
    border: 'border-amber-500/20',
    bg:     'bg-amber-500/5',
    icon:   'bg-amber-500/15 border-amber-500/25',
    badge:  'bg-amber-500/15 text-amber-300 border-amber-500/25',
    dot:    'bg-amber-500',
    title:  'text-amber-300',
  },
}

export function AIPageContext({
  title,
  subtitle,
  automations,
  manual = [],
  accent = 'violet',
}: AIPageContextProps) {
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const c = ACCENT[accent]

  if (dismissed) return null

  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} overflow-hidden mb-5`}>
      <div className="flex items-start justify-between gap-4 px-4 py-3.5">
        {/* Left: robot icon + title */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`flex-shrink-0 w-8 h-8 rounded-lg border ${c.icon} flex items-center justify-center text-base mt-0.5`}>
            🤖
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`text-sm font-semibold ${c.title}`}>{title}</h3>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${c.badge}`}>
                AI-Powered
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{subtitle}</p>

            {/* Automation list — always visible first 2, rest on expand */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {automations.slice(0, expanded ? undefined : 3).map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-slate-300">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
                  {a}
                </div>
              ))}
              {!expanded && automations.length > 3 && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  +{automations.length - 3} more →
                </button>
              )}
            </div>

            {/* What you do manually */}
            {expanded && manual.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-xs text-slate-600 mr-1">You control:</span>
                {manual.map((m, i) => (
                  <span key={i} className="text-xs text-slate-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600 flex-shrink-0" />
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: dismiss */}
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-slate-600 hover:text-slate-400 transition-colors text-xs mt-0.5"
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
