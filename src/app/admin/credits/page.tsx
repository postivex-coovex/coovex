'use client'

import { useEffect, useState, useCallback } from 'react'
import { Zap, TrendingDown, TrendingUp, RefreshCw, Search, Gift } from 'lucide-react'

interface Workspace {
  id: string
  name: string
  plan: string
  billing_status: string
  ai_credits_balance: number
  ai_credits_monthly: number
  credits_reset_at: string | null
  created_at: string
  owner_email: string | null
}

interface Tx {
  workspace_id: string
  amount: number
  type: string
  feature?: string
  description?: string
  created_at: string
}

const PLAN_COLORS: Record<string, string> = {
  starter:    'text-blue-400',
  growth:     'text-violet-400',
  scale:      'text-amber-400',
  agency:     'text-emerald-400',
  enterprise: 'text-rose-400',
}

const TYPE_OPTS = [
  { value: 'bonus',           label: '🎁 Bonus (free)' },
  { value: 'purchase',        label: '💳 Purchase' },
  { value: 'refund',          label: '↩️ Refund' },
  { value: 'monthly_refresh', label: '🔄 Monthly refresh' },
  { value: 'deduct',          label: '➖ Deduct' },
]

export default function AdminCreditsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [recentTx, setRecentTx] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Adjustment form
  const [selected, setSelected] = useState<Workspace | null>(null)
  const [adjAmount, setAdjAmount] = useState('')
  const [adjType, setAdjType] = useState('bonus')
  const [adjNote, setAdjNote] = useState('')
  const [adjMonthly, setAdjMonthly] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/credits').then(r => r.json())
    setWorkspaces(res.workspaces ?? [])
    setRecentTx(res.recentTx ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = workspaces.filter(w => {
    const q = search.toLowerCase()
    return (
      w.name?.toLowerCase().includes(q) ||
      w.plan?.includes(q) ||
      w.owner_email?.toLowerCase().includes(q)
    )
  })

  const totalBalance = workspaces.reduce((s, w) => s + (w.ai_credits_balance ?? 0), 0)
  const lowCredit   = workspaces.filter(w => w.ai_credits_balance < 50).length
  const zeroCredit  = workspaces.filter(w => w.ai_credits_balance <= 0).length

  async function handleAdjust() {
    if (!selected || !adjAmount) return
    setSaving(true)
    setMsg(null)
    const res = await fetch('/api/admin/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: selected.id,
        amount: Number(adjAmount),
        type: adjType,
        description: adjNote || undefined,
      }),
    }).then(r => r.json())
    setSaving(false)
    if (res.ok) {
      setMsg({ ok: true, text: `Done. New balance: ${res.balance?.toLocaleString()} credits` })
      setAdjAmount('')
      setAdjNote('')
      load()
    } else {
      setMsg({ ok: false, text: res.error ?? 'Error' })
    }
  }

  async function handleMonthly() {
    if (!selected || !adjMonthly) return
    setSaving(true)
    setMsg(null)
    const res = await fetch('/api/admin/credits', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: selected.id, monthly: Number(adjMonthly) }),
    }).then(r => r.json())
    setSaving(false)
    if (res.ok) {
      setMsg({ ok: true, text: 'Monthly allowance updated.' })
      setAdjMonthly('')
      load()
    } else {
      setMsg({ ok: false, text: res.error ?? 'Error' })
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Credit Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">View balances, manually adjust credits, and set monthly allowances.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-700 transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total workspaces', value: workspaces.length, icon: Zap, color: 'text-blue-400' },
          { label: 'Total credits held', value: totalBalance.toLocaleString(), icon: Zap, color: 'text-violet-400' },
          { label: 'Low balance (<50)', value: lowCredit, icon: TrendingDown, color: 'text-amber-400' },
          { label: 'Zero credits', value: zeroCredit, icon: TrendingDown, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workspace list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, or plan..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-violet-600"
            />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-slate-500 text-xs font-semibold uppercase">Workspace</th>
                  <th className="text-left px-4 py-3 text-slate-500 text-xs font-semibold uppercase">Plan</th>
                  <th className="text-right px-4 py-3 text-slate-500 text-xs font-semibold uppercase">Balance</th>
                  <th className="text-right px-4 py-3 text-slate-500 text-xs font-semibold uppercase">Monthly</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-600">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-600">No workspaces found</td></tr>
                ) : filtered.map(w => {
                  const pct = Math.min(100, Math.round((w.ai_credits_balance / Math.max(w.ai_credits_monthly, 1)) * 100))
                  const barColor = pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500'
                  return (
                    <tr key={w.id}
                      onClick={() => { setSelected(w); setMsg(null); setAdjAmount(''); setAdjMonthly(String(w.ai_credits_monthly)) }}
                      className={`cursor-pointer transition-colors hover:bg-slate-800/50 ${selected?.id === w.id ? 'bg-slate-800/70' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <p className="text-slate-200 font-medium truncate max-w-[160px]">{w.name}</p>
                        <p className="text-slate-500 text-xs truncate max-w-[160px]">{w.owner_email ?? w.id.slice(0,8)+'…'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold capitalize ${PLAN_COLORS[w.plan] ?? 'text-slate-400'}`}>{w.plan}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className={`font-bold ${w.ai_credits_balance <= 0 ? 'text-red-400' : w.ai_credits_balance < 50 ? 'text-amber-400' : 'text-white'}`}>
                          {(w.ai_credits_balance ?? 0).toLocaleString()}
                        </p>
                        <div className="w-16 bg-slate-700 rounded-full h-1 mt-1 ml-auto">
                          <div className={`h-1 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400 text-xs">{(w.ai_credits_monthly ?? 0).toLocaleString()}/mo</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-violet-400 text-xs hover:text-violet-300">Manage →</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Adjustment panel */}
          {selected ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold text-sm">{selected.name}</h2>
                <button onClick={() => setSelected(null)} className="text-slate-600 hover:text-slate-400 text-xs">✕</button>
              </div>

              <div className="space-y-1.5 text-xs mb-5 p-3 bg-slate-800 rounded-xl">
                {selected.owner_email && (
                  <div className="flex justify-between gap-2"><span className="text-slate-500 shrink-0">User</span><span className="text-slate-300 truncate text-right">{selected.owner_email}</span></div>
                )}
                <div className="flex justify-between"><span className="text-slate-500">Plan</span><span className={`capitalize font-semibold ${PLAN_COLORS[selected.plan] ?? 'text-slate-300'}`}>{selected.plan}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Balance</span><span className="text-white font-bold">{selected.ai_credits_balance?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Monthly</span><span className="text-slate-300">{selected.ai_credits_monthly?.toLocaleString()}/mo</span></div>
                {selected.credits_reset_at && (
                  <div className="flex justify-between"><span className="text-slate-500">Resets</span><span className="text-slate-300">{new Date(selected.credits_reset_at).toLocaleDateString()}</span></div>
                )}
              </div>

              {msg && (
                <div className={`mb-4 p-3 rounded-lg text-xs font-medium ${msg.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {msg.text}
                </div>
              )}

              {/* Add/Deduct credits */}
              <div className="mb-4">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Adjust Credits</p>
                <select value={adjType} onChange={e => setAdjType(e.target.value)}
                  className="w-full mb-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-violet-600">
                  {TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input
                  type="number" min="1" value={adjAmount}
                  onChange={e => setAdjAmount(e.target.value)}
                  placeholder="Amount (credits)"
                  className="w-full mb-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-violet-600 placeholder:text-slate-600"
                />
                <input
                  value={adjNote} onChange={e => setAdjNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="w-full mb-3 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-violet-600 placeholder:text-slate-600"
                />
                <button
                  onClick={handleAdjust} disabled={saving || !adjAmount}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${adjType === 'deduct' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white'} disabled:opacity-50`}
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : adjType === 'deduct' ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                  {adjType === 'deduct' ? 'Deduct Credits' : 'Add Credits'}
                </button>
              </div>

              {/* Update monthly allowance */}
              <div className="pt-4 border-t border-slate-800">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Monthly Allowance</p>
                <input
                  type="number" min="0" value={adjMonthly}
                  onChange={e => setAdjMonthly(e.target.value)}
                  placeholder="Monthly credits"
                  className="w-full mb-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-violet-600"
                />
                <button
                  onClick={handleMonthly} disabled={saving || !adjMonthly}
                  className="w-full py-2 rounded-xl text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-white transition-colors disabled:opacity-50"
                >
                  Update Monthly Limit
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
              <Gift className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Select a workspace to manage its credits</p>
            </div>
          )}

          {/* Recent transactions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold text-sm mb-4">Recent Transactions</h3>
            {recentTx.length === 0 ? (
              <p className="text-slate-600 text-xs text-center py-4">No transactions yet</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {recentTx.map((tx, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs">
                    <span className={`mt-0.5 font-bold flex-shrink-0 w-10 text-right ${tx.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-300 truncate">{tx.description ?? tx.feature ?? tx.type}</p>
                      <p className="text-slate-600">{new Date(tx.created_at).toLocaleString()}</p>
                    </div>
                    <span className="text-slate-600 flex-shrink-0">{tx.workspace_id.slice(0,6)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
