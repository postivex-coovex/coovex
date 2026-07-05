'use client'

import { useState, useEffect } from 'react'
import { Plus, Star, Edit2, Trash2, Check, X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SoftwareItem {
  id: string
  name: string
  slug: string
  category: string
  tagline: string | null
  description: string | null
  website: string | null
  pricing_model: string
  price_from: number
  rating: number
  is_coovex_pick: boolean
  active: boolean
  sort_order: number
  created_at: string
}

const EMPTY_FORM: Partial<SoftwareItem> = {
  name: '', slug: '', category: 'crm', tagline: '', description: '',
  website: '', pricing_model: 'paid', price_from: 0,
  rating: 4.0, is_coovex_pick: false, active: true, sort_order: 0,
}

const CATEGORIES = [
  'crm', 'email_marketing', 'project_management', 'accounting', 'analytics',
  'customer_support', 'social_media', 'hr_payroll', 'communication',
  'ecommerce', 'automation', 'ai_tools',
]

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminSoftwarePage() {
  const [software, setSoftware] = useState<SoftwareItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<SoftwareItem | null>(null)
  const [form, setForm] = useState<Partial<SoftwareItem>>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [filterCategory, setFilterCategory] = useState('all')

  useEffect(() => {
    fetchSoftware()
  }, [])

  const fetchSoftware = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/software')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSoftware(data.software ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const openAdd = () => {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (item: SoftwareItem) => {
    setEditItem(item)
    setForm({ ...item })
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const method = editItem ? 'PUT' : 'POST'
      const body = editItem ? { ...form, id: editItem.id } : form
      const res = await fetch('/api/admin/software', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await fetchSoftware()
      setShowModal(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePick = async (item: SoftwareItem) => {
    await fetch('/api/admin/software', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, is_coovex_pick: !item.is_coovex_pick }),
    })
    setSoftware(prev => prev.map(s => s.id === item.id ? { ...s, is_coovex_pick: !s.is_coovex_pick } : s))
  }

  const handleToggleActive = async (item: SoftwareItem) => {
    await fetch('/api/admin/software', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, active: !item.active }),
    })
    setSoftware(prev => prev.map(s => s.id === item.id ? { ...s, active: !s.active } : s))
  }

  const handleDelete = async (item: SoftwareItem) => {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    await fetch('/api/admin/software', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id }),
    })
    setSoftware(prev => prev.filter(s => s.id !== item.id))
  }

  const filtered = filterCategory === 'all' ? software : software.filter(s => s.category === filterCategory)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Software Hub</h1>
          <p className="text-slate-400 text-sm mt-1">{software.length} tools in catalog</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Software
        </button>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">{error}</div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap mb-5">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterCategory === 'all' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
        >
          All ({software.length})
        </button>
        {CATEGORIES.map(cat => {
          const count = software.filter(s => s.category === cat).length
          if (!count) return null
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterCategory === cat ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            >
              {cat.replace(/_/g, ' ')} ({count})
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm py-10 text-center">Loading...</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-left font-medium">Pricing</th>
                <th className="px-4 py-3 text-center font-medium">Pick</th>
                <th className="px-4 py-3 text-center font-medium">Active</th>
                <th className="px-4 py-3 text-center font-medium">Rating</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={item.id} className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors ${!item.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-white font-medium">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.tagline}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-400 capitalize">{item.category.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-300 capitalize">{item.pricing_model}</span>
                    {item.price_from > 0 && <span className="text-xs text-slate-500 ml-1">${(item.price_from / 100).toFixed(0)}/mo</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleTogglePick(item)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-colors ${
                        item.is_coovex_pick ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-600 hover:text-amber-400'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${item.is_coovex_pick ? 'fill-amber-400' : ''}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleActive(item)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-colors ${
                        item.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-600'
                      }`}
                    >
                      {item.active ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs text-slate-300">{item.rating}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-8">No software found.</p>
          )}
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-white">{editItem ? 'Edit Software' : 'Add Software'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Name *</label>
                  <input
                    value={form.name ?? ''}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Slug *</label>
                  <input
                    value={form.slug ?? ''}
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Category *</label>
                <select
                  value={form.category ?? 'crm'}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Tagline</label>
                <input
                  value={form.tagline ?? ''}
                  onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Description</label>
                <textarea
                  value={form.description ?? ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Website URL</label>
                <input
                  value={form.website ?? ''}
                  onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Pricing Model</label>
                  <select
                    value={form.pricing_model ?? 'paid'}
                    onChange={e => setForm(f => ({ ...f, pricing_model: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="free">Free</option>
                    <option value="freemium">Freemium</option>
                    <option value="paid">Paid</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Price From (cents/mo)</label>
                  <input
                    type="number"
                    value={form.price_from ?? 0}
                    onChange={e => setForm(f => ({ ...f, price_from: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Rating (0-5)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={form.rating ?? 4.0}
                    onChange={e => setForm(f => ({ ...f, rating: parseFloat(e.target.value) || 4.0 }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={form.sort_order ?? 0}
                    onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_coovex_pick ?? false}
                    onChange={e => setForm(f => ({ ...f, is_coovex_pick: e.target.checked }))}
                    className="w-4 h-4 rounded accent-violet-500"
                  />
                  <span className="text-sm text-slate-300">CooVex Pick</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.active ?? true}
                    onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                    className="w-4 h-4 rounded accent-violet-500"
                  />
                  <span className="text-sm text-slate-300">Active</span>
                </label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-800 flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.slug || !form.category}
                className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                {saving ? 'Saving...' : editItem ? 'Update' : 'Add Software'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
