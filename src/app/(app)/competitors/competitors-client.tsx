'use client'

import { useState, useEffect, useRef } from 'react'
import { Bot, Plus, RefreshCw, Target, TrendingUp, AlertTriangle, Zap, Globe, ChevronDown, ChevronUp, MapPin, Globe2, Settings2, X } from 'lucide-react'

/* ─── Types ─────────────────────────────────────────────────────────────────── */

interface Competitor {
  id: string
  name: string
  website: string | null
  website_url?: string | null
  linkedin_url: string | null
  facebook_url: string | null
  auto_discovered: boolean
  market_type: 'local' | 'regional' | 'international' | null
  google_rating: number | null
  google_review_count: number
  monthly_traffic: number | null
  domain_authority: number | null
  pricing_tier: string | null
  services_offered: string[]
  unique_selling_points: string[]
  weaknesses: string[]
  top_keywords: string[]
  intelligence_score: number
  threat_level: string
  ai_summary: string | null
  target_audience: string | null
  crawl_status: string
  last_scanned_at: string | null
}

interface Insight {
  id: string
  competitor_id: string
  insight_type: 'gap' | 'opportunity' | 'threat' | 'action'
  category: string
  title: string
  body: string
  priority: number
}

interface Business {
  id: string
  name: string
  industry: string | null
  location: string | null
  health_score: number | null
  google_rating: number | null
  review_count: number | null
  competitor_market_types: string[] | null
}

interface Snapshot {
  competitor_id: string
  intelligence_score: number
  recorded_date: string
}

interface BizSnapshot {
  health_score: number
  recorded_date: string
}

function dedupByName(list: Competitor[]): Competitor[] {
  const seen = new Map<string, Competitor>()
  for (const c of list) {
    const key = c.name.toLowerCase().trim()
    const prev = seen.get(key)
    if (!prev || (c.last_scanned_at ?? '') >= (prev.last_scanned_at ?? '')) {
      seen.set(key, c)
    }
  }
  return Array.from(seen.values())
}

/* ─── Market Setup Screen ────────────────────────────────────────────────────── */

const MARKET_OPTIONS = [
  {
    key: 'local',
    emoji: '📍',
    title: 'Local Competitors',
    desc: 'Businesses competing in your city or district',
    example: 'Nearby shops, local agencies, same-street rivals',
    active: 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/20',
    check: 'border-emerald-400 bg-emerald-400',
    icon: <MapPin className="w-5 h-5 text-emerald-400" />,
    iconBg: 'bg-emerald-500/20',
  },
  {
    key: 'regional',
    emoji: '🗺️',
    title: 'Regional Competitors',
    desc: 'National brands or regional chains in your country',
    example: 'Country-wide players, regional franchises',
    active: 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/20',
    check: 'border-blue-400 bg-blue-400',
    icon: <Globe2 className="w-5 h-5 text-blue-400" />,
    iconBg: 'bg-blue-500/20',
  },
  {
    key: 'international',
    emoji: '🌐',
    title: 'International Competitors',
    desc: 'Global industry leaders and international platforms',
    example: 'Worldwide brands, global SaaS, industry giants',
    active: 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/20',
    check: 'border-violet-400 bg-violet-400',
    icon: <Globe className="w-5 h-5 text-violet-400" />,
    iconBg: 'bg-violet-500/20',
  },
] as const

