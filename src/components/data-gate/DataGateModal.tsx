'use client'

import { useState } from 'react'
import Link from 'next/link'

export interface RequiredField {
  key: string
  label: string
  why: string
  prefix?: string
  suffix?: string
  placeholder: string
  inputType?: 'number' | 'text'
}

export interface DataGateConfig {
  feature: string
  description: string
  requiredFields: RequiredField[]
  onComplete: () => void
  onDismiss: () => void
}

const INTEGRATION_OPTIONS = [
  { label: 'Website Metrics API', icon: '🔌', desc: 'Push MRR, paying customers, DAU from your backend', link: '/settings/integrations#ai-context' },
  { label: 'Connect CRM', icon: '🗂️', desc: 'Sync deals & revenue from HubSpot or Pipedrive', link: '/settings/integrations' },
  { label: 'Stripe Webhook', icon: '💳', desc: 'Auto-sync revenue from Stripe payments', link: '/settings/integrations#ai-context' },
]

export function DataGateModal({ config }: { config: DataGateConfig }) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'manual' | 'connect'>('manual')

  function handleDismiss() {
    setForm({})
    setError('')
    setTab('manual')
    config.onDismiss()
  }

  async function save() {
    const filled = config.requiredFields.filter(f => form[f.key] !== undefined && form[f.key] !== '')
    if (filled.length === 0) {
      setError('Please fill in at least one field')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload: Record<string, number | string> = {}
      for (const f of config.requiredFields) {
        if (form[f.key] !== undefined && form[f.key] !== '') {
          payload[f.key] = f.inputType === 'text' ? form[f.key] : Number(form[f.key])
        }
      }

      const r = await fetch('/api/integrations/website-metrics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error('Save failed')

      setForm({})
      setTab('manual')
      config.onComplete()
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-amber-400 text-base">⚠️</span>
              <p className="text-white font-semibold text-sm">Real business data required</p>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              <span className="text-violet-400 font-medium">{config.feature}</span> needs your actual business metrics to work accurately.{' '}
              {config.description}
            </p>
            <p className="text-red-400 text-[11px] mt-2 font-medium">
              ❌ AI will not run on fake or estimated data.
            </p>
          </div>
          <button onClick={handleDismiss} className="text-slate-600 hover:text-slate-400 shrink-0 text-lg leading-none mt-0.5">✕</button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4">
          <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1 w-fit">
            <button
              onClick={() => setTab('manual')}
              className={`text-xs px-4 py-1.5 rounded-md font-medium transition-colors ${tab === 'manual' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              ✏️ Manual Entry
            </button>
            <button
              onClick={() => setTab('connect')}
              className={`text-xs px-4 py-1.5 rounded-md font-medium transition-colors ${tab === 'connect' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              🔌 Integration Connect
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {tab === 'manual' ? (
            <div className="space-y-4">
              <p className="text-slate-500 text-xs">Enter your current real numbers. AI will use these immediately.</p>

              <div className="space-y-3">
                {config.requiredFields.map(f => (
                  <div key={f.key}>
                    <label className="block text-xs text-slate-300 font-medium mb-1">{f.label}</label>
                    <div className="relative">
                      {f.prefix && (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{f.prefix}</span>
                      )}
                      <input
                        type={f.inputType ?? 'number'}
                        value={form[f.key] ?? ''}
                        onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors ${f.prefix ? 'pl-7 pr-3' : f.suffix ? 'pl-3 pr-7' : 'px-3'}`}
                      />
                      {f.suffix && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{f.suffix}</span>
                      )}
                    </div>
                    <p className="text-slate-600 text-[10px] mt-1">{f.why}</p>
                  </div>
                ))}
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-500 text-xs">Connect your existing systems — data will sync automatically.</p>
              {INTEGRATION_OPTIONS.map(opt => (
                <Link
                  key={opt.label}
                  href={opt.link}
                  onClick={handleDismiss}
                  className="flex items-start gap-3 p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-violet-700 rounded-xl transition-all group">
                  <span className="text-xl shrink-0 mt-0.5">{opt.icon}</span>
                  <div>
                    <p className="text-white text-sm font-medium group-hover:text-violet-300 transition-colors">{opt.label}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{opt.desc}</p>
                  </div>
                  <span className="ml-auto text-slate-600 group-hover:text-violet-400 transition-colors self-center text-sm">→</span>
                </Link>
              ))}
              <p className="text-slate-600 text-[11px] text-center pt-1">
                You will be taken to Integration Settings to connect.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={handleDismiss}
            className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
            Not now
          </button>
          {tab === 'manual' && (
            <button
              onClick={save}
              disabled={saving}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Save & Run AI'}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
