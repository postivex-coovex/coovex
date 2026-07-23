'use client'

import { useState, useEffect } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'

interface WLConfig {
  brand_name: string
  logo_url: string
  primary_color: string
  custom_domain: string
  portal_enabled: boolean
  portal_welcome_message: string
  hide_powered_by: boolean
}

const DEFAULT: WLConfig = {
  brand_name: '',
  logo_url: '',
  primary_color: '#2563eb',
  custom_domain: '',
  portal_enabled: true,
  portal_welcome_message: 'Welcome to your business intelligence portal. Here you can view your latest performance metrics and reports.',
  hide_powered_by: false,
}

const COLORS = ['#2563eb', '#1d4ed8', '#3b82f6', '#475569', '#dc2626', '#0891b2', '#94a3b8']

export default function WhiteLabelPage() {
  const [config, setConfig] = useState<WLConfig>(DEFAULT)
  const [portalUrl, setPortalUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/white-label')
      .then(r => r.json())
      .then(d => {
        if (d.config) setConfig({ ...DEFAULT, ...d.config })
        if (d.portal_url) setPortalUrl(d.portal_url)
      })
      .catch(() => {})
  }, [])

  const set = (k: keyof WLConfig) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setConfig(c => ({ ...c, [k]: e.target.value }))

  async function save() {
    setSaving(true)
    try {
      await fetch('/api/white-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const fullPortalUrl = typeof window !== 'undefined' && portalUrl
    ? `${window.location.origin}${portalUrl}`
    : ''

  function copyUrl() {
    if (fullPortalUrl) {
      navigator.clipboard.writeText(fullPortalUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">White-Label & Client Portal</h1>
          <p className="text-slate-400 text-sm mt-0.5">Brand the client portal with your own name, colors, and domain</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
        >
          {saved ? <><Check className="w-4 h-4" /> Saved</> : saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Portal URL */}
      {portalUrl && (
        <div className="bg-slate-950/20 border border-slate-700/30 rounded-xl p-4 mb-6 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-blue-400 text-xs font-semibold mb-0.5">Your Client Portal URL</p>
            <p className="text-slate-300 text-sm truncate">{fullPortalUrl}</p>
          </div>
          <button onClick={copyUrl} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors flex-shrink-0">
            {copied ? <><Check className="w-3 h-3 text-blue-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
          </button>
          <a href={portalUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors flex-shrink-0">
            <ExternalLink className="w-3 h-3" /> Preview
          </a>
        </div>
      )}

      <div className="space-y-5">
        {/* Branding */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-white font-semibold text-sm">Branding</h2>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Brand Name</label>
            <input value={config.brand_name} onChange={set('brand_name')}
              placeholder="e.g. Acme Analytics, Smith Digital"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
            <p className="text-slate-600 text-xs mt-1">Shown in the client portal header. Leave blank to use &quot;CooVex&quot;.</p>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Logo URL</label>
            <input value={config.logo_url} onChange={set('logo_url')}
              placeholder="https://yoursite.com/logo.png"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-2">Primary Color</label>
            <div className="flex items-center gap-3 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setConfig(cfg => ({ ...cfg, primary_color: c }))}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${config.primary_color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ background: c }}
                />
              ))}
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="color"
                  value={config.primary_color}
                  onChange={e => setConfig(c => ({ ...c, primary_color: e.target.value }))}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="text-slate-500 text-xs">{config.primary_color}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Portal settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-white font-semibold text-sm">Client Portal</h2>

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-white text-sm">Enable Client Portal</p>
              <p className="text-slate-500 text-xs">Clients can view their metrics via the shared URL</p>
            </div>
            <button
              onClick={() => setConfig(c => ({ ...c, portal_enabled: !c.portal_enabled }))}
              className={`w-11 h-6 rounded-full transition-colors relative ${config.portal_enabled ? 'bg-blue-600' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${config.portal_enabled ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Welcome Message</label>
            <textarea value={config.portal_welcome_message} onChange={set('portal_welcome_message')} rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-none" />
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-white text-sm">Hide &quot;Powered by CooVex&quot;</p>
              <p className="text-slate-500 text-xs">Remove branding from the portal footer</p>
            </div>
            <button
              onClick={() => setConfig(c => ({ ...c, hide_powered_by: !c.hide_powered_by }))}
              className={`w-11 h-6 rounded-full transition-colors relative ${config.hide_powered_by ? 'bg-blue-600' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${config.hide_powered_by ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Custom domain */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-white font-semibold text-sm">Custom Domain</h2>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Domain</label>
            <input value={config.custom_domain} onChange={set('custom_domain')}
              placeholder="reports.yourcompany.com"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-500 leading-relaxed">
            Point a CNAME record from your domain to <span className="text-slate-300 font-mono">cname.coovex.com</span> then save your domain here. DNS propagation takes 10–60 minutes.
          </div>
        </div>
      </div>
    </div>
  )
}
