'use client'

import { useState, useEffect, useCallback } from 'react'

interface RedditSettings {
  enabled: boolean
  subreddits: string[]
  keywords: string[]
  brand_keywords: string[]
  last_scan_at?: string
}

export default function RedditSection() {
  const [settings, setSettings] = useState<RedditSettings>({
    enabled: false,
    subreddits: [],
    keywords: [],
    brand_keywords: [],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const [subInput, setSubInput] = useState('')
  const [kwInput, setKwInput]   = useState('')
  const [brandInput, setBrandInput] = useState('')

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    fetch('/api/reddit/settings')
      .then(r => r.json())
      .then(d => { if (d.settings) setSettings(d.settings) })
      .finally(() => setLoading(false))
  }, [])

  const save = useCallback(async (patch: Partial<RedditSettings>) => {
    setSaving(true)
    const next = { ...settings, ...patch }
    setSettings(next)
    try {
      const res = await fetch('/api/reddit/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (res.ok) showToast('success', 'Settings saved')
      else showToast('error', 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [settings])

  const addItem = (field: 'subreddits' | 'keywords' | 'brand_keywords', value: string) => {
    const clean = value.trim().replace(/^r\//, '').toLowerCase()
    if (!clean) return
    if (settings[field].includes(clean)) return
    save({ [field]: [...settings[field], clean] })
  }

  const removeItem = (field: 'subreddits' | 'keywords' | 'brand_keywords', value: string) => {
    save({ [field]: settings[field].filter(v => v !== value) })
  }

  const scan = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/reddit/scan', { method: 'POST' })
      const data = await res.json()
      if (res.ok) showToast('success', `Scan complete — ${data.inserted} new signals found`)
      else showToast('error', data.error ?? 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="h-4 w-32 bg-slate-800 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-orange-950/40 border border-orange-800/30 flex items-center justify-center text-2xl flex-shrink-0">
            🤖
          </div>
          <div>
            <h3 className="text-white font-semibold">Reddit Lead Monitor</h3>
            <p className="text-slate-500 text-sm mt-0.5">Find leads & brand mentions across Reddit automatically</p>
          </div>
        </div>
        <button
          onClick={() => save({ enabled: !settings.enabled })}
          disabled={saving}
          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
            settings.enabled ? 'bg-blue-600' : 'bg-slate-700'
          }`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            settings.enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`} />
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border ${
          toast.type === 'success'
            ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
            : 'bg-red-950/30 border-red-800/40 text-red-300'
        }`}>
          {toast.type === 'success' ? '✓' : '✗'} {toast.msg}
        </div>
      )}

      {settings.enabled && (
        <>
          {/* Subreddits */}
          <div>
            <label className="text-slate-300 text-sm font-medium block mb-2">
              Subreddits to monitor
              <span className="text-slate-600 font-normal ml-2">e.g. entrepreneur, smallbusiness</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                value={subInput}
                onChange={e => setSubInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem('subreddits', subInput); setSubInput('') } }}
                placeholder="r/subreddit"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => { addItem('subreddits', subInput); setSubInput('') }}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {settings.subreddits.map(s => (
                <span key={s} className="flex items-center gap-1.5 bg-orange-950/30 border border-orange-800/30 text-orange-300 text-xs px-2.5 py-1 rounded-full">
                  r/{s}
                  <button onClick={() => removeItem('subreddits', s)} className="hover:text-red-400 transition-colors">×</button>
                </span>
              ))}
              {settings.subreddits.length === 0 && (
                <p className="text-slate-600 text-xs">No subreddits added</p>
              )}
            </div>
          </div>

          {/* Lead Keywords */}
          <div>
            <label className="text-slate-300 text-sm font-medium block mb-2">
              Lead keywords
              <span className="text-slate-600 font-normal ml-2">phrases that indicate buying intent</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                value={kwInput}
                onChange={e => setKwInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem('keywords', kwInput); setKwInput('') } }}
                placeholder="looking for agency, need help with..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => { addItem('keywords', kwInput); setKwInput('') }}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {settings.keywords.map(k => (
                <span key={k} className="flex items-center gap-1.5 bg-blue-950/30 border border-blue-800/30 text-blue-300 text-xs px-2.5 py-1 rounded-full">
                  {k}
                  <button onClick={() => removeItem('keywords', k)} className="hover:text-red-400 transition-colors">×</button>
                </span>
              ))}
              {settings.keywords.length === 0 && (
                <p className="text-slate-600 text-xs">No keywords added</p>
              )}
            </div>
          </div>

          {/* Brand Keywords */}
          <div>
            <label className="text-slate-300 text-sm font-medium block mb-2">
              Brand & competitor keywords
              <span className="text-slate-600 font-normal ml-2">mention tracking across all Reddit</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                value={brandInput}
                onChange={e => setBrandInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem('brand_keywords', brandInput); setBrandInput('') } }}
                placeholder="YourBrand, CompetitorName..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => { addItem('brand_keywords', brandInput); setBrandInput('') }}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {settings.brand_keywords.map(k => (
                <span key={k} className="flex items-center gap-1.5 bg-violet-950/30 border border-violet-800/30 text-violet-300 text-xs px-2.5 py-1 rounded-full">
                  {k}
                  <button onClick={() => removeItem('brand_keywords', k)} className="hover:text-red-400 transition-colors">×</button>
                </span>
              ))}
              {settings.brand_keywords.length === 0 && (
                <p className="text-slate-600 text-xs">No brand keywords added</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <div>
              {settings.last_scan_at ? (
                <p className="text-slate-600 text-xs">
                  Last scan: {new Date(settings.last_scan_at).toLocaleString()}
                </p>
              ) : (
                <p className="text-slate-600 text-xs">Auto-scans every 3 hours · Results appear in Agent Inbox</p>
              )}
            </div>
            <button
              onClick={scan}
              disabled={scanning || settings.subreddits.length === 0 && settings.keywords.length === 0 && settings.brand_keywords.length === 0}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {scanning ? (
                <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Scanning…</>
              ) : (
                '⚡ Scan Now'
              )}
            </button>
          </div>
        </>
      )}

      {!settings.enabled && (
        <div className="bg-slate-950/60 border border-slate-800/60 border-dashed rounded-xl p-5 text-center">
          <p className="text-slate-500 text-sm">Enable Reddit monitoring to find leads and brand mentions automatically</p>
          <p className="text-slate-600 text-xs mt-1">Results appear as signals in your Agent Inbox · Free, no API key needed</p>
        </div>
      )}
    </div>
  )
}
