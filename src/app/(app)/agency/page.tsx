'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Users, TrendingUp, AlertTriangle, Zap, ArrowRightLeft, Plus, RefreshCw, Building2 } from 'lucide-react'

interface ClientData {
  workspace_id:  string
  business_id:   string
  name:          string
  industry:      string
  health_score:  number
  website_url:   string | null
  role:          string
  is_current:    boolean
  metrics: {
    leads:    number
    won:      number
    win_rate: number
    signals:  number
    urgent:   number
  }
}

const INDUSTRIES = [
  'Technology', 'Marketing & Advertising', 'Consulting', 'E-commerce', 'Health & Wellness',
  'Education', 'Finance', 'Real Estate', 'Food & Beverage', 'Retail', 'Legal',
  'Construction', 'Design & Creative', 'Fitness', 'Travel & Hospitality', 'Other',
]

function healthColor(score: number) {
  if (score >= 80) return {
    text: 'text-emerald-400', bg: 'bg-emerald-500',
    badge: 'bg-emerald-900/40 text-emerald-300 border-emerald-800/40', label: 'Excellent',
    bar: 'from-emerald-600 to-emerald-400',
  }
  if (score >= 65) return {
    text: 'text-amber-400', bg: 'bg-amber-500',
    badge: 'bg-amber-900/40 text-amber-300 border-amber-800/40', label: 'Good',
    bar: 'from-amber-600 to-amber-400',
  }
  return {
    text: 'text-red-400', bg: 'bg-red-500',
    badge: 'bg-red-900/40 text-red-300 border-red-800/40', label: 'At Risk',
    bar: 'from-red-600 to-red-500',
  }
}

function AddClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const router = useRouter()
  const [form, setForm] = useState({ business_name: '', industry: '', website_url: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [andSwitch, setAndSwitch] = useState(false)

  async function submit() {
    if (!form.business_name.trim() || !form.industry) { setErr('Name and industry required'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Failed'); return }
      onCreated()
      onClose()
      if (andSwitch) router.push('/dashboard')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold">Add Client / Business</h2>
            <p className="text-slate-500 text-xs">Creates a new workspace you can manage</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Business Name *</label>
            <input
              autoFocus
              value={form.business_name}
              onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
              placeholder="e.g. Acme Marketing Co."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Industry *</label>
            <select
              value={form.industry}
              onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors appearance-none"
            >
              <option value="">Select industry…</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Website URL <span className="text-slate-600">(optional)</span></label>
            <input
              value={form.website_url}
              onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))}
              placeholder="https://example.com"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer mt-1">
            <div
              onClick={() => setAndSwitch(s => !s)}
              className={`w-8 h-4.5 rounded-full border transition-colors relative flex items-center px-0.5 ${andSwitch ? 'bg-violet-600 border-violet-500' : 'bg-slate-700 border-slate-600'}`}
            >
              <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${andSwitch ? 'translate-x-3.5' : 'translate-x-0'}`} />
            </div>
            <span className="text-slate-400 text-sm">Switch to this client after creating</span>
          </label>

          {err && <p className="text-red-400 text-xs">{err}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 py-2.5 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Creating…' : 'Add Client'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AgencyPage() {
  const router = useRouter()
  const [clients, setClients] = useState<ClientData[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'at_risk' | 'excellent'>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'name' | 'health' | 'leads' | 'signals'>('health')
  const [showAdd, setShowAdd] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function loadClients() {
    setLoading(true)
    fetch('/api/agency/clients')
      .then(r => r.json())
      .then(d => setClients(d.clients ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadClients() }, [])

  async function switchToClient(workspace_id: string) {
    setSwitching(workspace_id)
    try {
      await fetch('/api/workspaces/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id }),
      })
      startTransition(() => {
        router.refresh()
        router.push('/dashboard')
      })
    } finally {
      setSwitching(null)
    }
  }

  const filtered = clients
    .filter(c => {
      if (filter === 'at_risk')   return c.health_score < 65
      if (filter === 'excellent') return c.health_score >= 80
      return true
    })
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.industry.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'name')    return a.name.localeCompare(b.name)
      if (sort === 'health')  return b.health_score - a.health_score
      if (sort === 'leads')   return b.metrics.leads - a.metrics.leads
      if (sort === 'signals') return b.metrics.urgent - a.metrics.urgent
      return 0
    })

  const avgHealth      = clients.length ? Math.round(clients.reduce((s, c) => s + c.health_score, 0) / clients.length) : 0
  const atRiskCount    = clients.filter(c => c.health_score < 65).length
  const totalLeads     = clients.reduce((s, c) => s + c.metrics.leads, 0)
  const urgentTotal    = clients.reduce((s, c) => s + c.metrics.urgent, 0)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Agency Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {clients.length > 0
              ? `Managing ${clients.length} client workspace${clients.length !== 1 ? 's' : ''}`
              : 'Add your first client to get started'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadClients}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-800"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Client
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Clients',    value: clients.length, icon: Users,          sub: 'managed workspaces', color: 'text-white' },
          { label: 'Avg Health Score', value: avgHealth,       icon: TrendingUp,     sub: 'across all clients', color: avgHealth >= 75 ? 'text-emerald-400' : avgHealth >= 60 ? 'text-amber-400' : 'text-red-400' },
          { label: 'Clients At Risk',  value: atRiskCount,     icon: AlertTriangle,  sub: 'health below 65',    color: atRiskCount > 0 ? 'text-red-400' : 'text-slate-400' },
          { label: 'Urgent Signals',   value: urgentTotal,     icon: Zap,            sub: 'need your attention', color: urgentTotal > 0 ? 'text-amber-400' : 'text-slate-400' },
        ].map(k => (
          <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <k.icon className="w-4 h-4 text-slate-600 mb-2" />
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-slate-400 text-xs mt-0.5 font-medium">{k.label}</p>
            <p className="text-slate-600 text-[10px]">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search clients…"
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors w-48"
        />
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          {([
            { value: 'all',       label: 'All' },
            { value: 'excellent', label: '✓ Excellent' },
            { value: 'at_risk',   label: '⚠ At Risk' },
          ] as const).map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${filter === f.value ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as typeof sort)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none ml-auto appearance-none"
        >
          <option value="health">Sort: Health</option>
          <option value="signals">Sort: Signals</option>
          <option value="leads">Sort: Leads</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      {/* Empty state */}
      {!loading && clients.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 text-center">
          <div className="text-5xl mb-4">🏢</div>
          <h2 className="text-white font-semibold mb-2">No clients yet</h2>
          <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
            Add your first client workspace to start managing multiple businesses from one place.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
          >
            + Add First Client
          </button>
        </div>
      )}

      {/* Client grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-56 bg-slate-900 rounded-2xl animate-pulse border border-slate-800" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(client => {
            const hc = healthColor(client.health_score)
            const isSwitching = switching === client.workspace_id

            return (
              <div
                key={client.workspace_id}
                className={`relative bg-slate-900 border rounded-2xl p-5 transition-all ${
                  client.is_current
                    ? 'border-violet-500/40 ring-1 ring-violet-500/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
                    {client.name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {client.is_current && (
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" title="Currently active" />
                      )}
                      <h3 className="text-white font-semibold text-sm leading-tight truncate">{client.name}</h3>
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">{client.industry}</p>
                  </div>
                  <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${hc.badge}`}>{hc.label}</span>
                </div>

                {/* Health bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-500">Health Score</span>
                    <span className={`${hc.text} font-bold`}>{client.health_score}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${hc.bar} transition-all duration-700`}
                      style={{ width: `${client.health_score}%` }}
                    />
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center mb-4">
                  <div className="bg-slate-800/60 rounded-lg py-2">
                    <p className="text-white text-base font-bold leading-tight">{client.metrics.leads}</p>
                    <p className="text-slate-600 text-[10px] mt-0.5">leads</p>
                  </div>
                  <div className="bg-slate-800/60 rounded-lg py-2">
                    <p className="text-white text-base font-bold leading-tight">{client.metrics.win_rate}%</p>
                    <p className="text-slate-600 text-[10px] mt-0.5">win rate</p>
                  </div>
                  <div className={`rounded-lg py-2 ${client.metrics.urgent > 0 ? 'bg-amber-900/20' : 'bg-slate-800/60'}`}>
                    <p className={`text-base font-bold leading-tight ${client.metrics.urgent > 0 ? 'text-amber-400' : 'text-white'}`}>
                      {client.metrics.signals}
                    </p>
                    <p className="text-slate-600 text-[10px] mt-0.5">signals</p>
                  </div>
                </div>

                {/* Urgent alert */}
                {client.metrics.urgent > 0 && (
                  <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-800/30 rounded-lg px-3 py-2 mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                    <p className="text-amber-300 text-xs font-medium">
                      {client.metrics.urgent} urgent signal{client.metrics.urgent !== 1 ? 's' : ''} need attention
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {client.is_current ? (
                    <a
                      href="/dashboard"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-violet-600/15 hover:bg-violet-600/25 text-violet-300 text-xs font-medium rounded-lg transition-colors border border-violet-500/30"
                    >
                      View Dashboard →
                    </a>
                  ) : (
                    <button
                      onClick={() => switchToClient(client.workspace_id)}
                      disabled={!!switching}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition-colors border border-slate-700"
                    >
                      {isSwitching ? (
                        <><span className="w-3 h-3 border border-slate-500 border-t-white rounded-full animate-spin" /> Switching…</>
                      ) : (
                        <><ArrowRightLeft className="w-3 h-3" /> Switch to Client</>
                      )}
                    </button>
                  )}
                  <div className="flex items-center justify-center w-9 h-8 bg-slate-800 border border-slate-700 rounded-lg text-slate-500 text-xs font-medium">
                    {client.role === 'owner' ? '👑' : client.role === 'admin' ? '🔑' : '👤'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* No results */}
      {!loading && clients.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-slate-500 text-sm">
          No clients match your filter. <button onClick={() => { setFilter('all'); setSearch('') }} className="text-violet-400 hover:text-violet-300">Clear filters →</button>
        </div>
      )}

      {showAdd && (
        <AddClientModal
          onClose={() => setShowAdd(false)}
          onCreated={loadClients}
        />
      )}
    </div>
  )
}
