'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RedditTrends from '@/components/content/reddit-trends'

interface Trend {
  title: string
  summary: string
  impact: 'high' | 'medium' | 'low'
  category: string
  action_tip: string
  stat?: string
  relevance?: 'high' | 'medium' | 'low'
}

const IMPACT_META = {
  high:   { badge: 'bg-red-950/50 text-red-400 border-red-900/50',    label: 'High' },
  medium: { badge: 'bg-slate-950/50 text-slate-500 border-slate-800/50', label: 'Medium' },
  low:    { badge: 'bg-slate-800 text-slate-400 border-slate-700',    label: 'Low' },
}
const CATEGORY_ICONS: Record<string, string> = {
  ai: '🤖', consumer: '👥', regulation: '⚖️',
  technology: '💻', market: '📈', sustainability: '🌱',
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function TrendsClient({
  industry, country, initialTrends, generatedAt, nextRefreshIn,
}: {
  industry: string
  country: string
  initialTrends: unknown[]
  generatedAt: string | null
  nextRefreshIn: number
}) {
  const router = useRouter()
  const [trends, setTrends]     = useState<Trend[]>(initialTrends as Trend[])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [lastGen, setLastGen]   = useState<string | null>(generatedAt)
  const [nextIn, setNextIn]     = useState(nextRefreshIn)

  const canRefresh = nextIn <= 0

  async function generate(force = false) {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const d = await res.json() as { trends?: Trend[]; error?: string; generated_at?: string; next_refresh_in?: number; cached?: boolean }
      if (d.trends) {
        setTrends(d.trends)
        setLastGen(d.generated_at ?? new Date().toISOString())
        setNextIn(d.next_refresh_in ?? 6)
        router.refresh()
      } else {
        setError(d.error ?? 'Failed to generate trends')
      }
    } finally { setLoading(false) }
  }

  const highCount   = trends.filter(t => t.impact === 'high').length
  const highRelCount = trends.filter(t => t.relevance === 'high').length

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Industry Trends</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            AI-curated for <span className="text-blue-400">{industry}</span>
            {country && <> · <span className="text-slate-300">{country}</span></>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={() => generate(canRefresh)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> Generating…</>
            ) : (
              <>{trends.length > 0 ? '✨ Refresh with AI' : '✨ Generate Trends'}</>
            )}
          </button>
          {lastGen && (
            <p className="text-slate-600 text-xs">
              Generated {timeAgo(lastGen)}
              {nextIn > 0 && <span> · refresh in {nextIn.toFixed(1)}h</span>}
            </p>
          )}
          {!lastGen && trends.length === 0 && !loading && (
            <p className="text-slate-600 text-xs">Click to generate your first trend report</p>
          )}
        </div>
      </div>

      {/* What this page does */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl shrink-0">📡</div>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm mb-1">What is this page?</p>
            <p className="text-slate-400 text-sm leading-relaxed">
              This page shows <span className="text-white">6 AI-generated industry trends</span> tailored specifically to your business —
              using your industry, country, competitor data, win rate, and pipeline stats.
              Each trend comes with a <span className="text-blue-300">key stat</span>, an <span className="text-slate-400">action tip</span> you can act on this month,
              and a button to <span className="text-blue-300">instantly create a social post</span> from the trend.
            </p>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { icon: '🔍', title: 'Stay ahead', desc: 'Know what\'s shifting in your market before competitors do' },
                { icon: '✍️', title: 'Create content', desc: 'Turn every trend into a ready-to-publish social post in one click' },
                { icon: '⚡', title: 'Take action', desc: 'Each trend has a specific action you can take this month' },
              ].map(b => (
                <div key={b.title} className="bg-slate-800/50 rounded-xl p-3">
                  <div className="text-lg mb-1">{b.icon}</div>
                  <p className="text-white text-xs font-medium">{b.title}</p>
                  <p className="text-slate-500 text-[10px] mt-0.5 leading-relaxed">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Reddit Trends */}
      <div className="mb-6">
        <RedditTrends />
      </div>

      {error && (
        <div className="mb-5 p-3 bg-red-950/20 border border-red-800/30 rounded-xl text-red-400 text-sm">❌ {error}</div>
      )}

      {/* Empty state */}
      {!loading && trends.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 text-center">
          <div className="text-5xl mb-4">📡</div>
          <p className="text-white font-semibold text-lg">No trends generated yet</p>
          <p className="text-slate-400 text-sm mt-2 mb-6 max-w-md mx-auto">
            Click "Generate Trends" to get AI-curated industry insights personalized for your business — including your competitors, win rate, and top channels.
          </p>
          <button onClick={() => generate(true)} disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
            ✨ Generate Trends Now
          </button>
        </div>
      )}

      {(loading || trends.length > 0) && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'High Impact', value: loading ? '—' : highCount.toString(), color: 'text-red-400', sub: 'trends to act on now' },
              { label: 'Relevant to You', value: loading ? '—' : highRelCount.toString(), color: 'text-blue-400', sub: 'directly applicable' },
              { label: 'Last Updated', value: loading ? 'Generating…' : lastGen ? timeAgo(lastGen) : '—', color: 'text-slate-300', sub: 'from your business data' },
            ].map(s => (
              <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <p className="text-slate-500 text-xs mb-1">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-slate-700 text-[10px] mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Trend grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 animate-pulse space-y-3">
                  <div className="h-4 bg-slate-800 rounded w-3/4" />
                  <div className="h-3 bg-slate-800 rounded w-full" />
                  <div className="h-3 bg-slate-800 rounded w-5/6" />
                  <div className="h-16 bg-slate-800/60 rounded-xl" />
                </div>
              ))
            ) : (
              trends.map((trend, i) => {
                const im  = IMPACT_META[trend.impact] ?? IMPACT_META.low
                const isHighRelevance = trend.relevance === 'high'
                return (
                  <div key={i} className={`bg-slate-900 border rounded-2xl p-5 transition-colors hover:border-slate-700 ${
                    isHighRelevance ? 'border-slate-700/40' : 'border-slate-800'
                  }`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl shrink-0">{CATEGORY_ICONS[trend.category] ?? '📌'}</span>
                        <h3 className="text-white font-semibold text-sm leading-snug">{trend.title}</h3>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${im.badge}`}>
                          {im.label}
                        </span>
                        {isHighRelevance && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-950/50 text-blue-400 border border-slate-700/40 rounded-full">
                            For you
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-slate-400 text-sm leading-relaxed mb-3">{trend.summary}</p>

                    {trend.stat && (
                      <div className="mb-3 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                        <p className="text-blue-300 text-xs font-medium">📊 {trend.stat}</p>
                      </div>
                    )}

                    <div className="bg-slate-800/60 rounded-xl p-3 mb-3">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Action Tip</p>
                      <p className="text-slate-300 text-sm leading-relaxed">{trend.action_tip}</p>
                    </div>

                    <button
                      onClick={() => {
                        const params = new URLSearchParams({ trend: trend.title, tip: trend.action_tip })
                        router.push(`/content?${params.toString()}`)
                      }}
                      className="w-full text-xs font-medium px-3 py-2 bg-slate-950/50 hover:bg-slate-900/50 text-blue-300 border border-slate-800/50 rounded-lg transition-colors"
                    >
                      ✍️ Create Post from This Trend
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {trends.length > 0 && !loading && (
            <p className="text-slate-700 text-xs text-center mt-6">
              Trends generated by AI using your business data (industry, competitors, pipeline metrics).
              Refresh every {6}h for updated insights.
            </p>
          )}
        </>
      )}
    </div>
  )
}
