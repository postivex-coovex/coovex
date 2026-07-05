'use client'

import { useState } from 'react'
import { Zap, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'

const TYPE_OPTS = [
  { value: 'bonus',           label: '🎁 Bonus' },
  { value: 'purchase',        label: '💳 Purchase' },
  { value: 'refund',          label: '↩️ Refund' },
  { value: 'monthly_refresh', label: '🔄 Monthly refresh' },
  { value: 'deduct',          label: '➖ Deduct' },
]

interface Props {
  workspaceId: string
  balance: number
  monthly: number
  plan: string
  resetAt: string | null
}

export function AdminCreditPanel({ workspaceId, balance: initBalance, monthly: initMonthly, plan, resetAt }: Props) {
  const [balance, setBalance] = useState(initBalance)
  const [monthly, setMonthly] = useState(initMonthly)
  const [adjAmount, setAdjAmount] = useState('')
  const [adjType, setAdjType] = useState('bonus')
  const [adjNote, setAdjNote] = useState('')
  const [newMonthly, setNewMonthly] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const pct = Math.min(100, Math.round((balance / Math.max(monthly, 1)) * 100))
  const barColor = pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500'

  async function handleAdjust() {
    if (!adjAmount) return
    setSaving(true)
    setMsg(null)
    const res = await fetch('/api/admin/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, amount: Number(adjAmount), type: adjType, description: adjNote || undefined }),
    }).then(r => r.json())
    setSaving(false)
    if (res.ok) {
      setBalance(res.balance)
      setMsg({ ok: true, text: `Done. New balance: ${res.balance?.toLocaleString()}` })
      setAdjAmount('')
      setAdjNote('')
    } else {
      setMsg({ ok: false, text: res.error ?? 'Error' })
    }
  }

  async function handleMonthly() {
    if (!newMonthly) return
    setSaving(true)
    setMsg(null)
    const res = await fetch('/api/admin/credits', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, monthly: Number(newMonthly) }),
    }).then(r => r.json())
    setSaving(false)
    if (res.ok) {
      setMonthly(Number(newMonthly))
      setMsg({ ok: true, text: 'Monthly allowance updated.' })
      setNewMonthly('')
    } else {
      setMsg({ ok: false, text: res.error ?? 'Error' })
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4 flex items-center gap-2">
        <Zap className="w-3.5 h-3.5" /> AI Credits
      </h2>

      {/* Balance */}
      <div className="flex items-end justify-between mb-1">
        <div>
          <span className={`text-2xl font-bold ${balance <= 0 ? 'text-red-400' : balance < 50 ? 'text-amber-400' : 'text-white'}`}>
            {balance.toLocaleString()}
          </span>
          <span className="text-slate-500 text-xs ml-1">/ {monthly.toLocaleString()} mo</span>
        </div>
        <span className="text-slate-500 text-xs">{pct}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5 mb-4">
        <div className={`h-1.5 rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {resetAt && (
        <p className="text-slate-600 text-xs mb-4">Resets {new Date(resetAt).toLocaleDateString()}</p>
      )}

      {msg && (
        <div className={`mb-3 p-2.5 rounded-lg text-xs font-medium ${msg.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      {/* Adjust */}
      <div className="space-y-2 mb-4">
        <select value={adjType} onChange={e => setAdjType(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-violet-600">
          {TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex gap-2">
          <input type="number" min="1" value={adjAmount} onChange={e => setAdjAmount(e.target.value)}
            placeholder="Amount"
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-violet-600 placeholder:text-slate-600" />
          <input value={adjNote} onChange={e => setAdjNote(e.target.value)}
            placeholder="Note"
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-violet-600 placeholder:text-slate-600" />
        </div>
        <button onClick={handleAdjust} disabled={saving || !adjAmount}
          className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 ${adjType === 'deduct' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white'}`}>
          {saving
            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            : adjType === 'deduct' ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />
          }
          {adjType === 'deduct' ? 'Deduct' : 'Add'} Credits
        </button>
      </div>

      {/* Monthly */}
      <div className="pt-3 border-t border-slate-800">
        <p className="text-slate-500 text-xs mb-2">Change monthly allowance</p>
        <div className="flex gap-2">
          <input type="number" min="0" value={newMonthly} onChange={e => setNewMonthly(e.target.value)}
            placeholder={`${monthly}`}
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-violet-600" />
          <button onClick={handleMonthly} disabled={saving || !newMonthly}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
            Set
          </button>
        </div>
      </div>
    </div>
  )
}
