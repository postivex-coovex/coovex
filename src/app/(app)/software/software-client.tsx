'use client'

import { useState, useMemo } from 'react'
import { LayoutGrid, Star, ExternalLink, Sparkles, Trash2, Plus, Check } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SoftwareItem {
  id: string
  name: string
  slug: string
  category: string
  tagline: string | null
  description: string | null
  website: string | null
  logo_url: string | null
  pricing_model: string
  price_from: number
  features: string[]
  rating: number
  is_coovex_pick: boolean
  affiliate_url: string | null
}

interface StackItem {
  id: string
  software_id: string
  status: 'using' | 'interested' | 'not_relevant'
  notes: string | null
  added_at: string
  software: SoftwareItem
}

interface Recommendation {
  name: string
  reason: string
  priority: 'must-have' | 'recommended' | 'nice-to-have'
  category: string
  software_id: string | null
}

interface SoftwareClientProps {
  initialCatalog: SoftwareItem[]
  initialStack: StackItem[]
  businessName: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'all',                label: 'All' },
  { key: 'crm',                label: 'CRM' },
  { key: 'email_marketing',    label: 'Email' },
  { key: 'project_management', label: 'Project' },
  { key: 'accounting',         label: 'Accounting' },
  { key: 'analytics',          label: 'Analytics' },
  { key: 'customer_support',   label: 'Support' },
  { key: 'social_media',       label: 'Social' },
  { key: 'hr_payroll',         label: 'HR' },
  { key: 'communication',      label: 'Comms' },
  { key: 'ecommerce',          label: 'Ecommerce' },
  { key: 'automation',         label: 'Automation' },
  { key: 'ai_tools',           label: 'AI Tools' },
]

