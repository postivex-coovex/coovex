'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { RefreshCw, Target, Star, TrendingUp, Shield, Bot, CheckCircle, Info } from 'lucide-react'

interface CompetitorEntry {
  id: string
  name: string
  website?: string
  is_self: boolean
  data_source: 'real' | 'ai_estimated'
  avg_rating: number
  review_count: number
  win_rate: number
  content_score: number
  health_score: number
  intelligence_score: number
  threat_level: string | null
  pricing_tier: string | null
  market_type: string | null
  crawl_status?: string
  presence_score: number
}

interface Benchmark {
  self: CompetitorEntry
  competitors: CompetitorEntry[]
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700'}`} />
      ))}
    </div>
  )
}

function DataBadge({ source }: { source: 'real' | 'ai_estimated' }) {
  if (source === 'real') {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
        <CheckCircle className="w-2.5 h-2.5" /> Real
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
      <Bot className="w-2.5 h-2.5" /> AI Est.
    </span>
  )
}

const MARKET_LABEL: Record<string, string> = {
  local: '📍 Local', regional: '🗺️ Regional', international: '🌐 International',
}

const THREAT_COLOR: Record<string, string> = {
  high: 'text-red-400', medium: 'text-amber-400', low: 'text-emerald-400',
}

export default function CompetitorBenchmarkPage() {
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null)
  const [loading, setLoading]     = useState(true)
  const [showInfo, setShowInfo]   = useState(false)

  function load() {
    setLoading(true)
    fetch('/api/competitors/benchmark')
      .then(r => r.json())
      .then(d => { setBenchmark(d.benchmark); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const all    = benchmark ? [benchmark.self, ...benchmark.competitors] : []
  const leader = all.length > 0 ? [...all].sort((a, b) => b.presence_score - a.presence_score)[0] : null
  const scanned = benchmark?.competitors.filter(c => c.crawl_status === 'done').length ?? 0

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-5 h-5 text-rose-400" />
            <h1 className="text-xl font-bold text-white">Competitor Benchmark</h1>
          </div>
          <p className="text-slate-400 text-sm">How you stack up against your tracked competitors</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowInfo(v => !v)}
            className="text-slate-500 hover:text-slate-300 transition-colors">
            <Info className="w-4 h-4" />
          </button>
          <Link href="/competitors" className="text-slate-500 hover:text-slate-300 text-xs transition-colors">← Competitors</Link>
          <button onClick={load} disabled={loading} className="text-slate-400 hover:text-white disabled:opacity-50 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Data accuracy info panel */}
      {showInfo && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3">
          <p className="text-white font-semibold text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-violet-400" /> How data is collected
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-start gap-3 p-3 bg-emerald-950/20 border border-emerald-800/30 rounded-xl">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-emerald-300 font-semibold mb-1">Real Data (Your Business)</p>
                <p className="text-slate-400 leading-relaxed">Rating & reviews pulled from your connected integrations. Leads, content, and health score from CooVex tracking.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-amber-950/20 border border-amber-800/30 rounded-xl">
              <Bot className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-300 font-semibold mb-1">AI Estimated (Competitors)</p>
                <p className="text-slate-400 leading-relaxed">Competitor scores are AI-estimated based on public knowledge. For precise data, connect Google Business or add actual review counts manually.</p>
              </div>
            </div>
          </div>
          <p className="text-slate-600 text-xs">
            We are building real-data integrations (Google Business, Trustpilot, SerpAPI) — these will replace AI estimates automatically once connected.
          </p>
        </div>
      )}

      {/* Why it matters banner — shown when no competitors */}
      {!loading && benchmark && benchmark.competitors.length === 0 && (
        <div className="bg-gradient-to-br from-violet-950/40 to-slate-900 border border-violet-800/30 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
              <Target className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg mb-2">Why Competitor Intelligence matters</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {[
                  { icon: '🔍', title: 'See where they beat you', desc: 'Rating, reviews, services — spot every gap instantly' },
                  { icon: '⚡', title: 'Find opportunities', desc: "Their weaknesses are your opportunities — AI flags them automatically" },
                  { icon: '📊', title: 'Know your market rank', desc: 'Track your position, score and rank every single day' },
                ].map(item => (
                  <div key={item.title} className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                    <p className="text-xl mb-1.5">{item.icon}</p>
                    <p className="text-white font-semibold text-sm mb-1">{item.title}</p>
                    <p className="text-slate-400 text-xs leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
              <Link href="/competitors"
                className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
                <Bot className="w-4 h-4" /> Start Competitor Analysis
              </Link>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-600 text-sm">Loading…</div>
      ) : !benchmark ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center py-16 text-slate-600">
          <Target className="w-8 h-8 mb-3 opacity-30" />
          <p className="text-sm">No benchmark data yet.</p>
          <Link href="/competitors" className="mt-3 text-violet-400 hover:text-violet-300 text-xs transition-colors">Add competitors →</Link>
        </div>
      ) : (
        <>
          {/* Leader card */}
          {leader && benchmark.competitors.length > 0 && (
            <div className={`rounded-2xl p-4 border ${leader.is_self ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-rose-950/20 border-rose-800/40'}`}>
              <div className="flex items-center gap-3">
                <Shield className={`w-5 h-5 ${leader.is_self ? 'text-emerald-400' : 'text-rose-400'}`} />
                <div>
                  <p className={`font-semibold text-sm ${leader.is_self ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {leader.is_self ? 'You are leading this market 🏆' : `${leader.name} leads the market`}
                  </p>
                  <p className="text-slate-500 text-xs">
                    {leader.is_self
                      ? 'Your presence score is the highest among tracked competitors.'
                      : `Their presence score is ${leader.presence_score} vs. your ${benchmark.self.presence_score}.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Comparison cards */}
          {benchmark.competitors.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {all.map(entry => (
                <div key={entry.id}
                  className={`bg-slate-900 border rounded-2xl p-5 ${entry.is_self ? 'border-violet-700/50' : 'border-slate-800'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <p className="text-white font-semibold text-sm truncate">{entry.name}</p>
                        {entry.is_self && (
                          <span className="text-[9px] text-violet-400 bg-violet-950/40 border border-violet-800/30 px-1.5 py-0.5 rounded-full flex-shrink-0">you</span>
                        )}
                        <DataBadge source={entry.data_source} />
                        {!entry.is_self && entry.market_type && (
                          <span className="text-[9px] text-slate-500">{MARKET_LABEL[entry.market_type] ?? entry.market_type}</span>
                        )}
                      </div>
                      {entry.avg_rating > 0 && <RatingStars rating={entry.avg_rating} />}
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-2xl font-bold text-white">{entry.presence_score}</p>
                      <p className="text-slate-600 text-[10px]">presence</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {entry.avg_rating > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Rating</span>
                        <span className="flex items-center gap-1">
                          <span className="text-yellow-400">{entry.avg_rating.toFixed(1)} ★</span>
                          {!entry.is_self && <span className="text-amber-600 text-[9px]">est.</span>}
                        </span>
                      </div>
                    )}
                    {entry.review_count > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Reviews</span>
                        <span className="flex items-center gap-1">
                          <span className="text-slate-300">{entry.review_count}</span>
                          {!entry.is_self && <span className="text-amber-600 text-[9px]">est.</span>}
                        </span>
                      </div>
                    )}
                    {entry.intelligence_score > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Strength Score</span>
                        <span className={`font-semibold ${entry.intelligence_score >= 75 ? 'text-red-400' : entry.intelligence_score >= 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {entry.intelligence_score}/100
                        </span>
                      </div>
                    )}
                    {!entry.is_self && entry.threat_level && entry.threat_level !== 'unknown' && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Threat</span>
                        <span className={`capitalize font-medium ${THREAT_COLOR[entry.threat_level] ?? 'text-slate-400'}`}>{entry.threat_level}</span>
                      </div>
                    )}
                    {!entry.is_self && entry.pricing_tier && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Pricing</span>
                        <span className="text-slate-400 capitalize">{entry.pricing_tier}</span>
                      </div>
                    )}
                    {!entry.is_self && entry.crawl_status !== 'done' && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Status</span>
                        <span className="text-slate-600">Needs AI scan</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Metric Comparison bars — only if scanned competitors exist */}
          {scanned > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-white font-semibold text-sm mb-1 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-400" />
                Strength Score Comparison
              </h2>
              <p className="text-slate-500 text-xs mb-5">Your health score vs competitor intelligence scores (AI estimated for competitors)</p>
              <div className="space-y-3">
                {all.filter(e => e.intelligence_score > 0 || e.health_score > 0).map(entry => {
                  const score = entry.intelligence_score || entry.health_score
                  const pct   = Math.min(100, score)
                  return (
                    <div key={entry.id} className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 w-36 flex-shrink-0">
                        <span className={`text-xs truncate ${entry.is_self ? 'text-violet-300 font-medium' : 'text-slate-400'}`}>
                          {entry.name}
                        </span>
                        {!entry.is_self && <span className="text-amber-600 text-[9px] flex-shrink-0">est.</span>}
                      </div>
                      <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${entry.is_self ? 'bg-violet-500' : 'bg-slate-600'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-xs w-10 text-right flex-shrink-0 ${entry.is_self ? 'text-white font-bold' : 'text-slate-500'}`}>
                        {score}/100
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Rating comparison — only if any competitor has rating */}
          {benchmark.competitors.some(c => c.avg_rating > 0) && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-white font-semibold text-sm mb-1 flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                Rating Comparison
              </h2>
              <p className="text-slate-500 text-xs mb-5">
                Your real reviews {benchmark.self.review_count > 0 ? `(${benchmark.self.review_count} reviews)` : '(no reviews yet)'} vs competitor estimates
              </p>
              <div className="space-y-3">
                {all.filter(e => e.avg_rating > 0).map(entry => {
                  const pct = (entry.avg_rating / 5) * 100
                  return (
                    <div key={entry.id} className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 w-36 flex-shrink-0">
                        <span className={`text-xs truncate ${entry.is_self ? 'text-violet-300 font-medium' : 'text-slate-400'}`}>
                          {entry.name}
                        </span>
                        {!entry.is_self && <span className="text-amber-600 text-[9px] flex-shrink-0">est.</span>}
                      </div>
                      <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${entry.is_self ? 'bg-yellow-500' : 'bg-yellow-500/40'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-xs w-12 text-right flex-shrink-0 ${entry.is_self ? 'text-yellow-400 font-bold' : 'text-slate-500'}`}>
                        ★{entry.avg_rating.toFixed(1)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Data accuracy footer */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
            <Bot className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-500 leading-relaxed">
              <span className="text-amber-400 font-medium">AI Estimated</span> — competitor ratings, reviews and scores are Claude AI estimates, not real-time scraped data.
              Your own data is <span className="text-emerald-400 font-medium">Real</span> — pulled from your reviews, leads and health score in CooVex.
              {' '}<button onClick={() => setShowInfo(true)} className="text-violet-400 hover:text-violet-300 transition-colors">Learn about data sources →</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
