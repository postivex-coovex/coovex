'use client'

import { useState } from 'react'
import Link from 'next/link'

interface ContentGap {
  type: string
  suggestion: string
  impact: 'high' | 'medium' | 'low'
}

const IMPACT_STYLE = {
  high:   { badge: 'bg-rose-500/15 text-rose-400 border-rose-500/25',   dot: 'bg-rose-400' },
  medium: { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25', dot: 'bg-amber-400' },
  low:    { badge: 'bg-slate-700/50 text-slate-400 border-slate-600/25', dot: 'bg-slate-500' },
}

const TYPE_ICON: Record<string, string> = {
  comparison: '⚖️', faq: '❓', 'case-study': '📊', listicle: '📋',
  'how-to': '🛠️', landing: '🎯', guide: '📖', 'integration-guide': '🔌',
  'use-case': '💡', 'competitive-positioning': '🏆', 'brand-entity': '🏢',
}

function IdeaCard({ gap, onGenerated }: { gap: ContentGap; onGenerated: () => void }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const style = IMPACT_STYLE[gap.impact]

  const generate = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/geo/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestion: gap.suggestion, type: gap.type }),
      })
      const data = await res.json()
      if (res.ok) { setDone(true); onGenerated() }
      else setError(data.error ?? 'Generation failed')
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }

  return (
    <div className={`bg-slate-900 border rounded-2xl p-5 transition-colors ${
      done ? 'border-emerald-700/40' : 'border-slate-800 hover:border-violet-700/30'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg">{TYPE_ICON[gap.type] ?? '📝'}</span>
          <span className="text-xs uppercase tracking-widest font-bold text-slate-500">{gap.type}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${style.badge}`}>
            {gap.impact} impact
          </span>
        </div>
        {done && (
          <span className="flex-shrink-0 text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-700/40 px-2 py-0.5 rounded-full">
            ✓ Saved to drafts
          </span>
        )}
      </div>

      <p className="text-sm text-slate-200 leading-relaxed mb-4">{gap.suggestion}</p>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={generate}
          disabled={loading || done}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            done
              ? 'bg-emerald-900/30 text-emerald-400 cursor-default'
              : 'bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50'
          }`}
        >
          {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {done ? '✓ Generated' : loading ? 'Generating…' : '✨ Generate · 8 credits'}
        </button>
        {done && (
          <Link href="/content" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
            View in Content Calendar →
          </Link>
        )}
      </div>
    </div>
  )
}

export function GeoIdeasClient({
  contentGaps, generatedAt, businessName, hasGeoIntel,
}: {
  contentGaps: ContentGap[]
  generatedAt: string | null
  businessName: string
  hasGeoIntel: boolean
}) {
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [generatedCount, setGeneratedCount] = useState(0)

  const filtered = filter === 'all' ? contentGaps : contentGaps.filter(g => g.impact === filter)

  const high   = contentGaps.filter(g => g.impact === 'high').length
  const medium = contentGaps.filter(g => g.impact === 'medium').length
  const low    = contentGaps.filter(g => g.impact === 'low').length

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/content" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
            ← Content Calendar
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-white mt-2">GEO Content Ideas</h1>
        <p className="text-slate-400 text-sm mt-1">
          AI assistants frequently cite these content types for {businessName || 'your business'}. Generate to save as draft and auto-publish.
        </p>
        {generatedAt && (
          <p className="text-xs text-slate-600 mt-1">
            Last updated: {new Date(generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>

      {!hasGeoIntel ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-3">🧠</div>
          <h3 className="text-white font-semibold mb-2">No GEO Intelligence yet</h3>
          <p className="text-slate-400 text-sm mb-4">
            Run GEO Intelligence from the GEO Optimizer to generate personalized content ideas for your business.
          </p>
          <Link
            href="/geo"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Go to GEO Optimizer →
          </Link>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'High Impact', count: high,   color: 'text-rose-400',   f: 'high' as const },
              { label: 'Medium',      count: medium, color: 'text-amber-400',  f: 'medium' as const },
              { label: 'Low',         count: low,    color: 'text-slate-400',  f: 'low' as const },
            ].map(s => (
              <button
                key={s.f}
                onClick={() => setFilter(filter === s.f ? 'all' : s.f)}
                className={`bg-slate-900 border rounded-xl p-3 text-left transition-colors ${
                  filter === s.f ? 'border-violet-600' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <p className="text-slate-500 text-xs mb-1">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.count}</p>
              </button>
            ))}
          </div>

          {generatedCount > 0 && (
            <div className="mb-4 bg-emerald-950/20 border border-emerald-700/30 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <span className="text-emerald-400 text-sm font-semibold">✓ {generatedCount} draft{generatedCount > 1 ? 's' : ''} saved to Content Calendar</span>
              <Link href="/content" className="text-xs text-emerald-400/70 hover:text-emerald-300 ml-auto">View →</Link>
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 mb-5 w-fit">
            {(['all', 'high', 'medium', 'low'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                  filter === f ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                {f === 'all' ? `All (${contentGaps.length})` : f}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filtered.map((gap, i) => (
              <IdeaCard
                key={i}
                gap={gap}
                onGenerated={() => setGeneratedCount(c => c + 1)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
