'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ExternalLink, MessageSquare, Copy, Check, RefreshCw, Radio, Globe, Sparkles, ChevronDown, History, X, MapPin } from 'lucide-react'

// ── search history ─────────────────────────────────────────────────────────

const HISTORY_KEY = 'coovex_community_lead_history'
const MAX_HISTORY = 15

interface SearchRecord {
  keyword: string
  platform: 'reddit' | 'hackernews'
  product_name: string
  countries: string[]
  leads_found: number
  searched_at: number
}

function loadHistory(): SearchRecord[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') }
  catch { return [] }
}

function saveToHistory(record: SearchRecord) {
  if (typeof window === 'undefined') return
  try {
    const history = loadHistory().filter(
      h => !(h.keyword === record.keyword && h.platform === record.platform)
    )
    history.unshift(record)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
  } catch {}
}

// ── types ──────────────────────────────────────────────────────────────────

interface CommunityLead {
  id: string
  title: string
  body: string
  community: string
  author: string
  score: number
  comments: number
  url: string
  quality: number
  created_utc: number
  platform: 'reddit' | 'hackernews' | 'linkedin'
  kind?: 'post' | 'comment'
}

interface Product {
  id: string
  name: string
  tagline: string | null
  description: string | null
}

// ── country list ───────────────────────────────────────────────────────────

const COUNTRIES = [
  { value: 'Bangladesh',     flag: '🇧🇩' },
  { value: 'India',          flag: '🇮🇳' },
  { value: 'Pakistan',       flag: '🇵🇰' },
  { value: 'United States',  flag: '🇺🇸' },
  { value: 'United Kingdom', flag: '🇬🇧' },
  { value: 'Canada',         flag: '🇨🇦' },
  { value: 'Australia',      flag: '🇦🇺' },
  { value: 'Germany',        flag: '🇩🇪' },
  { value: 'France',         flag: '🇫🇷' },
  { value: 'Netherlands',    flag: '🇳🇱' },
  { value: 'UAE',            flag: '🇦🇪' },
  { value: 'Saudi Arabia',   flag: '🇸🇦' },
  { value: 'Singapore',      flag: '🇸🇬' },
  { value: 'Malaysia',       flag: '🇲🇾' },
  { value: 'Nigeria',        flag: '🇳🇬' },
  { value: 'Philippines',    flag: '🇵🇭' },
  { value: 'Brazil',         flag: '🇧🇷' },
  { value: 'Mexico',         flag: '🇲🇽' },
  { value: 'South Africa',   flag: '🇿🇦' },
  { value: 'Indonesia',      flag: '🇮🇩' },
  { value: 'Turkey',         flag: '🇹🇷' },
  { value: 'Japan',          flag: '🇯🇵' },
]

// ── platforms ──────────────────────────────────────────────────────────────

type Platform = 'reddit' | 'hackernews' | 'linkedin' | 'quora'

// ── helpers ────────────────────────────────────────────────────────────────

