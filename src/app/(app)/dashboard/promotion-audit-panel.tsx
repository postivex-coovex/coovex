'use client'

import { useState } from 'react'
import { Rocket, Copy, Check, ChevronDown, ChevronUp, Globe, Loader2 } from 'lucide-react'

interface IntelResult {
  business_name: string; description: string; industry: string; stage: string
  services: string[]; target_market: string; who_needs_it: string[]
  pain_points: string[]; missing_elements: string[]; ai_insights: string[]
  cold_email: { subject: string; body: string }
  linkedin_message: string
}
interface GeoResult { geo_score: number; ai_discoverability: string; missing: string[]; checklist: { label: string; passed: boolean }[] }
interface PerfResult { scores: { performance: number; seo: number; mobile: number } }

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy}
      className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors">
      {copied ? <Check className="w-3 h-3 text-blue-400" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

export function PromotionAuditPanel() {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [prospectName, setProspectName] = useState('')
  const [prospectEmail, setProspectEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [intel, setIntel] = useState<IntelResult | null>(null)
  const [geo, setGeo] = useState<GeoResult | null>(null)
  const [perf, setPerf] = useState<PerfResult | null>(null)
  const [domain, setDomain] = useState('')
  const [reportUrl, setReportUrl] = useState('')

  const run = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError('')
    setIntel(null)
    setGeo(null)
    setPerf(null)
    try {
      const res = await fetch('/api/admin/promotion-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), prospectName: prospectName.trim(), prospectEmail: prospectEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setIntel(data.intel)
      setGeo(data.geo)
      setPerf(data.perf)
      setDomain(data.domain)
      setReportUrl(data.reportUrl || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gradient-to-r from-slate-950/30 to-slate-900 border border-slate-700/40 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-950/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-slate-700/40 flex items-center justify-center flex-shrink-0">
            <Rocket className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Promotion Audit Tool</p>
            <p className="text-[11px] text-slate-500">Audit any website → generate personalized cold outreach · Admin only</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {open && (
        <div className="px-5 pb-6 space-y-5 border-t border-slate-700/30 pt-5">

          {/* Input form */}
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Prospect Website URL *</label>
              <input
                type="url"
                placeholder="https://theirproduct.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-600 transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Founder Name (optional)</label>
                <input
                  type="text"
                  placeholder="Alex"
                  value={prospectName}
                  onChange={e => setProspectName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-600 transition-colors"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Their Email (optional)</label>
                <input
                  type="email"
                  placeholder="alex@theirproduct.com"
                  value={prospectEmail}
                  onChange={e => setProspectEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-600 transition-colors"
                />
              </div>
            </div>
          </div>

          <button
            onClick={run}
            disabled={loading || !url.trim()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            {loading ? 'Analyzing website…' : 'Run Promotion Audit'}
          </button>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {/* Results */}
          {intel && geo && perf && (
            <div className="space-y-4 pt-2">

              {/* Public report URL */}
              {reportUrl && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-950/20 border border-slate-700/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-blue-400 uppercase tracking-wide mb-0.5">Public Report URL — send this to the prospect</p>
                    <p className="text-sm text-slate-300 truncate font-mono">{reportUrl}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <CopyButton text={reportUrl} label="Copy link" />
                    <a href={reportUrl} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors">
                      Preview →
                    </a>
                  </div>
                </div>
              )}

              {/* Header row */}
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Globe className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-white">{domain}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">{intel.industry}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">{intel.stage}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${geo.geo_score >= 65 ? 'bg-slate-950/30 text-blue-400 border-slate-700/30' : geo.geo_score >= 35 ? 'bg-slate-950/30 text-slate-500 border-slate-700/30' : 'bg-red-950/30 text-red-400 border-red-800/30'}`}>
                  GEO {geo.geo_score}/100
                </span>
              </div>

              {/* GEO Checklist quick view */}
              <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">AI Discoverability Checklist</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {geo.checklist.map((item, i) => (
                    <div key={i} className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg ${item.passed ? 'text-blue-400' : 'text-red-400'}`}>
                      <span>{item.passed ? '✅' : '❌'}</span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Business summary */}
              <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Business Summary</p>
                <p className="text-sm text-slate-300 leading-relaxed">{intel.description}</p>
              </div>

              {/* Cold Email */}
              <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Cold Email</p>
                  <CopyButton text={`Subject: ${intel.cold_email.subject}\n\n${intel.cold_email.body}`} label="Copy email" />
                </div>
                <p className="text-xs text-slate-500 mb-2">Subject: <span className="text-slate-300 font-medium">{intel.cold_email.subject}</span></p>
                <pre className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">{intel.cold_email.body}</pre>
              </div>

              {/* LinkedIn DM */}
              <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">LinkedIn DM</p>
                  <CopyButton text={intel.linkedin_message} label="Copy DM" />
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{intel.linkedin_message}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
