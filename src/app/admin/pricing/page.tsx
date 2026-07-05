'use client'

import { useEffect, useState, useCallback } from 'react'
import { Save, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp, Zap, Tag } from 'lucide-react'

interface Plan {
  id: string
  key: string
  name: string
  price_monthly: number   // cents
  price_annual: number    // cents
  credits_monthly: number
  max_leads: number
  max_competitors: number
  max_team: number
  max_workspaces: number
  features: { label: string; ok: boolean }[]
  highlight: boolean
  active: boolean
  sort_order: number
}

interface CreditCost {
  id: string
  feature_key: string
  cost: number
  label: string
  tier: string
  note: string
}

const TIER_COLOR: Record<string, string> = {
  light:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  tool:   'bg-violet-500/10 text-violet-400 border-violet-500/20',
}

export default function AdminPricingPage() {
  const [plans, setPlans]   = useState<Plan[]>([])
  const [costs, setCosts]   = useState<CreditCost[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<string | null>(null)
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  // New cost form
  const [newCost, setNewCost] = useState({ feature_key: '', label: '', cost: '', tier: 'light', note: '' })
  const [addingCost, setAddingCost] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/pricing').then(r => r.json())
    setPlans(res.plans ?? [])
    setCosts(res.costs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function flash(ok: boolean, text: string) {
    setMsg({ ok, text })
    setTimeout(() => setMsg(null), 3000)
  }

  async function savePlan(plan: Plan) {
    setSaving(plan.id)
    const res = await fetch('/api/admin/pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'plan', data: plan }),
    }).then(r => r.json())
    setSaving(null)
    if (res.ok) flash(true, `${plan.name} saved`)
    else flash(false, res.error ?? 'Error')
  }

  async function saveCost(cost: CreditCost) {
    setSaving(cost.id)
    const res = await fetch('/api/admin/pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cost', data: cost }),
    }).then(r => r.json())
    setSaving(null)
    if (res.ok) flash(true, `${cost.label} saved`)
    else flash(false, res.error ?? 'Error')
  }

  async function deleteCost(id: string) {
    if (!confirm('Delete this credit cost?')) return
    const res = await fetch('/api/admin/pricing', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).then(r => r.json())
    if (res.ok) { setCosts(c => c.filter(x => x.id !== id)); flash(true, 'Deleted') }
    else flash(false, res.error ?? 'Error')
  }

  async function addCost() {
    if (!newCost.feature_key || !newCost.label || !newCost.cost) return
    setAddingCost(true)
    const res = await fetch('/api/admin/pricing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newCost, cost: Number(newCost.cost) }),
    }).then(r => r.json())
    setAddingCost(false)
    if (res.ok) {
      setCosts(c => [...c, res.data])
      setNewCost({ feature_key: '', label: '', cost: '', tier: 'light', note: '' })
      flash(true, 'Credit cost added')
    } else flash(false, res.error ?? 'Error')
  }

  function updatePlan(id: string, field: string, value: unknown) {
    setPlans(p => p.map(pl => pl.id === id ? { ...pl, [field]: value } : pl))
  }

  function updateFeature(planId: string, idx: number, field: 'label' | 'ok', value: string | boolean) {
    setPlans(p => p.map(pl => {
      if (pl.id !== planId) return pl
      const features = [...pl.features]
      features[idx] = { ...features[idx], [field]: value }
      return { ...pl, features }
    }))
  }

  function addFeature(planId: string) {
    setPlans(p => p.map(pl =>
      pl.id === planId ? { ...pl, features: [...pl.features, { label: '', ok: true }] } : pl
    ))
  }

  function removeFeature(planId: string, idx: number) {
    setPlans(p => p.map(pl =>
      pl.id === planId ? { ...pl, features: pl.features.filter((_, i) => i !== idx) } : pl
    ))
  }

  function updateCost(id: string, field: string, value: unknown) {
    setCosts(c => c.map(x => x.id === id ? { ...x, [field]: value } : x))
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pricing Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">Edit plans and credit costs — changes apply immediately site-wide.</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && (
            <span className={`text-sm font-medium px-3 py-1.5 rounded-lg ${msg.ok ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
              {msg.text}
            </span>
          )}
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-700 transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-600">Loading...</div>
      ) : (
        <>
          {/* ── Plans ── */}
          <section>
            <h2 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5 text-violet-400" /> Pricing Plans
            </h2>
            <div className="space-y-3">
              {plans.map(plan => (
                <div key={plan.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  {/* Plan header — click to expand */}
                  <button
                    onClick={() => setExpanded(expanded === plan.id ? null : plan.id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${plan.active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <span className="text-white font-semibold">{plan.name}</span>
                      {plan.highlight && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/20">Popular</span>}
                      <span className="text-slate-400 text-sm">${(plan.price_monthly / 100).toFixed(0)}/mo</span>
                      <span className="text-slate-600 text-sm">{plan.credits_monthly.toLocaleString()} credits</span>
                    </div>
                    {expanded === plan.id ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>

                  {expanded === plan.id && (
                    <div className="px-5 pb-5 border-t border-slate-800 pt-4 space-y-5">
                      {/* Basic fields */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'Name', field: 'name', type: 'text' },
                          { label: 'Price/mo (cents)', field: 'price_monthly', type: 'number' },
                          { label: 'Price/yr (cents)', field: 'price_annual', type: 'number' },
                          { label: 'Credits/month', field: 'credits_monthly', type: 'number' },
                          { label: 'Max Leads (-1=∞)', field: 'max_leads', type: 'number' },
                          { label: 'Max Competitors', field: 'max_competitors', type: 'number' },
                          { label: 'Max Team Members', field: 'max_team', type: 'number' },
                          { label: 'Max Workspaces', field: 'max_workspaces', type: 'number' },
                          { label: 'Sort Order', field: 'sort_order', type: 'number' },
                        ].map(f => (
                          <div key={f.field}>
                            <label className="text-slate-500 text-xs block mb-1">{f.label}</label>
                            <input
                              type={f.type}
                              value={(plan as unknown as Record<string, unknown>)[f.field] as string}
                              onChange={e => updatePlan(plan.id, f.field, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                            />
                          </div>
                        ))}
                        <div className="flex items-end gap-4 col-span-2">
                          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                            <input type="checkbox" checked={plan.highlight} onChange={e => updatePlan(plan.id, 'highlight', e.target.checked)}
                              className="w-4 h-4 accent-violet-500" />
                            Popular badge
                          </label>
                          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                            <input type="checkbox" checked={plan.active} onChange={e => updatePlan(plan.id, 'active', e.target.checked)}
                              className="w-4 h-4 accent-emerald-500" />
                            Active
                          </label>
                        </div>
                      </div>

                      {/* Features list */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Features</label>
                          <button onClick={() => addFeature(plan.id)}
                            className="text-xs flex items-center gap-1 text-violet-400 hover:text-violet-300">
                            <Plus className="w-3.5 h-3.5" /> Add row
                          </button>
                        </div>
                        <div className="space-y-2">
                          {plan.features.map((f, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input type="checkbox" checked={f.ok} onChange={e => updateFeature(plan.id, idx, 'ok', e.target.checked)}
                                className="w-4 h-4 accent-emerald-500 flex-shrink-0" />
                              <input
                                value={f.label}
                                onChange={e => updateFeature(plan.id, idx, 'label', e.target.value)}
                                placeholder="Feature text…"
                                className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                              />
                              <button onClick={() => removeFeature(plan.id, idx)}
                                className="text-slate-600 hover:text-red-400 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end pt-2 border-t border-slate-800">
                        <div className="text-right text-xs text-slate-600 mr-auto mt-1">
                          ${(plan.price_monthly / 100).toFixed(2)}/mo · ${(plan.price_annual / 100).toFixed(2)}/mo annual
                        </div>
                        <button
                          onClick={() => savePlan(plan)}
                          disabled={saving === plan.id}
                          className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                        >
                          {saving === plan.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save Plan
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── Credit Costs ── */}
          <section>
            <h2 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" /> Credit Costs per Feature
            </h2>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left">
                    <th className="px-4 py-3 text-slate-500 text-xs uppercase font-semibold">Feature</th>
                    <th className="px-4 py-3 text-slate-500 text-xs uppercase font-semibold">Key</th>
                    <th className="px-4 py-3 text-slate-500 text-xs uppercase font-semibold w-24">Credits</th>
                    <th className="px-4 py-3 text-slate-500 text-xs uppercase font-semibold w-28">Tier</th>
                    <th className="px-4 py-3 text-slate-500 text-xs uppercase font-semibold">Note</th>
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {costs.map(c => (
                    <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <input value={c.label} onChange={e => updateCost(c.id, 'label', e.target.value)}
                          className="w-full bg-transparent border-b border-slate-700 focus:border-violet-500 text-white text-sm py-0.5 focus:outline-none" />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-slate-500 text-xs font-mono">{c.feature_key}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <input type="number" min="1" value={c.cost}
                          onChange={e => updateCost(c.id, 'cost', Number(e.target.value))}
                          className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm text-center focus:outline-none focus:border-violet-500" />
                      </td>
                      <td className="px-4 py-2.5">
                        <select value={c.tier} onChange={e => updateCost(c.id, 'tier', e.target.value)}
                          className={`text-xs px-2 py-1 rounded-lg border focus:outline-none focus:border-violet-500 ${TIER_COLOR[c.tier] ?? 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                          <option value="light">light</option>
                          <option value="medium">medium</option>
                          <option value="tool">tool</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <input value={c.note ?? ''} onChange={e => updateCost(c.id, 'note', e.target.value)}
                          placeholder="—"
                          className="w-full bg-transparent border-b border-slate-700 focus:border-violet-500 text-slate-400 text-xs py-0.5 focus:outline-none placeholder:text-slate-700" />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => saveCost(c)} disabled={saving === c.id}
                            className="text-violet-400 hover:text-violet-300 disabled:opacity-40 transition-colors">
                            {saving === c.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          </button>
                          <button onClick={() => deleteCost(c.id)}
                            className="text-slate-600 hover:text-red-400 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Add new row */}
                  <tr className="bg-slate-800/30">
                    <td className="px-4 py-2.5">
                      <input value={newCost.label} onChange={e => setNewCost(n => ({ ...n, label: e.target.value }))}
                        placeholder="Label…"
                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500 placeholder:text-slate-600" />
                    </td>
                    <td className="px-4 py-2.5">
                      <input value={newCost.feature_key} onChange={e => setNewCost(n => ({ ...n, feature_key: e.target.value }))}
                        placeholder="feature_key"
                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-xs font-mono focus:outline-none focus:border-violet-500 placeholder:text-slate-600" />
                    </td>
                    <td className="px-4 py-2.5">
                      <input type="number" min="1" value={newCost.cost} onChange={e => setNewCost(n => ({ ...n, cost: e.target.value }))}
                        placeholder="5"
                        className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm text-center focus:outline-none focus:border-violet-500" />
                    </td>
                    <td className="px-4 py-2.5">
                      <select value={newCost.tier} onChange={e => setNewCost(n => ({ ...n, tier: e.target.value }))}
                        className="text-xs px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 focus:outline-none">
                        <option value="light">light</option>
                        <option value="medium">medium</option>
                        <option value="tool">tool</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <input value={newCost.note} onChange={e => setNewCost(n => ({ ...n, note: e.target.value }))}
                        placeholder="Note…"
                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 text-xs focus:outline-none focus:border-violet-500 placeholder:text-slate-600" />
                    </td>
                    <td className="px-4 py-2.5">
                      <button onClick={addCost} disabled={addingCost || !newCost.feature_key || !newCost.label || !newCost.cost}
                        className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                        {addingCost ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Add
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-slate-600 text-xs mt-3">
              Changes saved here apply to all AI feature credit deductions immediately. The <code className="text-slate-500">feature_key</code> must match the key used in <code className="text-slate-500">lib/credits.ts</code>.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