function SetupScreen({
  business,
  existingCount,
  onStart,
  savedMarkets,
}: {
  business: Business | null
  existingCount: number
  onStart: (markets: string[], localLocation: string, productService: string, businessWebsite: string) => void
  savedMarkets: string[]
}) {
  const [selected, setSelected] = useState<string[]>(
    savedMarkets.length > 0 ? savedMarkets : []
  )
  const [localLocation, setLocalLocation] = useState(business?.location ?? '')
  const [productService, setProductService] = useState('')
  const [businessWebsite, setBusinessWebsite] = useState('')
  const [products, setProducts] = useState<{ id: string; name: string; type: string; tagline: string | null }[]>([])

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(d => setProducts(d.products ?? []))
      .catch(() => {})
  }, [])

  const toggle = (key: string) =>
    setSelected(s => s.includes(key) ? s.filter(x => x !== key) : [...s, key])

  const needsLocation = selected.includes('local')
  const totalCompetitors = selected.length > 0 ? 6 : 0

  return (
    <div>
      {/* Top info cards — full width */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { icon: '🔍', title: 'See where they beat you', desc: 'Rating, pricing, services — spot every gap' },
          { icon: '⚡', title: 'Find opportunities',       desc: "Their weakness = your opportunity" },
          { icon: '📊', title: 'Know your market rank',    desc: 'Track your position every day' },
        ].map(item => (
          <div key={item.title} className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-start gap-4">
            <span className="text-3xl flex-shrink-0">{item.icon}</span>
            <div>
              <p className="text-white font-semibold text-sm mb-1">{item.title}</p>
              <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-5 gap-6">

        {/* Left — market selection (3/5) */}
        <div className="col-span-3">
          {/* Section header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
              <Target className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Select Markets to Monitor</h2>
              <p className="text-slate-400 text-xs">
                AI will find real competitors in each selected market.
                {business?.location && <span className="text-violet-400"> ({business.location})</span>}
              </p>
            </div>
          </div>

          <p className="text-amber-500/80 text-xs mb-5 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Competitor data is AI-estimated — not real-time scraped. You can verify and correct it.
          </p>

          {existingCount > 0 && (
            <div className="mb-5 p-4 bg-amber-950/30 border border-amber-800/40 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>This will delete {existingCount} existing competitor{existingCount !== 1 ? 's' : ''} and run a fresh AI analysis based on your new selection.</span>
            </div>
          )}

          {/* Market option cards */}
          <div className="space-y-3">
            {MARKET_OPTIONS.map(m => {
              const isSelected = selected.includes(m.key)
              return (
                <button key={m.key} onClick={() => toggle(m.key)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all ${isSelected ? m.active : 'border-slate-800 bg-slate-900 hover:border-slate-700'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isSelected ? m.iconBg : 'bg-slate-800'}`}>
                      {m.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-white font-semibold">{m.title}</p>
                        <span className="text-slate-600 text-[10px]">·</span>
                        <span className="text-slate-500 text-xs">{m.example}</span>
                      </div>
                      <p className="text-slate-400 text-sm">{m.desc}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? m.check : 'border-slate-700 bg-slate-800'}`}>
                      {isSelected && <span className="text-white text-xs font-bold leading-none">✓</span>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Location input */}
          {needsLocation && (
            <div className="mt-4 p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-2xl">
              <label className="block text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
                📍 Your City / Area <span className="text-emerald-600 font-normal">(required for Local market)</span>
              </label>
              <input
                type="text"
                value={localLocation}
                onChange={e => setLocalLocation(e.target.value)}
                placeholder="e.g. Dhaka, Bangladesh  or  New York, USA"
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 text-white text-sm px-4 py-3 rounded-xl outline-none transition-colors placeholder-slate-600"
              />
              <p className="text-slate-500 text-xs mt-1.5">AI uses this to find competitors actually operating in your area</p>
            </div>
          )}
        </div>

        {/* Right — business context + CTA (2/5) */}
        <div className="col-span-2 space-y-4">

          {/* Business context */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <p className="text-white font-semibold text-sm">Your Business Context</p>
            <p className="text-slate-500 text-xs -mt-2">Optional but recommended for better results</p>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-slate-400 text-xs font-medium">🛍️ Product / Service</label>
                <a href="/products" className="text-violet-400 hover:text-violet-300 text-[11px] font-medium transition-colors">
                  + Add
                </a>
              </div>
              {products.length > 0 ? (
                <select
                  value={productService}
                  onChange={e => setProductService(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 focus:border-violet-500 text-white text-sm px-4 py-2.5 rounded-xl outline-none transition-colors appearance-none cursor-pointer"
                >
                  <option value="">— Select a product —</option>
                  {products.map(p => (
                    <option key={p.id} value={p.tagline ? `${p.name} — ${p.tagline}` : p.name}>
                      {p.name}{p.tagline ? ` — ${p.tagline}` : ''} ({p.type})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5">
                  <p className="text-slate-500 text-sm flex-1">No products added yet</p>
                  <a href="/products" className="text-violet-400 hover:text-violet-300 text-xs font-medium transition-colors whitespace-nowrap">
                    Add now →
                  </a>
                </div>
              )}
              <p className="text-slate-600 text-xs mt-1.5">AI finds competitors offering similar services</p>
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-medium mb-2">🌐 Your Business Website</label>
              <input
                type="url"
                value={businessWebsite}
                onChange={e => setBusinessWebsite(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="w-full bg-slate-800 border border-slate-700 focus:border-violet-500 text-white text-sm px-4 py-2.5 rounded-xl outline-none transition-colors placeholder-slate-600"
              />
              <p className="text-slate-600 text-xs mt-1.5">Used for direct positioning comparison</p>
            </div>
          </div>

          {/* Summary + CTA */}
          <div className="p-5 bg-violet-950/20 border border-violet-800/30 rounded-2xl">
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Markets selected</span>
                <span className={`font-semibold ${selected.length > 0 ? 'text-violet-400' : 'text-slate-600'}`}>
                  {selected.length} / 3
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Est. competitors</span>
                <span className={`font-semibold ${totalCompetitors > 0 ? 'text-white' : 'text-slate-600'}`}>
                  ~{totalCompetitors}
                </span>
              </div>
            </div>

            <button
              disabled={selected.length === 0 || (needsLocation && !localLocation.trim())}
              onClick={() => onStart(selected, localLocation.trim(), productService.trim(), businessWebsite.trim())}
              className="w-full flex items-center justify-center gap-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-3.5 rounded-xl text-sm transition-colors">
              <Bot className="w-4 h-4" />
              Start AI Analysis
            </button>

            {selected.length === 0 && (
              <p className="text-slate-600 text-xs mt-3 text-center">Select at least one market to continue</p>
            )}
            {needsLocation && !localLocation.trim() && selected.length > 0 && (
              <p className="text-amber-600 text-xs mt-3 text-center">Enter your city to enable local market analysis</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const CHART_COLORS = [
  '#ef4444','#f59e0b','#3b82f6','#8b5cf6',
  '#10b981','#f97316','#ec4899','#14b8a6',
]

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

const THREAT_STYLE: Record<string, string> = {
  high:    'bg-red-900/40   text-red-300   border-red-800/40',
  medium:  'bg-amber-900/40 text-amber-300 border-amber-800/40',
  low:     'bg-emerald-900/40 text-emerald-300 border-emerald-800/40',
  unknown: 'bg-slate-800 text-slate-400 border-slate-700',
}

const INSIGHT_STYLE: Record<string, { color: string; icon: string; bg: string }> = {
  gap:         { icon: '⚠️', color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-800/30' },
  opportunity: { icon: '💡', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-800/30' },
  threat:      { icon: '❗', color: 'text-red-400',     bg: 'bg-red-500/10 border-red-800/30' },
  action:      { icon: '🚀', color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-800/30' },
}

const CATEGORY_LABEL: Record<string, string> = {
  seo: 'SEO', social: 'Social', content: 'Content',
  pricing: 'Pricing', service: 'Services', reputation: 'Reputation',
}

const DISCOVERY_STEPS = [
  { label: 'Reading your business profile',     duration: 2000 },
  { label: 'Scanning your industry',            duration: 3000 },
  { label: 'Identifying key competitors',       duration: 4000 },
  { label: 'Analysing services & positioning', duration: 3000 },
  { label: 'Scoring threat levels',             duration: 2000 },
  { label: 'Building intelligence reports',    duration: 2000 },
]

function DiscoverProgress({ industry, productService }: { industry?: string | null; productService?: string }) {
  const [step, setStep]       = useState(0)
  const [progress, setProgress] = useState(0)
  const frameRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    const totalMs = DISCOVERY_STEPS.reduce((s, d) => s + d.duration, 0)
    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now
      const elapsed = now - startRef.current
      const pct = Math.min((elapsed / totalMs) * 95, 95) // cap at 95% until done
      setProgress(pct)

      // Which step are we on?
      let acc = 0
      for (let i = 0; i < DISCOVERY_STEPS.length; i++) {
        acc += DISCOVERY_STEPS[i].duration
        if (elapsed < acc) { setStep(i); break }
      }
      if (elapsed < totalMs) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [])

  return (
    <div className="bg-slate-900 border border-violet-800/40 rounded-2xl p-10 text-center">
      {/* Icon */}
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 rounded-full bg-violet-500/10 border border-violet-500/20 animate-ping opacity-30" />
        <div className="relative w-20 h-20 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
          <Bot className="w-9 h-9 text-violet-400" />
        </div>
      </div>

      <h2 className="text-white font-bold text-xl mb-1">AI is scanning your market…</h2>
      <p className="text-slate-400 text-sm mb-8">
        {productService
          ? <>Analysing competitors for <span className="text-violet-300 font-medium">{productService}</span></>
          : industry
            ? `Analysing ${industry} competitors`
            : 'Identifying real competitors from your industry'
        }
      </p>

      {/* Progress bar */}
      <div className="max-w-sm mx-auto mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500">Progress</span>
          <span className="text-xs text-violet-400 font-semibold tabular-nums">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="max-w-xs mx-auto space-y-2">
        {DISCOVERY_STEPS.map((s, i) => {
          const done    = i < step
          const current = i === step
          return (
            <div key={s.label} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300 ${
              current ? 'bg-violet-500/10 border border-violet-500/20' :
              done    ? 'opacity-40' : 'opacity-20'
            }`}>
              <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] transition-all ${
                done    ? 'bg-emerald-500 text-white' :
                current ? 'bg-violet-500 text-white animate-pulse' :
                          'bg-slate-700 text-slate-500'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-xs ${current ? 'text-violet-300 font-medium' : done ? 'text-slate-500' : 'text-slate-600'}`}>
                {s.label}
              </span>
              {current && (
                <span className="ml-auto flex gap-0.5">
                  {[0,1,2].map(d => (
                    <span key={d} className="w-1 h-1 rounded-full bg-violet-400 animate-bounce"
                      style={{ animationDelay: `${d * 0.15}s` }} />
                  ))}
                </span>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-slate-600 text-xs mt-6">This usually takes 15–30 seconds</p>
    </div>
  )
}

/* ─── Trend Chart ────────────────────────────────────────────────────────────── */

function TrendChart({
  snapshots, bizSnapshots, competitors, business,
}: {
  snapshots: Snapshot[]
  bizSnapshots: BizSnapshot[]
  competitors: Competitor[]
  business: Business | null
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [showAllLegend, setShowAllLegend] = useState(false)
  const [showAllBars, setShowAllBars] = useState(false)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; score: number; color: string } | null>(null)

  const compMap = new Map(competitors.map(c => [c.id, c]))

  const seriesMap = new Map<string, { date: string; score: number }[]>()
  for (const snap of snapshots) {
    if (!seriesMap.has(snap.competitor_id)) seriesMap.set(snap.competitor_id, [])
    seriesMap.get(snap.competitor_id)!.push({ date: snap.recorded_date, score: snap.intelligence_score })
  }
  for (const comp of competitors) {
    if (!seriesMap.has(comp.id) && comp.crawl_status === 'done') {
      seriesMap.set(comp.id, [{ date: new Date().toISOString().split('T')[0], score: comp.intelligence_score }])
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const bizPoints: { date: string; score: number }[] =
    bizSnapshots.length > 0
      ? bizSnapshots.map(b => ({ date: b.recorded_date, score: b.health_score }))
      : business?.health_score
        ? [{ date: today, score: business.health_score }]
        : []

  const allDates = [...new Set([
    ...Array.from(seriesMap.values()).flatMap(pts => pts.map(p => p.date)),
    ...bizPoints.map(p => p.date),
  ])].sort()

  const competitorIds = Array.from(seriesMap.keys())
  const hasData = allDates.length > 0 && (competitorIds.length > 0 || bizPoints.length > 0)

  if (!hasData) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
        <TrendingUp className="w-8 h-8 text-slate-700 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Chart builds after first AI scan</p>
      </div>
    )
  }

  /* ── SINGLE-DAY: Horizontal ranking bar chart ─────────────────────── */
  if (allDates.length <= 1) {
    const bizScore = bizPoints[0]?.score ?? 0
    type BarItem = { id: string; name: string; score: number; color: string; isYou: boolean; threat?: string | null; marketType?: string | null }
    const items: BarItem[] = []
    if (bizScore > 0) {
      items.push({ id: 'biz', name: business?.name ?? 'Your Business', score: bizScore, color: '#8b5cf6', isYou: true })
    }
    competitorIds.forEach((cid, ci) => {
      const pts   = seriesMap.get(cid) ?? []
      const score = pts[0]?.score ?? 0
      const comp  = compMap.get(cid)
      items.push({ id: cid, name: comp?.name ?? cid, score, color: CHART_COLORS[ci % CHART_COLORS.length], isYou: false, threat: comp?.threat_level, marketType: comp?.market_type })
    })
    items.sort((a, b) => b.score - a.score)

    const maxScore  = Math.max(...items.map(i => i.score), 1)
    const myRank    = items.findIndex(i => i.isYou) + 1
    const SHOW      = 12
    const visible   = showAllBars ? items : items.slice(0, SHOW)
    const myScore   = bizScore
    const aheadOf   = items.filter(i => !i.isYou && i.score < myScore).length
    const behindOf  = items.filter(i => !i.isYou && i.score > myScore).length

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-white font-semibold text-sm">Intelligence Score Ranking</p>
            <p className="text-slate-500 text-xs mt-0.5">Current market position · trend line builds with daily scans</p>
          </div>
          {myRank > 0 && (
            <div className="text-right flex-shrink-0 ml-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Your Rank</p>
              <p className="text-white font-bold text-2xl leading-none">
                #{myRank}
                <span className="text-slate-500 text-sm font-normal">/{items.length}</span>
              </p>
            </div>
          )}
        </div>

        {/* Bars */}
        <div className="space-y-2">
          {visible.map((item, idx) => {
            const pct = (item.score / maxScore) * 100
            const threatColor = item.threat === 'high' ? 'text-red-400' : item.threat === 'medium' ? 'text-amber-400' : 'text-emerald-400'
            return (
              <div key={item.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                  item.isYou
                    ? 'bg-violet-500/10 border border-violet-500/25 ring-1 ring-violet-500/10'
                    : hoveredId === item.id
                      ? 'bg-slate-800'
                      : 'hover:bg-slate-800/60'
                }`}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Rank */}
                <span className="text-slate-600 text-xs w-5 text-right flex-shrink-0 font-mono">
                  {idx + 1}
                </span>
                {/* Bar + name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-medium truncate max-w-[180px] ${item.isYou ? 'text-violet-300' : 'text-slate-200'}`}>
                      {item.name}{item.isYou && <span className="ml-1.5 text-violet-400 text-[10px] font-normal">(You)</span>}
                    </span>
                    <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                      {!item.isYou && item.marketType && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${
                          item.marketType === 'local'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : item.marketType === 'regional'
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                              : 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                        }`}>
                          {item.marketType === 'local' ? '📍' : item.marketType === 'regional' ? '🗺️' : '🌐'} {item.marketType}
                        </span>
                      )}
                      {!item.isYou && item.threat && (
                        <span className={`text-[9px] uppercase tracking-wider ${threatColor}`}>{item.threat}</span>
                      )}
                      <span className="text-xs font-bold tabular-nums" style={{ color: item.isYou ? '#a78bfa' : item.color }}>
                        {item.score}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${pct}%`, backgroundColor: item.isYou ? '#8b5cf6' : item.color }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {items.length > SHOW && (
          <button onClick={() => setShowAllBars(s => !s)}
            className="mt-3 w-full text-xs text-slate-500 hover:text-violet-400 py-2.5 border border-slate-800 hover:border-violet-500/30 rounded-xl transition-colors">
            {showAllBars ? '↑ Show less' : `↓ Show ${items.length - SHOW} more competitors`}
          </button>
        )}

        {myScore > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 gap-3 text-center">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl py-2.5">
              <p className="text-emerald-400 font-bold text-lg">{aheadOf}</p>
              <p className="text-slate-400 text-[10px]">competitors ahead of</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl py-2.5">
              <p className="text-red-400 font-bold text-lg">{behindOf}</p>
              <p className="text-slate-400 text-[10px]">competitors behind you</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ── MULTI-DAY: Line chart ─────────────────────────────────────────── */
  // Limit to top 10 by latest score for readability
  const sortedIds = [...competitorIds].sort((a, b) => {
    const aScore = (seriesMap.get(a) ?? []).at(-1)?.score ?? 0
    const bScore = (seriesMap.get(b) ?? []).at(-1)?.score ?? 0
    return bScore - aScore
  })
  const TOP = 10
  const visibleIds   = showAllLegend ? sortedIds : sortedIds.slice(0, TOP)
  const hiddenCount  = sortedIds.length - TOP

  const VW = 700, VH = 260
  const PAD = { t: 20, r: 80, b: 50, l: 45 }
  const cW = VW - PAD.l - PAD.r
  const cH = VH - PAD.t - PAD.b
  const xOf = (date: string) => {
    const i = allDates.indexOf(date)
    return PAD.l + (allDates.length <= 1 ? cW / 2 : (i / (allDates.length - 1)) * cW)
  }
  const yOf  = (score: number) => PAD.t + cH - Math.min(score, 100) / 100 * cH
  const path = (pts: { date: string; score: number }[]) =>
    [...pts].sort((a, b) => a.date.localeCompare(b.date))
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.date)} ${yOf(p.score)}`).join(' ')

  const yTicks = [0, 25, 50, 75, 100]

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-white font-semibold text-sm">Intelligence Score Trend</p>
          <p className="text-slate-500 text-xs mt-0.5">Your business vs competitors — higher = stronger market position</p>
        </div>
        {hiddenCount > 0 && !showAllLegend && (
          <span className="text-[10px] text-slate-500 flex-shrink-0 mt-0.5">
            Showing top {TOP} of {sortedIds.length}
          </span>
        )}
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" style={{ overflow: 'visible' }}>
          {/* Y grid */}
          {yTicks.map(tick => (
            <g key={tick}>
              <line x1={PAD.l} y1={yOf(tick)} x2={VW - PAD.r} y2={yOf(tick)}
                stroke={tick === 0 ? '#334155' : '#1e293b'} strokeWidth="1" />
              <text x={PAD.l - 8} y={yOf(tick)} textAnchor="end" dominantBaseline="middle"
                fill="#475569" fontSize="10">{tick}</text>
            </g>
          ))}
          {/* X labels */}
          {allDates.map((date, i) => {
            const step = Math.ceil(allDates.length / 7)
            if (i % step !== 0 && i !== allDates.length - 1) return null
            return (
              <text key={date} x={xOf(date)} y={VH - PAD.b + 16} textAnchor="middle" fill="#475569" fontSize="9">
                {new Date(date + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}
              </text>
            )
          })}

          {/* Competitor lines */}
          {visibleIds.map((cid, ci) => {
            const pts   = (seriesMap.get(cid) ?? []).sort((a, b) => a.date.localeCompare(b.date))
            const color = CHART_COLORS[ci % CHART_COLORS.length]
            const dim   = hoveredId !== null && hoveredId !== cid
            const last  = pts[pts.length - 1]
            const comp  = compMap.get(cid)
            return (
              <g key={cid} style={{ opacity: dim ? 0.12 : 1, transition: 'opacity 0.2s' }}
                onMouseEnter={() => setHoveredId(cid)} onMouseLeave={() => { setHoveredId(null); setTooltip(null) }}>
                {pts.length >= 2 && (
                  <path d={path(pts)} fill="none" stroke={color}
                    strokeWidth={hoveredId === cid ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
                )}
                {pts.map(p => (
                  <circle key={p.date} cx={xOf(p.date)} cy={yOf(p.score)}
                    r={hoveredId === cid ? 5 : pts.length === 1 ? 5 : 3}
                    fill={color} stroke="#0f172a" strokeWidth="2"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setTooltip({ x: xOf(p.date), y: yOf(p.score), name: comp?.name ?? '', score: p.score, color })}
                    onMouseLeave={() => setTooltip(null)}
                  />
                ))}
                {/* End label — only show when hovered or single series */}
                {last && (hoveredId === cid || visibleIds.length <= 3) && (
                  <text x={xOf(last.date) + 8} y={yOf(last.score)}
                    fill={color} fontSize="11" dominantBaseline="middle" fontWeight="bold">
                    {last.score}
                  </text>
                )}
              </g>
            )
          })}

          {/* Business — dashed white */}
          {bizPoints.length > 0 && (() => {
            const pts  = [...bizPoints].sort((a, b) => a.date.localeCompare(b.date))
            const dim  = hoveredId !== null && hoveredId !== 'biz'
            const last = pts[pts.length - 1]
            return (
              <g style={{ opacity: dim ? 0.12 : 1, transition: 'opacity 0.2s' }}
                onMouseEnter={() => setHoveredId('biz')} onMouseLeave={() => setHoveredId(null)}>
                {pts.length >= 2 && (
                  <path d={path(pts)} fill="none" stroke="#ffffff"
                    strokeWidth="2.5" strokeDasharray="6 3" strokeLinecap="round" strokeLinejoin="round" />
                )}
                {pts.map(p => (
                  <circle key={p.date} cx={xOf(p.date)} cy={yOf(p.score)}
                    r={pts.length === 1 ? 7 : 5} fill="#ffffff" stroke="#0f172a" strokeWidth="2.5" />
                ))}
                {last && (
                  <>
                    <text x={xOf(last.date) + 10} y={yOf(last.score) - 2}
                      fill="#ffffff" fontSize="11" dominantBaseline="middle" fontWeight="bold">{last.score}</text>
                    <text x={xOf(last.date) + 10} y={yOf(last.score) + 11}
                      fill="#94a3b8" fontSize="9" dominantBaseline="middle">You</text>
                  </>
                )}
              </g>
            )
          })()}

          {/* Hover tooltip */}
          {tooltip && (
            <g style={{ pointerEvents: 'none' }}>
              <rect x={tooltip.x + 10} y={tooltip.y - 20} width="90" height="32" rx="6"
                fill="#1e293b" stroke="#334155" strokeWidth="1" />
              <text x={tooltip.x + 55} y={tooltip.y - 8} textAnchor="middle"
                fill="#94a3b8" fontSize="9">{tooltip.name.slice(0, 14)}</text>
              <text x={tooltip.x + 55} y={tooltip.y + 6} textAnchor="middle"
                fill={tooltip.color} fontSize="12" fontWeight="bold">{tooltip.score}</text>
            </g>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-slate-800">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {bizPoints.length > 0 && (
            <button onMouseEnter={() => setHoveredId('biz')} onMouseLeave={() => setHoveredId(null)}
              className="flex items-center gap-1.5 text-xs text-white hover:opacity-80 transition-opacity">
              <svg width="20" height="10" className="flex-shrink-0">
                <line x1="0" y1="5" x2="20" y2="5" stroke="white" strokeWidth="2.5" strokeDasharray="5 3" />
                <circle cx="10" cy="5" r="3.5" fill="white" />
              </svg>
              <span className="font-semibold">{business?.name ?? 'You'}</span>
              {business?.health_score && <span className="text-slate-400">({business.health_score})</span>}
            </button>
          )}
          {(showAllLegend ? sortedIds : sortedIds.slice(0, TOP)).map((cid, ci) => {
            const comp  = compMap.get(cid)
            const color = CHART_COLORS[ci % CHART_COLORS.length]
            const pts   = seriesMap.get(cid) ?? []
            const last  = pts[pts.length - 1]
            return (
              <button key={cid} onMouseEnter={() => setHoveredId(cid)} onMouseLeave={() => setHoveredId(null)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                <svg width="20" height="10" className="flex-shrink-0">
                  <line x1="0" y1="5" x2="20" y2="5" stroke={color} strokeWidth="1.5" />
                  <circle cx="10" cy="5" r="2.5" fill={color} />
                </svg>
                <span className="max-w-[100px] truncate">{comp?.name ?? cid}</span>
                {last && <span style={{ color }} className="font-semibold">({last.score})</span>}
              </button>
            )
          })}
        </div>
        {hiddenCount > 0 && (
          <button onClick={() => setShowAllLegend(s => !s)}
            className="mt-2 text-[10px] text-slate-600 hover:text-violet-400 transition-colors">
            {showAllLegend ? '↑ Show fewer' : `↓ +${hiddenCount} more`}
          </button>
        )}
      </div>

      {/* Positioning insight */}
      {bizPoints.length > 0 && competitorIds.length > 0 && (() => {
        const myScore = bizPoints[bizPoints.length - 1]?.score ?? 0
        const ahead   = competitorIds.filter(id => (seriesMap.get(id)?.at(-1)?.score ?? 0) < myScore).length
        const behind  = competitorIds.length - ahead
        return (
          <div className="mt-3 p-3 bg-slate-800/50 rounded-xl grid grid-cols-2 gap-3 text-center text-xs">
            <div>
              <span className="text-emerald-400 font-bold text-base">{ahead}</span>
              <span className="text-slate-500 ml-1">competitors ahead of you</span>
            </div>
            <div>
              <span className="text-red-400 font-bold text-base">{behind}</span>
              <span className="text-slate-500 ml-1">competitors behind you</span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function BulkScanProgress({ done, total, currentName }: { done: number; total: number; currentName: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="bg-slate-900 border border-emerald-800/30 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-emerald-400 animate-pulse" />
        </div>
        <div className="flex-1">
          <p className="text-white text-sm font-semibold">Running deep AI scan on all competitors…</p>
          <p className="text-slate-400 text-xs mt-0.5">
            Currently scanning: <span className="text-emerald-400 font-medium">{currentName}</span>
          </p>
        </div>
        <span className="text-emerald-400 font-bold text-sm tabular-nums">{done}/{total}</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-slate-600 text-[10px]">Gap Analysis + Growth Plan will auto-populate when done</span>
        <span className="text-emerald-500 text-[10px] font-medium">{pct}%</span>
      </div>
    </div>
  )
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? '#ef4444' : score >= 50 ? '#f59e0b' : '#10b981'
  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="22" fill="none" stroke="#1e293b" strokeWidth="4" />
        <circle cx="28" cy="28" r="22" fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${2 * Math.PI * 22 * score / 100} ${2 * Math.PI * 22}`}
          strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">{score}</span>
    </div>
  )
}

function timeAgo(iso: string | null) {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/* ─── Add Competitor Modal ───────────────────────────────────────────────────── */

function AddModal({ onClose, onAdded }: { onClose: () => void; onAdded: (c: Competitor) => void }) {
  const [form, setForm] = useState({ name: '', website: '', linkedin_url: '', facebook_url: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      onAdded(data.competitor)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-white font-semibold">Add Competitor</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">×</button>
        </div>
        <form onSubmit={save} className="p-5 space-y-4">
          {[
            { key: 'name',         label: 'Competitor Name *', placeholder: 'Acme Corp',                    type: 'text' },
            { key: 'website',      label: 'Website URL',       placeholder: 'https://acmecorp.com',         type: 'url'  },
            { key: 'linkedin_url', label: 'LinkedIn Page',     placeholder: 'https://linkedin.com/company/…', type: 'url'  },
            { key: 'facebook_url', label: 'Facebook Page',     placeholder: 'https://facebook.com/…',       type: 'url'  },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs text-slate-400 mb-1.5">{f.label}</label>
              <input type={f.type} placeholder={f.placeholder}
                value={form[f.key as keyof typeof form]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors" />
            </div>
          ))}
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <p className="text-slate-500 text-xs">After adding, click "AI Scan" to get full intelligence analysis.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium py-2.5 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
              {saving ? 'Adding…' : 'Add Competitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Competitor Card ────────────────────────────────────────────────────────── */

function CompetitorCard({
  comp, insights, business, onScan, onDelete, scanning,
}: {
  comp: Competitor
  insights: Insight[]
  business: Business | null
  onScan: (id: string) => void
  onDelete: (id: string) => void
  scanning: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const url = comp.website || comp.website_url
  const compInsights = insights.filter(i => i.competitor_id === comp.id)
  const gaps    = compInsights.filter(i => i.insight_type === 'gap').slice(0, 3)
  const threats = compInsights.filter(i => i.insight_type === 'threat').slice(0, 2)
  const actions = compInsights.filter(i => i.insight_type === 'action').slice(0, 2)

  // Build numeric "ahead of you" comparisons
  const comparisons: { label: string; them: string; you: string; ahead: boolean }[] = []
  if (comp.crawl_status === 'done') {
    if (comp.google_rating && business?.google_rating && comp.google_rating > business.google_rating)
      comparisons.push({ label: 'Google Rating', them: `★${comp.google_rating}`, you: `★${business.google_rating}`, ahead: true })
    if (comp.google_review_count && business?.review_count && comp.google_review_count > business.review_count)
      comparisons.push({ label: 'Reviews', them: comp.google_review_count.toString(), you: business.review_count.toString(), ahead: true })
    if (comp.intelligence_score && business?.health_score && comp.intelligence_score > business.health_score)
      comparisons.push({ label: 'Strength Score', them: `${comp.intelligence_score}/100`, you: `${business.health_score}/100`, ahead: true })
    if (comp.services_offered?.length > 0 && comp.services_offered.length > 4)
      comparisons.push({ label: 'Services offered', them: `${comp.services_offered.length}`, you: '—', ahead: true })
  }

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden transition-all">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          <ScoreRing score={comp.intelligence_score || 0} />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-white font-bold text-base">{comp.name}</h3>
                  {comp.auto_discovered && (
                    <span className="text-[9px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded-full font-medium">AI FOUND</span>
                  )}
                  {comp.market_type && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${
                      comp.market_type === 'local'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : comp.market_type === 'regional'
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                          : 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                    }`}>
                      {comp.market_type === 'local' ? '📍 Local' : comp.market_type === 'regional' ? '🗺️ Regional' : '🌐 Intl'}
                    </span>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize ${THREAT_STYLE[comp.threat_level] ?? THREAT_STYLE.unknown}`}>
                    {comp.threat_level === 'unknown' ? '—' : comp.threat_level + ' threat'}
                  </span>
                </div>
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="text-slate-500 hover:text-violet-400 text-xs transition-colors flex items-center gap-1 mt-0.5">
                    <Globe className="w-3 h-3" />
                    {url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => onScan(comp.id)}
                  disabled={scanning || comp.crawl_status === 'scanning'}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-violet-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                >
                  <RefreshCw className={`w-3 h-3 ${(scanning || comp.crawl_status === 'scanning') ? 'animate-spin' : ''}`} />
                  {comp.crawl_status === 'scanning' ? 'Scanning…' : 'AI Scan'}
                </button>
                <button onClick={() => onDelete(comp.id)}
                  className="text-slate-600 hover:text-red-400 text-xs transition-colors px-1.5 py-1.5">✕</button>
              </div>
            </div>

            {/* Key metrics row */}
            <div className="flex flex-wrap gap-3 mt-3">
              {comp.google_rating && (
                <div className="flex items-center gap-1">
                  <span className="text-amber-400 text-xs">★</span>
                  <span className="text-white text-xs font-semibold">{comp.google_rating}</span>
                  {comp.google_review_count > 0 && <span className="text-slate-500 text-xs">({comp.google_review_count})</span>}
                  <span className="text-amber-600 text-[9px] ml-0.5">AI est.</span>
                </div>
              )}
              {comp.pricing_tier && (
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${
                  comp.pricing_tier === 'premium' ? 'text-violet-300 bg-violet-500/10' :
                  comp.pricing_tier === 'mid'     ? 'text-blue-300 bg-blue-500/10' :
                                                    'text-emerald-300 bg-emerald-500/10'
                }`}>
                  {comp.pricing_tier}
                </span>
              )}
              {comp.last_scanned_at && (
                <span className="text-slate-600 text-xs">Scanned {timeAgo(comp.last_scanned_at)}</span>
              )}
            </div>
          </div>
        </div>

        {/* AI Summary */}
        {comp.ai_summary && (
          <p className="text-slate-400 text-xs leading-relaxed mt-3 border-t border-slate-800 pt-3">{comp.ai_summary}</p>
        )}

        {/* Head-to-Head Comparison Table */}
        {comp.crawl_status === 'done' && (
          <div className="mt-3 border-t border-slate-800 pt-3">
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">⚡ Head-to-Head</p>
            <div className="rounded-xl overflow-hidden border border-slate-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-800/50 border-b border-slate-800">
                    <th className="text-left text-slate-500 px-3 py-2 font-medium text-[10px]">Metric</th>
                    <th className="text-center text-slate-500 px-3 py-2 font-medium text-[10px] max-w-[80px] truncate">{comp.name.split(' ')[0]}</th>
                    <th className="text-center text-slate-500 px-3 py-2 font-medium text-[10px]">You</th>
                    <th className="text-center text-slate-500 px-3 py-2 font-medium text-[10px] w-14">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {/* Strength Score */}
                  {(() => {
                    const them = comp.intelligence_score || 0
                    const you  = business?.health_score ?? 0
                    if (!them && !you) return null
                    const theyWin = them > you
                    return (
                      <tr className={theyWin ? 'bg-red-950/15' : 'bg-emerald-950/10'}>
                        <td className="px-3 py-2 text-slate-400">Strength Score</td>
                        <td className={`px-3 py-2 text-center font-bold ${theyWin ? 'text-red-400' : 'text-slate-400'}`}>{them || '—'}</td>
                        <td className={`px-3 py-2 text-center font-bold ${!theyWin && you > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>{you || '—'}</td>
                        <td className="px-3 py-2 text-center text-[10px]">
                          {theyWin ? <span className="text-red-400">↑ Them</span> : <span className="text-emerald-400">↑ You</span>}
                        </td>
                      </tr>
                    )
                  })()}
                  {/* Google Rating */}
                  {comp.google_rating ? (() => {
                    const them = comp.google_rating
                    const you  = business?.google_rating ?? 0
                    const theyWin = them > you
                    return (
                      <tr className={theyWin ? 'bg-red-950/15' : you > 0 ? 'bg-emerald-950/10' : ''}>
                        <td className="px-3 py-2 text-slate-400">Google Rating</td>
                        <td className={`px-3 py-2 text-center font-bold ${theyWin ? 'text-red-400' : 'text-slate-400'}`}>★{them}</td>
                        <td className={`px-3 py-2 text-center font-bold ${!theyWin && you > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>{you > 0 ? `★${you}` : '—'}</td>
                        <td className="px-3 py-2 text-center text-[10px]">
                          {you === 0 ? <span className="text-slate-600">No data</span>
                            : theyWin ? <span className="text-red-400">↑ Them</span>
                            : <span className="text-emerald-400">↑ You</span>}
                        </td>
                      </tr>
                    )
                  })() : null}
                  {/* Reviews */}
                  {comp.google_review_count > 0 ? (() => {
                    const them = comp.google_review_count
                    const you  = business?.review_count ?? 0
                    const theyWin = them > you
                    return (
                      <tr className={theyWin ? 'bg-red-950/15' : you > 0 ? 'bg-emerald-950/10' : ''}>
                        <td className="px-3 py-2 text-slate-400">Reviews</td>
                        <td className={`px-3 py-2 text-center font-bold ${theyWin ? 'text-red-400' : 'text-slate-400'}`}>{them.toLocaleString()}</td>
                        <td className={`px-3 py-2 text-center font-bold ${!theyWin && you > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>{you > 0 ? you.toLocaleString() : '—'}</td>
                        <td className="px-3 py-2 text-center text-[10px]">
                          {you === 0 ? <span className="text-slate-600">No data</span>
                            : theyWin ? <span className="text-red-400">↑ Them</span>
                            : <span className="text-emerald-400">↑ You</span>}
                        </td>
                      </tr>
                    )
                  })() : null}
                  {/* Services */}
                  {comp.services_offered?.length > 0 ? (() => {
                    const them = comp.services_offered.length
                    const theyWin = them > 4
                    return (
                      <tr className={theyWin ? 'bg-red-950/15' : 'bg-slate-900/50'}>
                        <td className="px-3 py-2 text-slate-400">Services</td>
                        <td className={`px-3 py-2 text-center font-bold ${theyWin ? 'text-red-400' : 'text-slate-300'}`}>{them}</td>
                        <td className="px-3 py-2 text-center text-slate-500">—</td>
                        <td className="px-3 py-2 text-center text-[10px]">
                          {theyWin ? <span className="text-red-400">↑ Them</span> : <span className="text-slate-500">Similar</span>}
                        </td>
                      </tr>
                    )
                  })() : null}
                  {/* Threat Level */}
                  {comp.threat_level && comp.threat_level !== 'unknown' && (
                    <tr>
                      <td className="px-3 py-2 text-slate-400">Threat Level</td>
                      <td className={`px-3 py-2 text-center font-semibold capitalize text-[11px] ${
                        comp.threat_level === 'high' ? 'text-red-400' : comp.threat_level === 'medium' ? 'text-amber-400' : 'text-emerald-400'
                      }`}>{comp.threat_level}</td>
                      <td className="px-3 py-2 text-center text-slate-500">—</td>
                      <td className="px-3 py-2 text-center text-[10px] text-slate-500">Risk</td>
                    </tr>
                  )}
                  {/* Pricing */}
                  {comp.pricing_tier && (
                    <tr>
                      <td className="px-3 py-2 text-slate-400">Pricing</td>
                      <td className="px-3 py-2 text-center text-slate-300 capitalize font-medium">{comp.pricing_tier}</td>
                      <td className="px-3 py-2 text-center text-slate-500">—</td>
                      <td className="px-3 py-2 text-center text-[10px] text-slate-500">Context</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* AI Gap insights */}
            {gaps.length > 0 && (
              <div className="mt-2.5 space-y-1">
                {gaps.map(g => (
                  <div key={g.id} className="flex items-start gap-2 px-1">
                    <span className="text-amber-500 text-xs flex-shrink-0 mt-0.5">▲</span>
                    <p className="text-amber-300 text-xs font-medium leading-snug">{g.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Services */}
        {comp.services_offered?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {comp.services_offered.slice(0, 4).map(s => (
              <span key={s} className="text-[10px] text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">{s}</span>
            ))}
            {comp.services_offered.length > 4 && (
              <span className="text-[10px] text-slate-500">+{comp.services_offered.length - 4} more</span>
            )}
          </div>
        )}

        {/* Quick actions preview */}
        {(threats.length > 0 || actions.length > 0) && (
          <div className="mt-3 space-y-1.5 border-t border-slate-800 pt-3">
            {threats.map(t => (
              <div key={t.id} className="flex items-start gap-2 text-xs">
                <span className="text-red-400 flex-shrink-0">❗</span>
                <span className="text-slate-400">{t.title}</span>
              </div>
            ))}
            {actions.map(a => (
              <div key={a.id} className="flex items-start gap-2 text-xs">
                <span className="text-violet-400 flex-shrink-0">🚀</span>
                <span className="text-slate-400">{a.title}</span>
              </div>
            ))}
          </div>
        )}

        {/* Pending / scanning state */}
        {comp.crawl_status === 'pending' && (
          <div className="mt-3 border border-dashed border-slate-700 rounded-xl p-3 text-center">
            <p className="text-slate-500 text-xs">Waiting for AI scan…</p>
          </div>
        )}
        {comp.crawl_status === 'scanning' && (
          <div className="mt-3 bg-violet-950/20 border border-violet-800/30 rounded-xl p-3 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-violet-400 animate-spin flex-shrink-0" />
            <p className="text-violet-300 text-xs font-medium">AI scanning in progress…</p>
          </div>
        )}

        {compInsights.length > 0 && (
          <button onClick={() => setExpanded(v => !v)}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors py-1">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Hide details' : `${compInsights.length} intelligence insights`}
          </button>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && compInsights.length > 0 && (
        <div className="border-t border-slate-800 p-5 space-y-4 bg-slate-950/50">
          {/* USPs & Weaknesses */}
          <div className="grid grid-cols-2 gap-4">
            {comp.unique_selling_points?.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Their Strengths</p>
                <div className="space-y-1">
                  {comp.unique_selling_points.map(s => (
                    <div key={s} className="flex items-start gap-1.5 text-xs text-slate-400">
                      <span className="text-red-400 flex-shrink-0 mt-0.5">↑</span>{s}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {comp.weaknesses?.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Their Weaknesses</p>
                <div className="space-y-1">
                  {comp.weaknesses.map(w => (
                    <div key={w} className="flex items-start gap-1.5 text-xs text-slate-400">
                      <span className="text-emerald-400 flex-shrink-0 mt-0.5">↓</span>{w}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Keywords */}
          {comp.top_keywords?.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Top Keywords They Rank For</p>
              <div className="flex flex-wrap gap-1.5">
                {comp.top_keywords.map(k => (
                  <span key={k} className="text-[10px] text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">{k}</span>
                ))}
              </div>
            </div>
          )}

          {/* All insights */}
          <div className="space-y-2">
            {(['gap', 'opportunity', 'threat', 'action'] as const).map(type => {
              const typeInsights = compInsights.filter(i => i.insight_type === type)
              if (!typeInsights.length) return null
              const style = INSIGHT_STYLE[type]
              return (
                <div key={type}>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5 capitalize">
                    {type === 'action' ? 'Growth Actions' : `${type}s`}
                  </p>
                  {typeInsights.map(ins => (
                    <div key={ins.id} className={`p-3 rounded-xl border mb-1.5 ${style.bg}`}>
                      <div className="flex items-start gap-2">
                        <span>{style.icon}</span>
                        <div>
                          <p className={`text-xs font-semibold ${style.color}`}>{ins.title}</p>
                          {ins.body && <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{ins.body}</p>}
                          {ins.category && <span className="text-[9px] text-slate-500 mt-1 inline-block">{CATEGORY_LABEL[ins.category] ?? ins.category}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Gap Analysis Tab ───────────────────────────────────────────────────────── */

function GapAnalysisTab({ insights, competitors, onRegenerate }: { insights: Insight[]; competitors: Competitor[]; onRegenerate: () => Promise<void> }) {
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    if (insights.length === 0) return
    setLoading(true)
    fetch('/api/competitors/gap-analysis')
      .then(r => r.json())
      .then(d => { if (d.summary) setSummary(d.summary) })
      .finally(() => setLoading(false))
  }, [insights.length])

  async function handleRegenerate() {
    setRegenerating(true)
    await onRegenerate()
    setRegenerating(false)
  }

  const gaps   = insights.filter(i => i.insight_type === 'gap').slice(0, 6)
  const opps   = insights.filter(i => i.insight_type === 'opportunity').slice(0, 6)
  const threats = insights.filter(i => i.insight_type === 'threat').slice(0, 4)

  if (insights.length === 0) {
    const scannedCount = competitors.filter(c => c.crawl_status === 'done').length
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 text-center px-6">
        <Bot className="w-8 h-8 text-slate-600 mx-auto mb-3" />
        {scannedCount > 0 ? (
          <>
            <p className="text-white font-semibold mb-1">Insights not generated yet</p>
            <p className="text-slate-400 text-sm mb-5 max-w-xs mx-auto">
              {scannedCount} competitor{scannedCount > 1 ? 's' : ''} scanned. Click to generate gap analysis from their data.
            </p>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              {regenerating
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating…</>
                : <><Zap className="w-4 h-4" /> Generate Gap Analysis</>
              }
            </button>
          </>
        ) : (
          <p className="text-slate-400 text-sm">Run AI Scan on your competitors to see gap analysis</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Strategic summary */}
      {(summary || loading) && (
        <div className="bg-violet-950/20 border border-violet-800/30 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <Bot className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-violet-300 font-semibold text-sm mb-1.5">AI Strategic Summary</p>
              {loading ? <div className="h-4 bg-slate-700 rounded animate-pulse w-3/4" /> :
                <p className="text-slate-400 text-sm leading-relaxed">{summary}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Competitive Matrix */}
      {competitors.filter(c => c.crawl_status === 'done').length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <p className="text-white font-semibold text-sm">Competitive Intelligence Matrix</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-slate-500 px-5 py-3 font-medium">Competitor</th>
                  <th className="text-left text-slate-500 px-3 py-3 font-medium">Website</th>
                  <th className="text-center text-slate-500 px-3 py-3 font-medium">Score</th>
                  <th className="text-center text-slate-500 px-3 py-3 font-medium">Threat</th>
                  <th className="text-center text-slate-500 px-3 py-3 font-medium">Rating</th>
                  <th className="text-center text-slate-500 px-3 py-3 font-medium">Reviews</th>
                  <th className="text-center text-slate-500 px-3 py-3 font-medium">Pricing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {competitors.filter(c => c.crawl_status === 'done').map(c => {
                  const url = c.website || c.website_url
                  const displayUrl = url ? url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : null
                  return (
                  <tr key={c.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-3 text-white font-medium">{c.name}</td>
                    <td className="px-3 py-3">
                      {displayUrl ? (
                        <a href={url!} target="_blank" rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 hover:underline transition-colors truncate block max-w-[160px]">
                          {displayUrl}
                        </a>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`font-bold ${c.intelligence_score >= 75 ? 'text-red-400' : c.intelligence_score >= 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {c.intelligence_score}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`capitalize text-[10px] px-1.5 py-0.5 rounded-full border ${THREAT_STYLE[c.threat_level] ?? THREAT_STYLE.unknown}`}>
                        {c.threat_level}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-amber-400">{c.google_rating ? `★${c.google_rating}` : '—'}</td>
                    <td className="px-3 py-3 text-center text-slate-400">{c.google_review_count > 0 ? c.google_review_count.toLocaleString() : '—'}</td>
                    <td className="px-3 py-3 text-center text-slate-400 capitalize">{c.pricing_tier || '—'}</td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Gaps, Opportunities, Threats in 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { label: 'Gaps — Where You\'re Behind', items: gaps,   style: INSIGHT_STYLE.gap },
          { label: 'Opportunities to Exploit',   items: opps,   style: INSIGHT_STYLE.opportunity },
          { label: 'Threats to Watch',           items: threats, style: INSIGHT_STYLE.threat },
        ].map(section => (
          <div key={section.label} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <p className="text-white font-semibold text-sm">{section.label}</p>
            </div>
            <div className="p-4 space-y-2.5">
              {section.items.length === 0 ? (
                <p className="text-slate-600 text-xs text-center py-4">None identified yet</p>
              ) : section.items.map(ins => (
                <div key={ins.id} className={`p-3 rounded-xl border ${section.style.bg}`}>
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0">{section.style.icon}</span>
                    <div>
                      <p className={`text-xs font-semibold ${section.style.color}`}>{ins.title}</p>
                      {ins.body && <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed line-clamp-2">{ins.body}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Growth Plan Tab ────────────────────────────────────────────────────────── */

function GrowthPlanTab({ insights, onRegenerate }: { insights: Insight[]; onRegenerate: () => Promise<void> }) {
  const [regenerating, setRegenerating] = useState(false)

  const actions = insights
    .filter(i => i.insight_type === 'action')
    .sort((a, b) => b.priority - a.priority)

  async function handleRegenerate() {
    setRegenerating(true)
    await onRegenerate()
    setRegenerating(false)
  }

  if (actions.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 text-center px-6">
        <TrendingUp className="w-8 h-8 text-slate-600 mx-auto mb-3" />
        <p className="text-white font-semibold mb-1">Growth plan not ready</p>
        <p className="text-slate-400 text-sm mb-5 max-w-xs mx-auto">
          Generate gap analysis first — growth actions are created from competitor insights.
        </p>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          {regenerating
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating…</>
            : <><Zap className="w-4 h-4" /> Generate Growth Plan</>
          }
        </button>
      </div>
    )
  }

  const byCategory = actions.reduce<Record<string, Insight[]>>((acc, a) => {
    const cat = a.category || 'general'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(a)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <div className="bg-violet-950/20 border border-violet-800/30 rounded-2xl p-5 flex items-start gap-3">
        <TrendingUp className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-violet-300 font-semibold text-sm mb-1">AI-Generated Growth Roadmap</p>
          <p className="text-slate-400 text-xs leading-relaxed">
            Based on competitive analysis of {[...new Set(actions.map(a => a.competitor_id))].length} competitor{[...new Set(actions.map(a => a.competitor_id))].length !== 1 ? 's' : ''}.
            Actions are sorted by strategic priority — tackle high-priority items first.
          </p>
        </div>
      </div>

      {Object.entries(byCategory).map(([cat, catActions]) => (
        <div key={cat} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-400" />
            <p className="text-white font-semibold text-sm">{CATEGORY_LABEL[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1)}</p>
            <span className="ml-auto text-xs text-slate-500">{catActions.length} action{catActions.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-slate-800/50">
            {catActions.map((a, i) => (
              <div key={a.id} className="p-5 flex items-start gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                  i === 0 ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}>{i + 1}</div>
                <div>
                  <p className="text-white font-semibold text-sm mb-1">🚀 {a.title}</p>
                  {a.body && <p className="text-slate-400 text-sm leading-relaxed">{a.body}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                      Priority {a.priority}/10
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────────────────────────── */

export default function CompetitorsClient({
  competitors: initial,
  insights: initialInsights,
  business,
  snapshots: initialSnapshots,
  bizSnapshots: initialBizSnapshots,
}: {
  competitors: Competitor[]
  insights: Insight[]
  business: Business | null
  snapshots: Snapshot[]
  bizSnapshots: BizSnapshot[]
}) {
  const savedMarkets = business?.competitor_market_types ?? []

  const [competitors, setCompetitors] = useState<Competitor[]>(dedupByName(initial))
  const [insights, setInsights]       = useState<Insight[]>(initialInsights)
  const [snapshots, setSnapshots]     = useState<Snapshot[]>(initialSnapshots)
  const [bizSnapshots]                = useState<BizSnapshot[]>(initialBizSnapshots)
  const [showModal, setShowModal]     = useState(false)
  const [showSetup, setShowSetup]     = useState(initial.length === 0 && savedMarkets.length === 0)
  const [discovering, setDiscovering] = useState(false)
  const defaultMarket = (['local', 'regional', 'international'] as const)
    .find(m => dedupByName(initial).some(c => c.market_type === m)) ?? 'local'
  const [marketFilter, setMarketFilter] = useState<'local' | 'regional' | 'international'>(defaultMarket)
  const [scanningId, setScanningId]   = useState<string | null>(null)
  const [tab, setTab]                 = useState<'competitors' | 'gaps' | 'growth' | 'trend'>('competitors')
  const [discoverMsg, setDiscoverMsg] = useState('')
  const [bulkScan, setBulkScan]       = useState<{ done: number; total: number; currentName: string } | null>(null)
  const [activeProductService, setActiveProductService] = useState('')
  const [fixModal, setFixModal]       = useState(false)
  const [fixNote, setFixNote]         = useState('')
  const [fixing, setFixing]           = useState(false)

  async function scanOne(id: string): Promise<void> {
    setCompetitors(prev => prev.map(c => c.id === id ? { ...c, crawl_status: 'scanning' } : c))
    try {
      const res  = await fetch(`/api/competitors/${id}/scan`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.competitor) {
        setCompetitors(prev => prev.map(c => c.id === id ? { ...data.competitor } : c))
        // Add today's snapshot point to chart state
        const today = new Date().toISOString().split('T')[0]
        setSnapshots(prev => [
          ...prev.filter(s => !(s.competitor_id === id && s.recorded_date === today)),
          { competitor_id: id, intelligence_score: data.competitor.intelligence_score, recorded_date: today },
        ])
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function refreshAllInsights() {
    const res  = await fetch('/api/competitors/gap-analysis')
    const data = await res.json()
    if (data.gaps || data.opportunities) {
      setInsights([
        ...(data.gaps          ?? []),
        ...(data.opportunities ?? []),
        ...(data.threats       ?? []),
        ...(data.actions       ?? []),
      ])
    }
  }

  async function startDiscovery(markets: string[], localLocation?: string, productService?: string, businessWebsite?: string) {
    setShowSetup(false)
    setDiscovering(true)
    setCompetitors([])
    setInsights([])
    setDiscoverMsg('')
    setActiveProductService(productService || '')
    setMarketFilter(markets.includes('local') ? 'local' : markets.includes('regional') ? 'regional' : 'international')
    try {
      const res  = await fetch('/api/competitors/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketTypes: markets,
          reset: true,
          localLocation: localLocation || undefined,
          productService: productService || undefined,
          businessWebsite: businessWebsite || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const found: Competitor[] = data.competitors ?? []
      setCompetitors(dedupByName(found))

      if (found.length > 0) {
        setBulkScan({ done: 0, total: found.length, currentName: found[0].name })
        for (let i = 0; i < found.length; i++) {
          setBulkScan({ done: i, total: found.length, currentName: found[i].name })
          await scanOne(found[i].id)
          setBulkScan({ done: i + 1, total: found.length, currentName: found[i].name })
        }
        await refreshAllInsights()
        setBulkScan(null)
        const marketLabels = markets.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(' + ')
        setDiscoverMsg(`✓ ${found.length} competitors discovered across ${marketLabels} markets — Gap Analysis and Growth Plan ready`)
        setTimeout(() => setDiscoverMsg(''), 10000)
      } else {
        setDiscoverMsg('No competitors found. Try adding manually or change market selection.')
      }
    } catch (err) {
      setDiscoverMsg(`Error: ${err instanceof Error ? err.message : 'Discovery failed'}`)
    } finally {
      setDiscovering(false)
    }
  }

  async function submitFix() {
    if (!fixNote.trim()) return
    setFixing(true)
    setFixModal(false)
    setDiscovering(true)
    setCompetitors([])
    setInsights([])
    setDiscoverMsg('')
    setActiveProductService(fixNote.trim().slice(0, 60) + (fixNote.trim().length > 60 ? '…' : ''))
    const savedMarketTypes = business?.competitor_market_types ?? ['local']
    try {
      const res = await fetch('/api/competitors/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketTypes: savedMarketTypes,
          reset: true,
          correctionNote: fixNote.trim(),
          productService: activeProductService || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const found: Competitor[] = data.competitors ?? []
      setCompetitors(dedupByName(found))
      if (found.length > 0) {
        setBulkScan({ done: 0, total: found.length, currentName: found[0].name })
        for (let i = 0; i < found.length; i++) {
          setBulkScan({ done: i, total: found.length, currentName: found[i].name })
          await scanOne(found[i].id)
          setBulkScan({ done: i + 1, total: found.length, currentName: found[i].name })
        }
        await refreshAllInsights()
        setBulkScan(null)
        setDiscoverMsg(`✓ Analysis updated with your feedback — ${found.length} competitors found`)
        setTimeout(() => setDiscoverMsg(''), 8000)
      } else {
        setDiscoverMsg('No competitors found. Try adjusting your description.')
      }
    } catch (err) {
      setDiscoverMsg(`Error: ${err instanceof Error ? err.message : 'Fix failed'}`)
    } finally {
      setDiscovering(false)
      setFixing(false)
    }
  }

  async function rescanAllForInsights() {
    const res  = await fetch('/api/competitors/generate-insights', { method: 'POST' })
    const data = await res.json()
    if (data.insights?.length > 0) {
      // Use insights directly from response (works even without DB migration)
      setInsights(data.insights)
    } else {
      // Fallback: try reading from DB
      await refreshAllInsights()
    }
  }

  async function scanMarket(marketType: 'local' | 'regional' | 'international') {
    setDiscovering(true)
    setDiscoverMsg('')
    try {
      const res  = await fetch('/api/competitors/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketTypes: [marketType], reset: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const found: Competitor[] = (data.competitors ?? []).filter(
        (c: Competitor) => c.market_type === marketType
      )
      if (found.length > 0) {
        setCompetitors(prev => dedupByName([...found, ...prev]))
        setBulkScan({ done: 0, total: found.length, currentName: found[0].name })
        for (let i = 0; i < found.length; i++) {
          setBulkScan({ done: i, total: found.length, currentName: found[i].name })
          await scanOne(found[i].id)
          setBulkScan({ done: i + 1, total: found.length, currentName: found[i].name })
        }
        await refreshAllInsights()
        setBulkScan(null)
        setDiscoverMsg(`✓ Found ${found.length} new ${marketType} competitors`)
        setTimeout(() => setDiscoverMsg(''), 6000)
      } else {
        setDiscoverMsg(data.message || `No new ${marketType} competitors found — all already tracked`)
        setTimeout(() => setDiscoverMsg(''), 5000)
      }
    } catch (err) {
      setDiscoverMsg(`Error: ${err instanceof Error ? err.message : 'Scan failed'}`)
    } finally {
      setDiscovering(false)
    }
  }

  async function scanCompetitor(id: string) {
    setScanningId(id)
    await scanOne(id)
    setScanningId(null)
    await refreshAllInsights()
  }

  async function deleteCompetitor(id: string) {
    if (!confirm('Remove this competitor from tracking?')) return
    await fetch(`/api/competitors?id=${id}`, { method: 'DELETE' })
    setCompetitors(prev => prev.filter(c => c.id !== id))
    setInsights(prev => prev.filter(i => i.competitor_id !== id))
  }

  const scanned     = competitors.filter(c => c.crawl_status === 'done').length
  const highThreats = competitors.filter(c => c.threat_level === 'high').length
  const avgScore    = scanned > 0
    ? Math.round(competitors.filter(c => c.crawl_status === 'done').reduce((s, c) => s + c.intelligence_score, 0) / scanned)
    : 0

  const activeMarkets = savedMarkets.length > 0 ? savedMarkets : []
  const visibleCompetitors = competitors.filter(c => c.market_type === marketFilter)

  // Setup screen (first time or "Change Market")
  if (showSetup) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5 mb-6">
          <Target className="w-5 h-5 text-red-400" />
          <h1 className="text-2xl font-bold text-white">Competitor Intelligence</h1>
          <span className="text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full font-semibold">AI-Powered</span>
        </div>
        <SetupScreen
          business={business}
          existingCount={competitors.length}
          onStart={startDiscovery}
          savedMarkets={activeMarkets}
        />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Target className="w-5 h-5 text-red-400" />
            <h1 className="text-2xl font-bold text-white">Competitor Intelligence</h1>
            <span className="text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full font-semibold">AI-Powered</span>
          </div>
          <p className="text-slate-400 text-sm">
            AI monitors your competitors daily — their rankings, social presence, services, and moves
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => scanMarket(marketFilter)} disabled={discovering}
            className="flex items-center gap-2 text-sm text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-3 py-2 rounded-xl transition-colors font-medium">
            <Bot className={`w-4 h-4 ${discovering ? 'animate-pulse' : ''}`} />
            {discovering ? 'Scanning…' : `Scan ${marketFilter.charAt(0).toUpperCase() + marketFilter.slice(1)}`}
          </button>
          <button onClick={() => setShowSetup(true)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-violet-400 bg-slate-800 border border-slate-700 hover:border-violet-500/50 px-3 py-2 rounded-xl transition-colors">
            <Settings2 className="w-4 h-4" /> Change Market
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Add Manually
          </button>
        </div>
      </div>

      {/* Active markets badge row */}
      {activeMarkets.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-500 text-xs">Monitoring:</span>
          {activeMarkets.map(m => (
            <span key={m} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
              m === 'local'         ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
              m === 'regional'      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                                      'bg-violet-500/10 border-violet-500/30 text-violet-400'
            }`}>
              {m === 'local' ? '📍' : m === 'regional' ? '🗺️' : '🌐'} {m.charAt(0).toUpperCase() + m.slice(1)}
            </span>
          ))}
        </div>
      )}

      {discoverMsg && (
        <div className={`text-sm px-4 py-3 rounded-xl border ${discoverMsg.startsWith('✓') ? 'text-emerald-300 bg-emerald-950/20 border-emerald-800/30' : 'text-red-300 bg-red-950/20 border-red-800/30'}`}>
          {discoverMsg}
        </div>
      )}

      {/* Discovering loading state */}
      {competitors.length === 0 && discovering && (
        <DiscoverProgress industry={business?.industry} productService={activeProductService || undefined} />
      )}

      {/* Empty state after failed discovery */}
      {competitors.length === 0 && !discovering && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
            <Bot className="w-7 h-7 text-slate-500" />
          </div>
          <h2 className="text-white font-bold text-lg mb-2">No competitors found yet</h2>
          <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
            Change your market selection or add competitors manually.
          </p>
          <div className="flex justify-center gap-3">
            <button onClick={() => setShowSetup(true)}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors">
              <Settings2 className="w-4 h-4" /> Change Market
            </button>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-medium px-5 py-3 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Add Manually
            </button>
          </div>
        </div>
      )}

      {/* Bulk scan progress */}
      {bulkScan && (
        <BulkScanProgress done={bulkScan.done} total={bulkScan.total} currentName={bulkScan.currentName} />
      )}

      {/* Stats */}
      {competitors.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Tracked',         value: competitors.length,  color: 'text-white',       bg: 'bg-slate-900' },
              { label: 'Scanned by AI',   value: scanned,             color: 'text-violet-400',  bg: 'bg-violet-500/10' },
              { label: 'High Threats',    value: highThreats,         color: highThreats > 0 ? 'text-red-400' : 'text-slate-500', bg: highThreats > 0 ? 'bg-red-500/10' : 'bg-slate-900' },
              { label: 'Avg Intel Score', value: avgScore || '—',     color: 'text-amber-400',   bg: 'bg-amber-500/10' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} border border-slate-800 rounded-2xl p-4 text-center`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-slate-500 text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Tabs row + Wrong Analysis button */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 flex-wrap">
              {([
                { key: 'competitors', label: `Competitors (${competitors.length})`, icon: <Target className="w-3.5 h-3.5" /> },
                { key: 'trend',       label: 'Score Trend',                         icon: <TrendingUp className="w-3.5 h-3.5" /> },
                { key: 'gaps',        label: 'Gap Analysis',                        icon: <AlertTriangle className="w-3.5 h-3.5" /> },
                { key: 'growth',      label: 'Growth Plan',                         icon: <Zap className="w-3.5 h-3.5" /> },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                    tab === t.key ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setFixModal(true)}
              disabled={discovering}
              className="flex items-center gap-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 px-4 py-2 rounded-xl transition-colors whitespace-nowrap shadow-sm shadow-rose-900/40 flex-shrink-0">
              <span className="text-base leading-none">⚠</span> Wrong Analysis? Click to fix
            </button>
          </div>

          {(tab === 'competitors' || tab === 'trend') && (
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'local',         emoji: '📍', label: 'Local',         activeBorder: 'border-emerald-500', activeBg: 'bg-emerald-500/10', activeText: 'text-emerald-300', activeBadge: 'bg-emerald-500/20 text-emerald-300' },
                { key: 'regional',      emoji: '🗺️', label: 'Regional',      activeBorder: 'border-blue-500',    activeBg: 'bg-blue-500/10',    activeText: 'text-blue-300',    activeBadge: 'bg-blue-500/20 text-blue-300' },
                { key: 'international', emoji: '🌐', label: 'International',  activeBorder: 'border-violet-500',  activeBg: 'bg-violet-500/10',  activeText: 'text-violet-300',  activeBadge: 'bg-violet-500/20 text-violet-300' },
              ] as const).map(m => {
                const count  = competitors.filter(c => c.market_type === m.key).length
                const active = marketFilter === m.key
                return (
                  <button key={m.key} onClick={() => setMarketFilter(m.key)}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left ${
                      active
                        ? `${m.activeBorder} ${m.activeBg} ring-1 ${m.activeBorder}/30`
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-800/50'
                    }`}>
                    <span className="text-xl flex-shrink-0">{m.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm ${active ? m.activeText : 'text-slate-300'}`}>{m.label}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{count} competitor{count !== 1 ? 's' : ''}</p>
                    </div>
                    <span className={`text-sm font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${
                      active ? m.activeBadge : 'bg-slate-800 text-slate-500'
                    }`}>{count}</span>
                  </button>
                )
              })}
            </div>
          )}

          {tab === 'competitors' && (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {visibleCompetitors.map(comp => (
                  <CompetitorCard
                    key={comp.id}
                    comp={comp}
                    insights={insights}
                    business={business}
                    onScan={scanCompetitor}
                    onDelete={deleteCompetitor}
                    scanning={scanningId === comp.id}
                  />
                ))}
              </div>
              {visibleCompetitors.length === 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
                  <p className="text-3xl mb-3">
                    {marketFilter === 'local' ? '📍' : marketFilter === 'regional' ? '🗺️' : '🌐'}
                  </p>
                  <p className="text-white font-semibold text-sm mb-1">
                    No {marketFilter.charAt(0).toUpperCase() + marketFilter.slice(1)} competitors yet
                  </p>
                  <p className="text-slate-500 text-xs mb-4">
                    Click &quot;Change Market&quot; and include {marketFilter} market to discover competitors here.
                  </p>
                  <button onClick={() => setShowSetup(true)}
                    className="inline-flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-4 py-2 rounded-xl transition-colors">
                    <Settings2 className="w-3.5 h-3.5" /> Change Market
                  </button>
                </div>
              )}
            </>
          )}

          {tab === 'trend' && (
            <TrendChart
              snapshots={snapshots}
              bizSnapshots={bizSnapshots}
              competitors={visibleCompetitors}
              business={business}
            />
          )}

          {tab === 'gaps' && <GapAnalysisTab insights={insights} competitors={competitors} onRegenerate={rescanAllForInsights} />}
          {tab === 'growth' && <GrowthPlanTab insights={insights} onRegenerate={rescanAllForInsights} />}
        </>
      )}

      {/* AI running notice */}
      {competitors.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <p className="text-slate-400 text-sm">
            AI competitor scans run <strong className="text-white">daily at midnight</strong> automatically. You&apos;ll get agent signals when a competitor makes a significant move.
          </p>
        </div>
      )}

      {showModal && <AddModal onClose={() => setShowModal(false)} onAdded={c => setCompetitors(prev => [c, ...prev])} />}

      {/* Wrong Analysis Fix Modal */}
      {fixModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-white font-bold text-lg">Fix the Analysis</h3>
                <p className="text-slate-400 text-sm mt-0.5">Tell AI what&apos;s wrong — it will re-run with your correction</p>
              </div>
              <button onClick={() => setFixModal(false)} className="text-slate-500 hover:text-white transition-colors ml-4 mt-0.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-2">
              <label className="block text-slate-400 text-xs font-medium mb-2">
                ✏️ Explain your service or what&apos;s missing in the analysis
              </label>
              <textarea
                value={fixNote}
                onChange={e => setFixNote(e.target.value)}
                rows={5}
                autoFocus
                placeholder={`e.g. We are a SaaS company providing biometric attendance software for schools and factories in Bangladesh. The competitors found are not in our space — we need competitors offering HR & attendance management software, not general EdTech companies.`}
                className="w-full bg-slate-800 border border-slate-700 focus:border-amber-500 text-white text-sm px-4 py-3 rounded-xl outline-none transition-colors placeholder-slate-600 resize-none leading-relaxed"
              />
              <p className="text-slate-600 text-xs mt-1.5">
                This note will be saved and used in all future AI analyses for this business.
              </p>
            </div>

            {fixNote.trim() && (
              <div className="mb-4 p-3 bg-amber-950/20 border border-amber-800/30 rounded-xl">
                <p className="text-amber-400 text-xs font-semibold mb-1">AI will be instructed to:</p>
                <ul className="text-amber-300/80 text-xs space-y-0.5 list-disc list-inside">
                  <li>Re-run competitor discovery with your correction</li>
                  <li>Focus on the exact service/market you described</li>
                  <li>Ignore previously found irrelevant competitors</li>
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setFixModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitFix}
                disabled={!fixNote.trim() || fixing}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {fixing
                  ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Fixing…</>
                  : '⚡ Re-run Analysis with Fix'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
