'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AIPageContext } from '@/components/ui/ai-page-context'

interface Product {
  id: string
  name: string
  type: 'product' | 'service'
  tagline: string | null
  description: string | null
  price: number | null
  price_unit: string | null
  currency: string
  category: string | null
  target_audience: string | null
  key_benefits: string | null
  status: 'active' | 'draft' | 'discontinued'
  lead_count: number
  created_at: string
}

interface RedditLead {
  id: string
  title: string
  subreddit: string
  author: string
  score: number
  num_comments: number
  url: string
  quality: number
  created_utc: number
}

const STATUS_STYLE = {
  active:       'bg-slate-900/40 text-blue-300 border-slate-700/40',
  draft:        'bg-slate-800 text-slate-400 border-slate-700',
  discontinued: 'bg-red-900/30 text-red-400 border-red-800/30',
}

const TYPE_STYLE = {
  service: 'bg-slate-900/30 text-blue-300 border-slate-700/30',
  product: 'bg-blue-900/30 text-blue-300 border-blue-800/30',
}

const PRICE_UNITS = [
  { value: 'one-time', label: 'One-time' },
  { value: 'monthly',  label: '/month' },
  { value: 'yearly',   label: '/year' },
  { value: 'per-hour', label: '/hour' },
  { value: 'per-day',  label: '/day' },
  { value: 'custom',   label: 'Custom' },
]

const EMPTY_FORM = {
  name: '', type: 'service' as 'product' | 'service', tagline: '', description: '',
  price: '', price_unit: 'one-time', currency: 'USD', category: '',
  target_audience: '', key_benefits: '', status: 'active' as 'active' | 'draft' | 'discontinued',
}

