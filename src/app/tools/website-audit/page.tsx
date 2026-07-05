'use client'

import { useState } from 'react'
import Link from 'next/link'

interface AuditScores {
  performance: number
  seo: number
  accessibility: number
  best_practices: number
  mobile: number
  overall: number
}

interface AuditIssue {
  severity: 'critical' | 'warning' | 'info'
  category: string
  title: string
  description: string
}

interface AuditResult {
  url: string
  scores: AuditScores
  issues: AuditIssue[]
  recommendations: string[]
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-blue-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'
  const textColor = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-blue-400' : score >= 40 ? 'text-amber-400' : 'text-red-400'
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-slate-300">{label}</span>
        <span className={`font-semibold ${textColor}`}>{score}</span>
      </div>
      <div className="w-full bg-slate-800 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

export default function WebsiteAuditPage() {
  const [url, setUrl] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AuditResult | null>(null)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)

  async function runAudit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return

    setError('')
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/tools/website-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Audit failed')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !result) return

    setSavingEmail(true)
    await fetch('/api/tools/capture-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        tool_used: 'website-audit',
        result_json: result,
      }),
    })
    setSavingEmail(false)
    setEmailSent(true)
  }

  const issueColors = {
    critical: 'border-red-900/50 bg-red-950/20 text-red-400',
    warning: 'border-amber-900/50 bg-amber-950/20 text-amber-400',
    info: 'border-blue-900/50 bg-blue-950/20 text-blue-400',
  }

  const issueIcons = { critical: '❗', warning: '⚠️', info: 'ℹ️' }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-violet-500/10 text-violet-300 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
          🔍 Website Audit — Free, Instant
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Get your free website audit
        </h1>
        <p className="text-slate-400 text-sm">
          Performance, SEO, mobile, accessibility — full report in 30 seconds. No signup needed.
        </p>
      </div>

      {/* Audit form */}
      <form onSubmit={runAudit} className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://yourbusiness.com"
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-colors text-sm"
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-colors whitespace-nowrap flex items-center gap-2 text-sm"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Auditing...</>
            ) : 'Audit My Website →'}
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </form>

      {/* Loading state */}
      {loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 border-3 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderWidth: 3 }} />
          <p className="text-white font-medium">Analyzing your website...</p>
          <p className="text-slate-500 text-sm mt-1">This takes about 15-30 seconds</p>
          <div className="mt-4 space-y-1 text-xs text-slate-600">
            {['Checking page speed...', 'Analyzing SEO signals...', 'Testing mobile performance...', 'Scanning for issues...'].map((s, i) => (
              <p key={i}>{s}</p>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Overall score */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-white font-semibold text-lg">Audit Complete</h2>
                <p className="text-slate-500 text-xs mt-0.5 truncate max-w-xs">{result.url}</p>
              </div>
              <div className="text-right">
                <div className={`text-4xl font-bold ${result.scores.overall >= 70 ? 'text-blue-400' : result.scores.overall >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                  {result.scores.overall}
                </div>
                <div className="text-slate-500 text-xs">Overall Score</div>
              </div>
            </div>

            <div className="space-y-3">
              <ScoreBar label="Performance" score={result.scores.performance} />
              <ScoreBar label="SEO" score={result.scores.seo} />
              <ScoreBar label="Mobile" score={result.scores.mobile} />
              <ScoreBar label="Accessibility" score={result.scores.accessibility} />
              <ScoreBar label="Best Practices" score={result.scores.best_practices} />
            </div>
          </div>

          {/* Issues */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
            <h3 className="text-white font-semibold">Issues Found ({result.issues.length})</h3>
            {result.issues.map((issue, i) => (
              <div key={i} className={`border rounded-xl p-4 ${issueColors[issue.severity]}`}>
                <div className="flex items-start gap-3">
                  <span>{issueIcons[issue.severity]}</span>
                  <div>
                    <p className="font-medium text-sm text-white">{issue.title}</p>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">{issue.description}</p>
                  </div>
                  <span className="ml-auto text-xs opacity-60 whitespace-nowrap">{issue.category}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
            <h3 className="text-white font-semibold">Top Recommendations</h3>
            {result.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0 text-violet-400 text-xs font-bold">
                  {i + 1}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">{rec}</p>
              </div>
            ))}
          </div>

          {/* Email capture */}
          {!emailSent ? (
            <div className="bg-violet-950/40 border border-violet-800/30 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-1">Get the full action plan + monthly monitoring</h3>
              <p className="text-slate-400 text-sm mb-4">Enter your email to receive this report + a 14-day free trial of CooVex.</p>
              <form onSubmit={saveEmail} className="flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={savingEmail}
                  className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                >
                  {savingEmail ? 'Sending...' : 'Send Report →'}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-emerald-950/40 border border-emerald-800/30 rounded-xl p-6 text-center">
              <p className="text-emerald-300 text-sm font-medium mb-1">✅ Got it! Your report is on the way.</p>
              <p className="text-slate-400 text-sm mb-4">Start your free trial to get automated weekly audits + AI fixes.</p>
              <Link
                href={`/signup?email=${encodeURIComponent(email)}`}
                className="inline-block bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
              >
                Continue to CooVex — your email is pre-filled →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Feature comparison - show when no result */}
      {!result && !loading && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6">
          <h3 className="text-slate-300 font-medium text-sm mb-4">This free audit checks:</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              '⚡ Page load speed', '🔍 SEO fundamentals', '📱 Mobile responsiveness',
              '♿ Accessibility', '🔒 Security (HTTPS)', '🎯 Best practices',
              '📊 Core Web Vitals', '🖼️ Image optimization',
            ].map(item => (
              <div key={item} className="flex items-center gap-2 text-slate-400 text-xs">
                <div className="w-1 h-1 bg-violet-400 rounded-full" />
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