function timeAgo(utc: number): string {
  const diff = Math.floor(Date.now() / 1000) - utc
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800)  return `${Math.floor(diff / 86400)}d ago`
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`
  return `${Math.floor(diff / 2592000)}mo ago`
}

function qualityColor(q: number) {
  if (q >= 8) return 'text-blue-400 bg-slate-950/40 border-slate-700/40'
  if (q >= 4) return 'text-slate-500 bg-slate-950/40 border-slate-700/40'
  return 'text-slate-400 bg-slate-800/60 border-slate-700'
}

function qualityLabel(q: number) {
  if (q >= 8) return 'Hot lead'
  if (q >= 4) return 'Good lead'
  return 'Low intent'
}

// ── LeadCard ──────────────────────────────────────────────────────────────

function LeadCard({ lead, product, businessName }: {
  lead: CommunityLead
  product: Product | null
  businessName: string
}) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [reply, setReply] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  async function generateReply() {
    setGenerating(true)
    setReplyOpen(true)
    try {
      const res = await fetch('/api/community-leads/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_title: lead.title,
          post_body: lead.body,
          platform: lead.platform,
          product_name: product?.name,
          product_description: product?.description ?? product?.tagline,
          business_name: businessName,
        }),
      })
      const data = await res.json()
      setReply(data.reply ?? '')
    } finally {
      setGenerating(false)
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(reply)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const platformIcon = lead.platform === 'reddit'
    ? <span className="text-slate-500 font-bold text-[10px]">r/</span>
    : <span className="text-slate-600 font-bold text-[10px]">Y</span>

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
            {platformIcon} {lead.community}
          </span>
          {lead.kind === 'comment' && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-600/15 text-slate-500 border border-slate-500/25">
              comment
            </span>
          )}
          <span className="text-slate-600 text-[10px]">u/{lead.author}</span>
          <span className="text-slate-600 text-[10px]">·</span>
          <span className="text-slate-500 text-[10px]">{timeAgo(lead.created_utc)}</span>
          <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${qualityColor(lead.quality)}`}>
            {qualityLabel(lead.quality)}
          </span>
        </div>

        <p className="text-white text-sm font-semibold leading-snug mb-1.5 line-clamp-2">{lead.title}</p>

        {lead.body && (
          <p className="text-slate-500 text-xs leading-relaxed line-clamp-2 mb-3">{lead.body}</p>
        )}

        <div className="flex items-center gap-3 text-slate-500 text-xs">
          <span>▲ {lead.score}</span>
          <span>💬 {lead.comments}</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={generateReply}
              disabled={generating}
              className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-slate-700/40 text-blue-300 transition-colors disabled:opacity-50"
            >
              <MessageSquare className="w-3 h-3" />
              {generating ? 'Generating…' : 'AI Reply'}
            </button>
            <a
              href={lead.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            >
              View <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
      </div>

      {replyOpen && (
        <div className="border-t border-slate-800 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-400">AI-Generated Reply</span>
            <div className="flex gap-2">
              {reply && (
                <button onClick={copy} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors">
                  {copied ? <><Check className="w-3 h-3 text-blue-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              )}
              <button onClick={() => setReplyOpen(false)} className="text-slate-600 hover:text-slate-400 text-xs">✕</button>
            </div>
          </div>
          {generating ? (
            <div className="flex items-center gap-2 text-slate-500 text-xs py-2">
              <div className="w-3 h-3 border border-slate-600 border-t-violet-400 rounded-full animate-spin" />
              Writing contextual reply…
            </div>
          ) : (
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              rows={4}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 text-xs leading-relaxed focus:outline-none focus:border-blue-500 resize-none transition-colors"
            />
          )}
          <p className="text-slate-600 text-[10px] mt-1.5">Edit before posting. Click View to open the thread.</p>
        </div>
      )}
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────

export default function CommunityLeadsPage() {
  const [platform, setPlatform] = useState<Platform>('reddit')
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [leads, setLeads] = useState<CommunityLead[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [businessName, setBusinessName] = useState('My Business')

  // AI keyword states
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([])
  const [activeKeyword, setActiveKeyword] = useState('')
  const [generatingKeywords, setGeneratingKeywords] = useState(false)
  const [customKeyword, setCustomKeyword] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  // Multi-select countries
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [showAllCountries, setShowAllCountries] = useState(false)

  // Search history
  const [history, setHistory] = useState<SearchRecord[]>([])

  const didInitRef = useRef(false)

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/products').then(r => r.json()),
      fetch('/api/businesses').then(r => r.json()).catch(() => ({})),
    ]).then(([pd, bd]) => {
      const prods: Product[] = pd.products ?? []
      setProducts(prods)
      const name = bd.business?.name ?? bd.businesses?.[0]?.name
      if (name) setBusinessName(name)
      if (prods.length > 0 && !didInitRef.current) {
        didInitRef.current = true
        generateKeywordsAndSearch(prods[0], 'reddit')
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleCountry(c: string) {
    setSelectedCountries(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    )
  }

  const searchWithKeyword = useCallback(async (
    kw: string,
    plt: Platform = platform,
    countries: string[] = selectedCountries,
    product: Product | null = selectedProduct,
  ) => {
    if (!kw.trim()) return
    if (plt !== 'reddit' && plt !== 'hackernews' && plt !== 'linkedin') return
    setLoading(true)
    setSearched(true)
    setLeads([])
    setActiveKeyword(kw)

    try {
      let allLeads: CommunityLead[] = []

      // LinkedIn doesn't use country filter (Apify handles it globally)
      if (plt === 'linkedin' || countries.length === 0) {
        const res = await fetch('/api/community-leads/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: kw, platform: plt }),
        })
        const data = await res.json()
        allLeads = data.leads ?? []
      } else {
        // Parallel search per country (max 3 to avoid rate limit)
        const targets = countries.slice(0, 3)
        const results = await Promise.allSettled(
          targets.map(c =>
            fetch('/api/community-leads/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ keyword: `${kw} ${c}`, platform: plt }),
            }).then(r => r.json()).then(d => d.leads ?? [] as CommunityLead[])
          )
        )
        const seen = new Set<string>()
        for (const r of results) {
          if (r.status !== 'fulfilled') continue
          for (const lead of r.value as CommunityLead[]) {
            if (!seen.has(lead.id)) { seen.add(lead.id); allLeads.push(lead) }
          }
        }
        allLeads.sort((a, b) => b.quality - a.quality)
        allLeads = allLeads.slice(0, 30)
      }

      setLeads(allLeads)

      // Save to history (pure side-effect, no setState hack)
      const record: SearchRecord = {
        keyword: kw,
        platform: plt as 'reddit' | 'hackernews',
        product_name: product?.name ?? '',
        countries,
        leads_found: allLeads.length,
        searched_at: Date.now(),
      }
      saveToHistory(record)
      setHistory(loadHistory())
    } finally {
      setLoading(false)
    }
  }, [platform, selectedCountries, selectedProduct])

  async function generateKeywordsAndSearch(product: Product, plt: Platform) {
    setSelectedProduct(product)
    setSuggestedKeywords([])
    setLeads([])
    setSearched(false)
    setActiveKeyword('')
    setGeneratingKeywords(true)

    try {
      const res = await fetch('/api/community-leads/suggest-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: product.name,
          product_description: product.description,
          product_tagline: product.tagline,
          platform: plt,
        }),
      })
      const data = await res.json()
      const keywords: string[] = data.keywords ?? []
      setSuggestedKeywords(keywords)

      if (keywords[0] && (plt === 'reddit' || plt === 'hackernews')) {
        await searchWithKeyword(keywords[0], plt, selectedCountries, product)
      }
    } finally {
      setGeneratingKeywords(false)
    }
  }

  function handleProductChange(productId: string) {
    const p = products.find(x => x.id === productId) ?? null
    if (!p) { setSelectedProduct(null); setSuggestedKeywords([]); setActiveKeyword(''); return }
    generateKeywordsAndSearch(p, platform)
  }

  function handlePlatformChange(plt: Platform) {
    setPlatform(plt)
    setLeads([])
    setSearched(false)
    setActiveKeyword('')
    if (selectedProduct && (plt === 'reddit' || plt === 'hackernews')) {
      generateKeywordsAndSearch(selectedProduct, plt)
    }
  }

  const linkedinUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(activeKeyword || selectedProduct?.name || 'your service')}&origin=GLOBAL_SEARCH_HEADER`
  const quoraGoogleUrl = `https://www.google.com/search?q=site:quora.com+${encodeURIComponent(activeKeyword || selectedProduct?.name || 'your topic')}`

  const VISIBLE_COUNTRIES = showAllCountries ? COUNTRIES : COUNTRIES.slice(0, 10)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <Radio className="w-5 h-5 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Community Leads</h1>
        </div>
        <p className="text-slate-400 text-sm">
          AI finds people on Reddit & HN who need your service. Select your product and leads appear automatically.
        </p>
      </div>

      {/* Platform tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-5 w-fit flex-wrap">
        {([
          { id: 'reddit',     label: 'Reddit',      color: 'text-slate-500', live: true           },
          { id: 'hackernews', label: 'Hacker News', color: 'text-slate-600', live: true           },
          { id: 'linkedin',   label: 'LinkedIn',    color: 'text-blue-400',   live: true           },
          { id: 'quora',      label: 'Quora',       color: 'text-red-400',    live: false          },
        ] as { id: Platform; label: string; color: string; live: boolean }[]).map(p => (
          <button
            key={p.id}
            onClick={() => handlePlatformChange(p.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              platform === p.id ? `bg-slate-800 ${p.color}` : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {p.label}
            {p.live
              ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white">LIVE</span>
              : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-500 text-white">MANUAL</span>
            }
          </button>
        ))}
      </div>

      {/* Product selector */}
      {products.length > 0 && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Your Product / Service</label>
          <select
            value={selectedProduct?.id ?? ''}
            onChange={e => handleProductChange(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors w-full max-w-sm"
          >
            <option value="">Select a product…</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {/* Target Location multi-select */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-3.5 h-3.5 text-slate-500" />
          <label className="text-xs font-medium text-slate-500">Target Location</label>
          {selectedCountries.length > 0 && (
            <button
              onClick={() => setSelectedCountries([])}
              className="text-[10px] text-slate-600 hover:text-slate-400 ml-1 flex items-center gap-0.5"
            >
              <X className="w-2.5 h-2.5" /> Clear
            </button>
          )}
          <span className="text-[10px] text-slate-700 ml-auto">
            {selectedCountries.length === 0 ? 'All countries' : `${selectedCountries.length} selected`}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {/* ALL chip */}
          <button
            onClick={() => setSelectedCountries([])}
            className={`text-xs px-3 py-1 rounded-full border transition-all font-medium ${
              selectedCountries.length === 0
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
            }`}
          >
            🌐 All
          </button>

          {VISIBLE_COUNTRIES.map(c => (
            <button
              key={c.value}
              onClick={() => toggleCountry(c.value)}
              className={`text-xs px-3 py-1 rounded-full border transition-all font-medium ${
                selectedCountries.includes(c.value)
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
              }`}
            >
              {c.flag} {c.value}
            </button>
          ))}

          <button
            onClick={() => setShowAllCountries(v => !v)}
            className="text-xs px-3 py-1 rounded-full border border-dashed border-slate-700 text-slate-600 hover:text-slate-400 hover:border-slate-600 transition-colors flex items-center gap-1"
          >
            {showAllCountries ? 'Show less' : `+${COUNTRIES.length - 10} more`}
            <ChevronDown className={`w-3 h-3 transition-transform ${showAllCountries ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* AI Keyword chips */}
      {(platform === 'reddit' || platform === 'hackernews') && (
        <div className="mb-6">
          {generatingKeywords ? (
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <div className="w-3.5 h-3.5 border border-slate-600 border-t-violet-400 rounded-full animate-spin" />
              <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              AI is generating search keywords…
            </div>
          ) : suggestedKeywords.length > 0 ? (
            <div>
              <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-blue-400" />
                AI-suggested keywords — click to search
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedKeywords.map((kw, i) => (
                  <button
                    key={i}
                    onClick={() => searchWithKeyword(kw)}
                    disabled={loading}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium disabled:opacity-50 ${
                      activeKeyword === kw
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-700 hover:text-blue-300'
                    }`}
                  >
                    {loading && activeKeyword === kw
                      ? <span className="flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5 animate-spin" /> {kw}</span>
                      : kw
                    }
                  </button>
                ))}

                <button
                  onClick={() => setShowCustom(v => !v)}
                  className="text-xs px-3 py-1.5 rounded-full border border-dashed border-slate-700 text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1"
                >
                  Custom <ChevronDown className={`w-3 h-3 transition-transform ${showCustom ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {showCustom && (
                <div className="flex gap-2 mt-3 max-w-md">
                  <input
                    value={customKeyword}
                    onChange={e => setCustomKeyword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchWithKeyword(customKeyword.trim())}
                    placeholder="Type your own keyword…"
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    onClick={() => searchWithKeyword(customKeyword.trim())}
                    disabled={loading || !customKeyword.trim()}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
                  </button>
                </div>
              )}
            </div>
          ) : !selectedProduct ? (
            <p className="text-slate-600 text-xs">Select a product above — AI will automatically generate keywords and find leads.</p>
          ) : null}
        </div>
      )}

      {/* Search History */}
      {history.length > 0 && (platform === 'reddit' || platform === 'hackernews') && !loading && !generatingKeywords && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              Recent searches
            </p>
            <button
              onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]) }}
              className="text-[10px] text-slate-700 hover:text-slate-500 transition-colors"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {history.filter(h => h.platform === platform).slice(0, 8).map((h, i) => (
              <button
                key={i}
                onClick={() => searchWithKeyword(h.keyword)}
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700 transition-colors group"
              >
                <History className="w-2.5 h-2.5 text-slate-700 group-hover:text-slate-500" />
                {h.keyword}
                {h.leads_found > 0 && (
                  <span className="text-[9px] text-slate-700 group-hover:text-slate-600">({h.leads_found})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Reddit / HN results ── */}
      {(platform === 'reddit' || platform === 'hackernews') && (
        <>
          {loading && (
            <>
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-4">
                <div className="w-3.5 h-3.5 border border-slate-600 border-t-violet-400 rounded-full animate-spin" />
                Searching {platform === 'reddit' ? 'Reddit' : 'Hacker News'} for &ldquo;{activeKeyword}&rdquo;
                {selectedCountries.length > 0 && ` in ${selectedCountries.join(', ')}`}…
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="h-40 bg-slate-900 rounded-xl animate-pulse border border-slate-800" />
                ))}
              </div>
            </>
          )}

          {!loading && searched && leads.length === 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 text-center">
              <p className="text-slate-400 font-medium">No results found</p>
              <p className="text-slate-600 text-sm mt-1">Try a different keyword or change location filter</p>
            </div>
          )}

          {!loading && !searched && !generatingKeywords && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl py-12 text-center">
              <Radio className="w-8 h-8 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Select a product above to find community leads automatically</p>
            </div>
          )}

          {!loading && leads.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-slate-400 text-sm">
                  <span className="text-white font-semibold">{leads.length}</span> potential leads for{' '}
                  <span className="text-blue-300">&ldquo;{activeKeyword}&rdquo;</span>
                  {selectedCountries.length > 0 && (
                    <span className="text-slate-500"> · {selectedCountries.join(', ')}</span>
                  )}
                </p>
                <button
                  onClick={() => searchWithKeyword(activeKeyword)}
                  className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {leads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} product={selectedProduct} businessName={businessName} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── LinkedIn ── */}
      {platform === 'linkedin' && (
        <div className="space-y-4">
          {loading && (
            <>
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-4">
                <div className="w-3.5 h-3.5 border border-slate-600 border-t-violet-400 rounded-full animate-spin" />
                Scraping LinkedIn for &ldquo;{activeKeyword}&rdquo;…
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1,2,3,4].map(i => <div key={i} className="h-40 bg-slate-900 rounded-xl animate-pulse border border-slate-800" />)}
              </div>
            </>
          )}
          {!loading && searched && leads.length === 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl py-12 text-center">
              <p className="text-slate-400 font-medium">No LinkedIn posts found</p>
              <p className="text-slate-500 text-sm mt-1">Try a different keyword</p>
            </div>
          )}
          {!loading && leads.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-slate-400 text-sm">
                  <span className="text-white font-semibold">{leads.length}</span> LinkedIn posts for{' '}
                  <span className="text-blue-300">&ldquo;{activeKeyword}&rdquo;</span>
                </p>
                <button onClick={() => searchWithKeyword(activeKeyword)} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {leads.map(lead => <LeadCard key={lead.id} lead={lead} product={selectedProduct} businessName={businessName} />)}
              </div>
            </>
          )}
          {!loading && !searched && !generatingKeywords && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl py-10 text-center">
              <p className="text-slate-500 text-sm">Select a product and click a keyword chip to scrape LinkedIn</p>
            </div>
          )}
        </div>
      )}

      {/* ── Quora helper ── */}
      {platform === 'quora' && (
        <div className="space-y-4">
          <div className="bg-red-950/20 border border-red-800/30 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center flex-shrink-0">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-1">Quora Question Finder</h3>
                <p className="text-slate-400 text-sm mb-4">
                  Find Quora questions about your service via Google. Answer them — Quora answers get long-term organic traffic.
                </p>
                <a href={quoraGoogleUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
                  Find Quora Questions <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
          <LinkedInReplyHelper keyword={activeKeyword || selectedProduct?.name || ''} businessName={businessName} product={selectedProduct} label="Quora Answer" platform="quora" />
        </div>
      )}
    </div>
  )
}

// ── LinkedIn/Quora reply helper ────────────────────────────────────────────

function LinkedInReplyHelper({
  keyword, businessName, product,
  label = 'LinkedIn Comment',
  platform = 'linkedin',
}: {
  keyword: string
  businessName: string
  product: Product | null
  label?: string
  platform?: string
}) {
  const [topic, setTopic] = useState('')
  const [reply, setReply] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => { if (keyword) setTopic(keyword) }, [keyword])

  async function generate() {
    if (!topic.trim()) return
    setGenerating(true)
    try {
      const res = await fetch('/api/community-leads/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_title: topic, platform,
          product_name: product?.name,
          product_description: product?.description ?? product?.tagline,
          business_name: businessName,
        }),
      })
      const data = await res.json()
      setReply(data.reply ?? '')
    } finally {
      setGenerating(false)
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(reply)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h4 className="text-white font-medium mb-3 text-sm">AI {label} Generator</h4>
      <div className="flex gap-2 mb-3">
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="Describe the post topic or question…"
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
        />
        <button
          onClick={generate}
          disabled={generating || !topic.trim()}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
          Generate
        </button>
      </div>
      {reply && (
        <div>
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            rows={5}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 text-sm leading-relaxed focus:outline-none focus:border-blue-500 resize-none transition-colors mb-2"
          />
          <button onClick={copy} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
            {copied ? <><Check className="w-3 h-3 text-blue-400" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy reply</>}
          </button>
        </div>
      )}
    </div>
  )
}