const PRIORITY_META = {
  'must-have':    { label: 'Must-Have',    cls: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  'recommended':  { label: 'Recommended', cls: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  'nice-to-have': { label: 'Nice to Have', cls: 'bg-slate-700 text-slate-400 border border-slate-600' },
}

const STATUS_META = {
  using:        { label: 'Using',      cls: 'bg-blue-600/20 text-blue-400 border border-blue-500/30' },
  interested:   { label: 'Interested', cls: 'bg-slate-600/20 text-slate-500 border border-slate-500/30' },
  not_relevant: { label: 'Skipped',    cls: 'bg-slate-700 text-slate-400 border border-slate-600' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFaviconUrl(website: string | null): string {
  if (!website) return ''
  try {
    const domain = new URL(website).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  } catch { return '' }
}

function formatPrice(pricingModel: string, priceFrom: number): string {
  if (pricingModel === 'free') return 'Free'
  if (pricingModel === 'freemium') return priceFrom === 0 ? 'Free plan' : `Free + from $${(priceFrom / 100).toFixed(0)}/mo`
  if (pricingModel === 'custom') return 'Custom pricing'
  if (priceFrom === 0) return 'Paid'
  return `From $${(priceFrom / 100).toFixed(0)}/mo`
}

function pricingBadgeCls(model: string): string {
  if (model === 'free') return 'bg-blue-600/20 text-blue-400'
  if (model === 'freemium') return 'bg-blue-500/20 text-blue-400'
  return 'bg-slate-700 text-slate-300'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SoftwareCard({
  sw,
  inStack,
  onToggle,
}: {
  sw: SoftwareItem
  inStack: boolean
  onToggle: (sw: SoftwareItem) => void
}) {
  const favicon = getFaviconUrl(sw.website)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 hover:border-slate-700 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {favicon
            ? <img src={favicon} alt={sw.name} className="w-8 h-8 object-contain" />
            : <span className="text-sm font-bold text-slate-400">{sw.name[0]}</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-white">{sw.name}</span>
            {sw.is_coovex_pick && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-slate-600/20 text-slate-500 border border-slate-500/30">
                CooVex Pick
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{sw.tagline}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${pricingBadgeCls(sw.pricing_model)}`}>
          {formatPrice(sw.pricing_model, sw.price_from)}
        </span>
        <div className="flex items-center gap-0.5 ml-auto">
          {[1, 2, 3, 4, 5].map(s => (
            <Star
              key={s}
              className={`w-3 h-3 ${s <= Math.round(sw.rating) ? 'text-slate-500 fill-amber-400' : 'text-slate-600'}`}
            />
          ))}
          <span className="text-[11px] text-slate-500 ml-1">{sw.rating}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-auto">
        <button
          onClick={() => onToggle(sw)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors flex-1 justify-center ${
            inStack
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {inStack ? <><Check className="w-3 h-3" /> Using</> : <><Plus className="w-3 h-3" /> Add</>}
        </button>
        {sw.website && (
          <a
            href={sw.affiliate_url ?? sw.website}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SoftwareClient({ initialCatalog, initialStack, businessName }: SoftwareClientProps) {
  const [activeTab, setActiveTab] = useState<'recommended' | 'browse' | 'stack'>('recommended')
  const [catalog] = useState<SoftwareItem[]>(initialCatalog)
  const [stack, setStack] = useState<StackItem[]>(initialStack)
  const [activeCategory, setActiveCategory] = useState('all')

  // Recommendations state
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState('')

  // Stack IDs for quick lookup
  const stackIds = useMemo(() => new Set(stack.map(s => s.software_id)), [stack])

  // Filtered catalog
  const filteredCatalog = useMemo(() => {
    if (activeCategory === 'all') return catalog
    return catalog.filter(s => s.category === activeCategory)
  }, [catalog, activeCategory])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleToggleStack = async (sw: SoftwareItem) => {
    const inStack = stackIds.has(sw.id)
    if (inStack) {
      // Remove
      await fetch('/api/software', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ software_id: sw.id }),
      })
      setStack(prev => prev.filter(s => s.software_id !== sw.id))
    } else {
      // Add
      const res = await fetch('/api/software', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ software_id: sw.id, status: 'using' }),
      })
      const data = await res.json()
      if (data.record) {
        setStack(prev => [...prev, data.record])
      }
    }
  }

  const handleRemoveFromStack = async (stackItem: StackItem) => {
    await fetch('/api/software', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ software_id: stackItem.software_id }),
    })
    setStack(prev => prev.filter(s => s.id !== stackItem.id))
  }

  const handleGetRecommendations = async () => {
    setRecLoading(true)
    setRecError('')
    try {
      const res = await fetch('/api/software/recommend', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to get recommendations')
      setRecommendations(data.recommendations ?? [])
    } catch (e: unknown) {
      setRecError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setRecLoading(false)
    }
  }

  const handleAddFromRec = async (rec: Recommendation) => {
    if (!rec.software_id) return
    const sw = catalog.find(s => s.id === rec.software_id)
    if (sw) await handleToggleStack(sw)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 flex items-center justify-center">
            <LayoutGrid className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Software Hub</h1>
            <p className="text-xs text-slate-400">Discover, track, and get AI recommendations for your tech stack</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-slate-900 rounded-xl p-1 border border-slate-800 w-fit mb-6">
          {([
            { key: 'recommended', label: 'Recommended' },
            { key: 'browse',      label: 'Browse' },
            { key: 'stack',       label: `My Stack (${stack.length})` },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Recommended Tab ── */}
        {activeTab === 'recommended' && (
          <div className="space-y-4 pb-10">
            {recommendations.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
                <Sparkles className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                <h2 className="text-lg font-medium text-white mb-2">AI Software Recommendations</h2>
                <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
                  Get personalized software recommendations based on your business profile
                  {businessName ? ` for ${businessName}` : ''}. Our AI analyzes your industry, size, and current stack.
                </p>
                {recError && (
                  <p className="text-red-400 text-sm mb-4">{recError}</p>
                )}
                <button
                  onClick={handleGetRecommendations}
                  disabled={recLoading}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 mx-auto"
                >
                  <Sparkles className="w-4 h-4" />
                  {recLoading ? 'Analyzing your business...' : 'Get AI Recommendations (5 credits)'}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">{recommendations.length} personalized recommendations</p>
                  <button
                    onClick={handleGetRecommendations}
                    disabled={recLoading}
                    className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                  >
                    {recLoading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recommendations.map((rec, i) => {
                    const sw = rec.software_id ? catalog.find(s => s.id === rec.software_id) : null
                    const alreadyIn = rec.software_id ? stackIds.has(rec.software_id) : false
                    const meta = PRIORITY_META[rec.priority]
                    const favicon = sw ? getFaviconUrl(sw.website) : ''

                    return (
                      <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {favicon
                              ? <img src={favicon} alt={rec.name} className="w-8 h-8 object-contain" />
                              : <span className="text-sm font-bold text-slate-400">{rec.name[0]}</span>
                            }
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white">{rec.name}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>
                                {meta.label}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 capitalize">{rec.category.replace(/_/g, ' ')}</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed mb-4">{rec.reason}</p>
                        <div className="flex items-center gap-2">
                          {rec.software_id && (
                            <button
                              onClick={() => handleAddFromRec(rec)}
                              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                                alreadyIn
                                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                  : 'bg-blue-600 hover:bg-blue-500 text-white'
                              }`}
                            >
                              {alreadyIn ? <><Check className="w-3 h-3" /> Added</> : <><Plus className="w-3 h-3" /> Add to Stack</>}
                            </button>
                          )}
                          {sw?.website && (
                            <a
                              href={sw.affiliate_url ?? sw.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Learn More
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Browse Tab ── */}
        {activeTab === 'browse' && (
          <div className="space-y-5 pb-10">
            {/* Category filters */}
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeCategory === cat.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCatalog.map(sw => (
                <SoftwareCard
                  key={sw.id}
                  sw={sw}
                  inStack={stackIds.has(sw.id)}
                  onToggle={handleToggleStack}
                />
              ))}
            </div>

            {filteredCatalog.length === 0 && (
              <div className="text-center py-10 text-slate-500 text-sm">No software in this category yet.</div>
            )}
          </div>
        )}

        {/* ── My Stack Tab ── */}
        {activeTab === 'stack' && (
          <div className="space-y-3 pb-10">
            {stack.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
                <LayoutGrid className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h2 className="text-lg font-medium text-white mb-2">Your tech stack is empty</h2>
                <p className="text-slate-400 text-sm mb-5">
                  Add the tools you currently use to track your tech stack and get better AI recommendations.
                </p>
                <button
                  onClick={() => setActiveTab('browse')}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm transition-colors"
                >
                  Browse Software
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-400 mb-2">{stack.length} tool{stack.length !== 1 ? 's' : ''} in your stack</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stack.map(item => {
                    const sw = item.software
                    const favicon = getFaviconUrl(sw?.website)
                    const statusMeta = STATUS_META[item.status] ?? STATUS_META.using
                    return (
                      <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {favicon
                              ? <img src={favicon} alt={sw?.name} className="w-8 h-8 object-contain" />
                              : <span className="text-sm font-bold text-slate-400">{sw?.name?.[0]}</span>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">{sw?.name}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusMeta.cls}`}>
                              {statusMeta.label}
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveFromStack(item)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-950/30 transition-colors flex-shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {item.notes && (
                          <p className="text-xs text-slate-500 mb-2">{item.notes}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500 capitalize">{sw?.category?.replace(/_/g, ' ')}</span>
                          {sw?.website && (
                            <a
                              href={sw.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
