'use client'

import { useState } from 'react'

interface DailyBriefCardProps {
  businessName: string
  userName: string
}

export function DailyBriefCard({ businessName, userName }: DailyBriefCardProps) {
  const [brief, setBrief] = useState<string | null>(null)
  const [stats, setStats] = useState<{ urgentCount: number; newLeads: number; newReviews: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch('/api/agent/brief', { method: 'POST' })
      const data = await res.json()
      if (data.brief) { setBrief(data.brief); setStats(data.stats); setGenerated(true) }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gradient-to-r from-violet-950/50 to-slate-900 border border-violet-800/30 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-slate-400 text-xs mb-0.5">{day}</p>
          <h2 className="text-white font-semibold text-base">
            {greeting}, {userName || businessName}
          </h2>

          {generated && brief ? (
            <p className="text-slate-300 text-sm mt-2 leading-relaxed">{brief}</p>
          ) : (
            <p className="text-slate-400 text-sm mt-1">Your AI agent is ready. Get your daily brief.</p>
          )}

          {stats && (
            <div className="flex items-center gap-4 mt-3">
              {stats.urgentCount > 0 && (
                <span className="text-xs text-red-400 bg-red-950/40 border border-red-800/30 px-2 py-0.5 rounded-full">
                  {stats.urgentCount} urgent
                </span>
              )}
              {stats.newLeads > 0 && (
                <span className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/30 px-2 py-0.5 rounded-full">
                  +{stats.newLeads} new leads
                </span>
              )}
              {stats.newReviews > 0 && (
                <span className="text-xs text-amber-400 bg-amber-950/40 border border-amber-800/30 px-2 py-0.5 rounded-full">
                  {stats.newReviews} reviews waiting
                </span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={generate}
          disabled={loading}
          className="flex-shrink-0 flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
        >
          {loading ? (
            <><div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> Thinking…</>
          ) : (
            <>✨ {generated ? 'Refresh' : 'Daily Brief'}</>
          )}
        </button>
      </div>
    </div>
  )
}
