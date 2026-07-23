'use client'

import { useState } from 'react'
import Link from 'next/link'

interface TrialBannerProps {
  daysLeft: number
}

export function TrialBanner({ daysLeft }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const isExpired = daysLeft <= 0
  const isUrgent = daysLeft <= 3

  return (
    <div className={`flex items-center justify-between px-4 py-2 text-xs ${
      isExpired
        ? 'bg-red-950/80 border-b border-red-800/50 text-red-300'
        : isUrgent
        ? 'bg-slate-950/80 border-b border-slate-700/50 text-slate-400'
        : 'bg-slate-950/60 border-b border-slate-700/40 text-blue-300'
    }`}>
      <span>
        {isExpired
          ? '⚠️ Your free trial has expired. Upgrade to keep your data and automation.'
          : `⏳ Free trial — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining. Upgrade to unlock full access.`
        }
      </span>
      <div className="flex items-center gap-3 ml-4 flex-shrink-0">
        <Link
          href="/settings/billing"
          className={`font-semibold hover:underline ${isExpired ? 'text-red-200' : isUrgent ? 'text-slate-300' : 'text-blue-200'}`}
        >
          {isExpired ? 'Upgrade now →' : 'View plans →'}
        </Link>
        {!isExpired && (
          <button onClick={() => setDismissed(true)} className="text-slate-500 hover:text-slate-300 text-base leading-none">×</button>
        )}
      </div>
    </div>
  )
}
