'use client'

import { useEffect, useState } from 'react'

interface FeatureFlag {
  flag_key: string
  description: string
  enabled_globally: boolean
  enabled_for_plans: string[]
  enabled_for_workspace_ids: string[]
}

export default function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/admin/feature-flags')
      .then(r => r.json())
      .then(d => { setFlags(d.flags || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function toggle(key: string, current: boolean) {
    setSaving(key)
    setMsg(null)
    const res = await fetch('/api/admin/feature-flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flag_key: key, enabled_globally: !current }),
    })
    const data = await res.json()
    if (data.error) {
      setMsg({ type: 'err', text: data.error })
    } else {
      setFlags(prev => prev.map(f => f.flag_key === key ? { ...f, enabled_globally: !current } : f))
      setMsg({ type: 'ok', text: `"${key}" ${!current ? 'enabled' : 'disabled'}` })
    }
    setSaving(null)
    setTimeout(() => setMsg(null), 3000)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Feature Flags</h1>
        <p className="text-slate-400 text-sm">Toggle features globally or per plan</p>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.type === 'ok' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900' : 'bg-red-950/50 text-red-400 border border-red-900'}`}>
          {msg.text}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-600 text-sm">Loading flags…</div>
        ) : flags.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-600 text-sm mb-2">No feature flags in the database</p>
            <p className="text-slate-700 text-xs">Add rows to the `feature_flags` table to manage features here</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {flags.map(flag => (
              <div key={flag.flag_key} className="flex items-start gap-4 px-6 py-4">
                <div className="flex-1">
                  <p className="text-white font-medium text-sm font-mono">{flag.flag_key}</p>
                  {flag.description && <p className="text-slate-500 text-xs mt-0.5">{flag.description}</p>}
                  {(flag.enabled_for_plans || []).length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {flag.enabled_for_plans.map(p => (
                        <span key={p} className="text-xs px-2 py-0.5 bg-violet-950/50 text-violet-400 border border-violet-900/50 rounded-full">{p}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => toggle(flag.flag_key, flag.enabled_globally)}
                  disabled={saving === flag.flag_key}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 mt-0.5 ${
                    flag.enabled_globally ? 'bg-emerald-600' : 'bg-slate-700'
                  } ${saving === flag.flag_key ? 'opacity-50' : 'hover:opacity-80'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    flag.enabled_globally ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