function ProductModal({
  initial, onClose, onSaved,
}: {
  initial?: Product | null
  onClose: () => void
  onSaved: (p: Product) => void
}) {
  const [form, setForm] = useState(initial
    ? {
        name: initial.name, type: initial.type, tagline: initial.tagline || '',
        description: initial.description || '', price: initial.price?.toString() || '',
        price_unit: initial.price_unit || 'one-time', currency: initial.currency,
        category: initial.category || '', target_audience: initial.target_audience || '',
        key_benefits: initial.key_benefits || '', status: initial.status,
      }
    : EMPTY_FORM,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k: keyof typeof EMPTY_FORM, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function save() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      const body = { ...form, price: form.price ? parseFloat(form.price) : null }
      const res = await fetch(initial ? `/api/products/${initial.id}` : '/api/products', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      onSaved({ ...data.product, lead_count: initial?.lead_count ?? 0 })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-white font-semibold">{initial ? 'Edit' : 'Add'} Product / Service</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          {/* Type selector */}
          <div className="grid grid-cols-2 gap-2">
            {(['service', 'product'] as const).map(t => (
              <button key={t} onClick={() => set('type', t)}
                className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  form.type === t
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}>
                {t === 'service' ? '⚙️ Service' : '🛍️ Product'}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder={form.type === 'service' ? 'e.g. Website Design' : 'e.g. Marketing Course'}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-600" />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">One-line tagline</label>
            <input value={form.tagline} onChange={e => set('tagline', e.target.value)}
              placeholder="e.g. Professional websites delivered in 5 days"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-600" />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
              placeholder="What exactly does this product/service include? What problem does it solve?"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-600 resize-none" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Price</label>
              <input value={form.price} onChange={e => set('price', e.target.value)}
                type="number" min="0" placeholder="0"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-600" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Unit</label>
              <select value={form.price_unit} onChange={e => set('price_unit', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors">
                {PRICE_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Currency</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors">
                {['USD','EUR','GBP','BDT','INR','AUD','CAD'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Target Market <span className="text-slate-600">(who + where)</span></label>
            <input value={form.target_audience} onChange={e => set('target_audience', e.target.value)}
              placeholder="e.g. SMB owners in USA & UK, E-commerce stores in South Asia"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-600" />
            <p className="text-slate-600 text-[10px] mt-1">Used by AI to generate targeted content and campaigns for this product</p>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Key Benefits <span className="text-slate-600">(one per line)</span></label>
            <textarea value={form.key_benefits} onChange={e => set('key_benefits', e.target.value)} rows={3}
              placeholder={'Fast delivery\n24/7 support\nMoney-back guarantee'}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-600 resize-none font-mono" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Category</label>
              <input value={form.category} onChange={e => set('category', e.target.value)}
                placeholder="e.g. Design, Marketing, Consulting"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-600" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value as typeof form.status)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors">
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [generatingSignals, setGeneratingSignals] = useState<string | null>(null)
  const [signalMsg, setSignalMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)
  const [redditPanel, setRedditPanel] = useState<{
    productId: string; productName: string; leads: RedditLead[]; loading: boolean
  } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .finally(() => setLoading(false))
  }, [])

  async function fetchRedditLeads(productId: string, productName: string) {
    setRedditPanel({ productId, productName, leads: [], loading: true })
    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    try {
      const res = await fetch('/api/reddit/product-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      })
      const data = await res.json()
      setRedditPanel(prev => prev ? { ...prev, leads: data.leads ?? [], loading: false } : null)
    } catch {
      setRedditPanel(prev => prev ? { ...prev, loading: false } : null)
    }
  }

  function onSaved(p: Product) {
    setProducts(prev => {
      const idx = prev.findIndex(x => x.id === p.id)
      if (idx >= 0) return prev.map(x => x.id === p.id ? p : x)
      // New product — trigger Reddit leads
      fetchRedditLeads(p.id, p.name)
      return [p, ...prev]
    })
  }

  async function deleteProduct(id: string) {
    if (!confirm('Delete this product/service?')) return
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  async function generateSignals(id: string) {
    setGeneratingSignals(id)
    setSignalMsg(null)
    try {
      const res = await fetch(`/api/products/${id}/signals`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && (data.count > 0 || data.signals?.length > 0)) {
        const n = data.count ?? data.signals?.length ?? 0
        const saved = data.db_saved ?? data.signals?.length ?? n
        setSignalMsg({ id, text: `✓ ${n} signal${n !== 1 ? 's' : ''} generated${saved > 0 ? ' & added to Agent Inbox' : ' (view in Agent Reports)'}`, ok: true })
      } else {
        setSignalMsg({ id, text: data.error || 'Analysis failed — check business setup', ok: false })
      }
    } finally {
      setGeneratingSignals(null)
      setTimeout(() => setSignalMsg(null), 5000)
    }
  }

  const active   = products.filter(p => p.status === 'active')
  const services = products.filter(p => p.type === 'service')
  const prods    = products.filter(p => p.type === 'product')
  const totalLeads = products.reduce((n, p) => n + p.lead_count, 0)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <AIPageContext
        title="AI Product & Service Intelligence"
        subtitle="Add what you sell — your AI agent uses this to generate targeted content, track lead interest per product, and surface marketing opportunities daily."
        accent="violet"
        automations={[
          'Tracks how many leads are interested in each product',
          'Generates AI marketing signals per product (Agent Inbox)',
          'Creates product-specific social content on demand',
          'Identifies which products have zero leads (needs attention)',
          'Feeds product data to your daily morning brief',
        ]}
        manual={['Add your products & services', 'Update pricing and descriptions', 'Review AI-generated signals']}
      />
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Products & Services</h1>
          <p className="text-slate-400 text-sm mt-1">
            Your catalog — AI uses this for content, proposals, campaigns & daily analysis
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditProduct(null); setShowModal(true) }}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            + Add Product / Service
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total',        value: products.length },
          { label: 'Active',       value: active.length },
          { label: 'Services',     value: services.length },
          { label: 'Interested Leads', value: totalLeads },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-slate-500 text-sm mb-2">{s.label}</p>
            <p className="text-white text-4xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* AI context banner */}
      <div className="bg-slate-950/20 border border-slate-700/30 rounded-xl p-4 mb-8 flex items-start gap-3">
        <span className="text-blue-400 text-lg flex-shrink-0">🤖</span>
        <div>
          <p className="text-blue-300 text-sm font-medium">AI-Powered Marketing Intelligence</p>
          <p className="text-slate-400 text-xs mt-0.5">
            The AI Agent reads your products/services daily — generating content ideas, flagging underperformers,
            and suggesting campaigns. Click <strong className="text-slate-300">&ldquo;Analyze&rdquo;</strong> on any product to get instant signals in your Agent Inbox.
          </p>
        </div>
      </div>

      {/* Reddit Leads Panel — appears after adding a new product */}
      {redditPanel && (
        <div ref={panelRef} className="mb-8 bg-slate-900 border border-slate-700/40 rounded-2xl overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/20">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🎯</span>
              <div>
                <h3 className="text-white font-semibold text-sm">
                  Reddit Leads for &ldquo;{redditPanel.productName}&rdquo;
                </h3>
                <p className="text-slate-400 text-xs">
                  {redditPanel.loading
                    ? 'Scanning Reddit for potential customers…'
                    : redditPanel.leads.length > 0
                    ? `${redditPanel.leads.length} potential leads found across Reddit`
                    : 'No matching leads found right now — try again later'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setRedditPanel(null)}
              className="text-slate-500 hover:text-white text-lg transition-colors"
            >
              ×
            </button>
          </div>

          {/* Loading skeleton */}
          {redditPanel.loading && (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-12 h-5 bg-slate-800 rounded" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-slate-800 rounded w-3/4" />
                    <div className="h-3 bg-slate-800 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Leads list */}
          {!redditPanel.loading && redditPanel.leads.length > 0 && (
            <div className="divide-y divide-slate-800">
              {redditPanel.leads.map(lead => (
                <div key={lead.id} className="px-5 py-3.5 hover:bg-slate-800/30 transition-colors flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-slate-500 text-xs font-medium bg-slate-950/40 border border-slate-700/30 px-2 py-0.5 rounded-full">
                        r/{lead.subreddit}
                      </span>
                      <span className="text-slate-500 text-xs">▲ {lead.score}</span>
                      <span className="text-slate-500 text-xs">💬 {lead.num_comments}</span>
                      <span className="text-slate-600 text-xs">{Array(Math.min(lead.quality, 5)).fill('★').join('')}</span>
                    </div>
                    <p className="text-slate-200 text-sm leading-snug line-clamp-2">{lead.title}</p>
                    <p className="text-slate-600 text-xs mt-0.5">u/{lead.author}</p>
                  </div>
                  <a
                    href={lead.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs bg-blue-600/20 hover:bg-blue-600/40 border border-slate-700/40 text-slate-400 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                  >
                    View →
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!redditPanel.loading && redditPanel.leads.length === 0 && (
            <div className="py-10 text-center text-slate-500 text-sm">
              No leads found yet. Try scanning again from{' '}
              <a href="/settings/integrations#reddit" className="text-slate-500 hover:underline">
                Integrations → Reddit
              </a>
            </div>
          )}

          {/* Footer hint */}
          {!redditPanel.loading && redditPanel.leads.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between">
              <p className="text-slate-600 text-xs">Click &ldquo;View →&rdquo; to open the thread and engage with the potential customer</p>
              <button
                onClick={() => fetchRedditLeads(redditPanel.productId, redditPanel.productName)}
                className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
              >
                ↻ Refresh
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-56 bg-slate-900 rounded-2xl animate-pulse" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-24 text-center">
          <div className="text-5xl mb-4">🛍️</div>
          <h2 className="text-white font-semibold text-lg mb-2">No products or services yet</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
            Add your offerings so the AI can create targeted content, proposals, and campaigns for each one.
          </p>
          <button
            onClick={() => { setEditProduct(null); setShowModal(true) }}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-6 py-3 rounded-xl transition-colors"
          >
            Add First Product / Service
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => (
            <div key={p.id}
              className={`bg-slate-900 border rounded-2xl p-5 flex flex-col group transition-colors hover:border-slate-700 ${
                p.status === 'discontinued' ? 'border-slate-800/50 opacity-60' : 'border-slate-800'
              }`}>
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="text-2xl">{p.type === 'service' ? '⚙️' : '🛍️'}</div>
                <div className="flex gap-1.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TYPE_STYLE[p.type]}`}>
                    {p.type}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[p.status]}`}>
                    {p.status}
                  </span>
                </div>
              </div>

              {/* Content */}
              <h3 className="text-white font-semibold text-base mb-1">{p.name}</h3>
              {p.tagline && <p className="text-slate-400 text-sm mb-2 leading-snug">{p.tagline}</p>}
              {p.target_audience && (
                <p className="text-slate-600 text-xs mb-3">🎯 {p.target_audience}</p>
              )}

              {/* Price */}
              {p.price !== null && (
                <div className="mb-3">
                  <span className="text-white font-bold text-lg">
                    {p.currency} {p.price.toLocaleString()}
                  </span>
                  <span className="text-slate-500 text-xs ml-1">
                    {PRICE_UNITS.find(u => u.value === p.price_unit)?.label || p.price_unit}
                  </span>
                </div>
              )}

              {/* Lead count */}
              <div className="mt-auto pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className={`text-sm font-medium ${p.lead_count > 0 ? 'text-blue-400' : 'text-slate-600'}`}>
                  👤 {p.lead_count} lead{p.lead_count !== 1 ? 's' : ''}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => generateSignals(p.id)}
                    disabled={generatingSignals === p.id}
                    title="Analyze — add AI signals to Agent Inbox"
                    className="text-xs bg-blue-600/20 hover:bg-blue-600/40 border border-slate-700/40 text-blue-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {generatingSignals === p.id ? '…' : '🤖 Analyze'}
                  </button>
                  <button
                    onClick={() => router.push(`/content?product=${encodeURIComponent(p.name)}&topic=${encodeURIComponent(p.tagline || p.name)}`)}
                    title="Create content for this product"
                    className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    ✍️ Content
                  </button>
                  <button
                    onClick={() => { setEditProduct(p); setShowModal(true) }}
                    className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteProduct(p.id)}
                    className="text-xs text-slate-600 hover:text-red-400 px-2 py-1.5 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Signal message */}
              {signalMsg?.id === p.id && (
                <p className={`text-xs mt-2 font-medium ${signalMsg.ok ? 'text-blue-400' : 'text-red-400'}`}>
                  {signalMsg.text}
                </p>
              )}
            </div>
          ))}

          {/* Add card */}
          <button
            onClick={() => { setEditProduct(null); setShowModal(true) }}
            className="border-2 border-dashed border-slate-800 hover:border-slate-700/50 rounded-2xl p-5 text-slate-600 hover:text-blue-400 transition-colors flex flex-col items-center justify-center gap-3 min-h-[200px]"
          >
            <span className="text-3xl">+</span>
            <span className="text-sm font-medium">Add Product / Service</span>
          </button>
        </div>
      )}

      {/* Prods vs Services summary */}
      {products.length > 0 && (
        <div className="mt-8 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-slate-400 text-sm font-medium mb-3">Breakdown</p>
          <div className="flex flex-wrap gap-3">
            {[
              { label: `${services.length} Services`, color: 'text-blue-400' },
              { label: `${prods.length} Products`, color: 'text-blue-400' },
              { label: `${active.length} Active`, color: 'text-blue-400' },
              { label: `${products.filter(p => p.status === 'draft').length} Drafts`, color: 'text-slate-500' },
            ].map(b => (
              <span key={b.label} className={`text-sm font-medium ${b.color}`}>{b.label}</span>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <ProductModal
          initial={editProduct}
          onClose={() => { setShowModal(false); setEditProduct(null) }}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
