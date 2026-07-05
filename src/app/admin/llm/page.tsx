'use client'

import { useEffect, useState } from 'react'

interface LLMConfig {
  id: string
  provider: string
  model_default: string
  enabled: boolean
  priority: number
  features: string[]
  notes: string | null
  updated_at: string
}

const PROVIDER_META: Record<string, { label: string; icon: string; color: string }> = {
  claude:  { label: 'Anthropic Claude',  icon: '🧠', color: 'text-violet-400' },
  haiku:   { label: 'Claude Haiku',      icon: '⚡', color: 'text-blue-400' },
  openai:  { label: 'OpenAI GPT',        icon: '🟢', color: 'text-emerald-400' },
  gemini:  { label: 'Google Gemini',     icon: '💎', color: 'text-cyan-400' },
  groq:    { label: 'Groq',              icon: '🔥', color: 'text-amber-400' },
  mistral: { label: 'Mistral',           icon: '🌀', color: 'text-indigo-400' },
}

const ALL_PROVIDERS = [
  { provider: 'claude',  model: 'claude-sonnet-4-6',          note: 'Primary — agent reasoning, audits, coach, content' },
  { provider: 'haiku',   model: 'claude-haiku-4-5-20251001',  note: 'Fast tasks — lead scoring, brief, summaries' },
  { provider: 'openai',  model: 'gpt-4o',                     note: 'Not currently active' },
  { provider: 'gemini',  model: 'gemini-1.5-pro',             note: 'Not currently active' },
  { provider: 'groq',    model: 'llama-3.1-70b-versatile',    note: 'Not currently active' },
  { provider: 'mistral', model: 'mistral-large-latest',       note: 'Not currently active' },
]

export default function AdminLLMPage() {
  const [configs, setConfigs] = useState<LLMConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const res = await fetch('/api/admin/llm')
    const d = await res.json()
    setConfigs(d.configs || [])
    setLoading(false)
  }

  async function toggle(id: string, current: boolean) {
    setSaving(id)
    const res = await fetch('/api/admin/llm', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled: !current }),
    })
    const d = await res.json()
    if (d.error) {
      setMsg({ ok: false, text: d.error })
    } else {
      setConfigs(prev => prev.map(c => c.id === id ? { ...c, enabled: !current } : c))
      setMsg({ ok: true, text: `Provider ${!current ? 'enabled' : 'disabled'}` })
    }
    setSaving(null)
    setTimeout(() => setMsg(null), 3000)
  }

  const configMap = Object.fromEntries(configs.map(c => [c.provider, c]))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">LLM Management</h1>
        <p className="text-slate-400 text-sm">Configure which AI providers are active across the platform</p>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.ok ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900' : 'bg-red-950/50 text-red-400 border border-red-900'}`}>
          {msg.text}
        </div>
      )}

      {/* Current usage */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
        <h2 className="text-white font-semibold text-sm mb-2">Active Configuration</h2>
        <p className="text-slate-500 text-xs mb-4">These models are currently in use by CooVex</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { use: 'Agent / Coach', model: 'claude-sonnet-4-6', provider: 'Anthropic' },
            { use: 'Content Generation', model: 'claude-haiku-4-5-20251001', provider: 'Anthropic' },
            { use: 'Lead Scoring', model: 'claude-haiku-4-5-20251001', provider: 'Anthropic' },
            { use: 'Daily Brief', model: 'claude-haiku-4-5-20251001', provider: 'Anthropic' },
          ].map(c => (
            <div key={c.use} className="bg-slate-800/50 rounded-lg px-4 py-3">
              <p className="text-slate-500 text-xs mb-1">{c.use}</p>
              <p className="text-violet-300 text-xs font-mono">{c.model}</p>
              <p className="text-slate-600 text-xs mt-0.5">{c.provider}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Provider grid */}
      {loading ? (
        <div className="py-10 text-center text-slate-600 text-sm">Loading…</div>
      ) : (
        <div className="space-y-3">
          {ALL_PROVIDERS.map(p => {
            const meta = PROVIDER_META[p.provider]
            const config = configMap[p.provider]
            const isEnabled = config?.enabled ?? false
            const isActive = ['claude', 'haiku'].includes(p.provider)

            return (
              <div key={p.provider} className={`bg-slate-900 border rounded-2xl p-5 ${isActive ? 'border-violet-800/50' : 'border-slate-800'}`}>
                <div className="flex items-start gap-4">
                  <span className="text-2xl flex-shrink-0">{meta?.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-semibold text-sm ${meta?.color || 'text-white'}`}>{meta?.label || p.provider}</h3>
                      {isActive && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-violet-950/60 text-violet-400 border border-violet-900/50">In Use</span>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs font-mono mb-1">{config?.model_default || p.model}</p>
                    <p className="text-slate-600 text-xs">{p.note}</p>
                    {config?.features && config.features.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {config.features.map(f => (
                          <span key={f} className="text-xs px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {config ? (
                      <button
                        onClick={() => toggle(config.id, isEnabled)}
                        disabled={saving === config.id}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          isEnabled ? 'bg-emerald-600' : 'bg-slate-700'
                        } ${saving === config.id ? 'opacity-50' : 'hover:opacity-80'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    ) : (
                      <span className="text-slate-700 text-xs">Not configured</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
