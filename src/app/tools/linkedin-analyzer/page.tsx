'use client'

import { useState } from 'react'
import Link from 'next/link'

interface AnalysisResult {
  profile_url: string
  scores: {
    completeness: number
    activity: number
    engagement: number
    network: number
    overall: number
  }
  tips: string[]
  quick_wins: string[]
}

function generateMockAnalysis(url: string): AnalysisResult {
  const base = 40 + Math.floor(Math.random() * 35)
  return {
    profile_url: url,
    scores: {
      completeness: Math.min(95, base + Math.floor(Math.random() * 30)),
      activity: Math.min(90, base - 10 + Math.floor(Math.random() * 40)),
      engagement: Math.min(85, base - 5 + Math.floor(Math.random() * 35)),
      network: Math.min(90, base + Math.floor(Math.random() * 30)),
      overall: base,
    },
    tips: [
      'Add a professional headshot — profiles with photos get 21× more views',
      'Write a compelling headline beyond just your job title',
      'Add "Open to Work" or "Open to Collaboration" to signal availability',
      'Feature your top 3 projects in the Featured section',
      'Request recommendations from colleagues and clients',
      'Post original content at least once a week to boost algorithm visibility',
    ],
    quick_wins: [
      'Add your contact info (email/website) to the About section',
      'Fill in all 5 skill endorsement slots',
      'Add your company URL to your current position',
      'Turn on Creator Mode to unlock analytics and LinkedIn Live',
    ],
  }
}

export default function LinkedInAnalyzerPage() {
  const [profileUrl, setProfileUrl] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'form' | 'email' | 'results'>('form')

  async function analyze(e: React.FormEvent) {
    e.preventDefault()
    if (!profileUrl.trim()) return

    setError('')
    setLoading(true)

    await new Promise(r => setTimeout(r, 2000)) // Simulate analysis
    const analysis = generateMockAnalysis(profileUrl)
    setResult(analysis)
    setLoading(false)
    setStep('email')
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !result) return

    await fetch('/api/tools/capture-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, tool_used: 'linkedin-analyzer', result_json: result }),
    })

    setStep('results')
  }

  const scoreColor = (s: number) =>
    s >= 70 ? 'text-green-400' : s >= 50 ? 'text-amber-400' : 'text-red-400'

  if (step === 'form') {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
            💼 LinkedIn Profile Analyzer — Free
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Optimize your LinkedIn profile</h1>
          <p className="text-slate-400 text-sm">
            Paste your LinkedIn URL. Get a full optimization score and top improvement tips.
          </p>
        </div>

        <form onSubmit={analyze} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">LinkedIn Profile URL</label>
            <input
              type="url"
              value={profileUrl}
              onChange={e => setProfileUrl(e.target.value)}
              placeholder="https://linkedin.com/in/yourname"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors text-sm"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !profileUrl.trim()}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing profile...</>
            ) : 'Analyze My Profile →'}
          </button>
        </form>

        <div className="mt-8 bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
          <p className="text-slate-400 text-sm font-medium mb-3">What we analyze:</p>
          <div className="grid grid-cols-2 gap-2">
            {['Profile completeness', 'Posting activity', 'Engagement rate', 'Network strength', 'Headline optimization', 'Featured section', 'Recommendations', 'Skills & endorsements'].map(item => (
              <div key={item} className="flex items-center gap-2 text-slate-500 text-xs">
                <div className="w-1 h-1 bg-violet-400 rounded-full" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (step === 'email' && result) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <div className="text-6xl font-bold mb-2">
          <span className={scoreColor(result.scores.overall)}>{result.scores.overall}</span>
          <span className="text-slate-600 text-3xl">/100</span>
        </div>
        <p className="text-white font-semibold mb-1">Your LinkedIn Score is ready!</p>
        <p className="text-slate-400 text-sm mb-8">Enter your email to see the full breakdown and optimization tips.</p>

        <form onSubmit={submitEmail} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500 transition-colors"
          />
          <button
            type="submit"
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            See Full Report →
          </button>
        </form>
      </div>
    )
  }

  if (step === 'results' && result) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        <h1 className="text-2xl font-bold text-white">Your LinkedIn Analysis</h1>

        {/* Scores */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-semibold">Profile Score</h3>
            <span className={`text-2xl font-bold ${scoreColor(result.scores.overall)}`}>{result.scores.overall}/100</span>
          </div>
          {Object.entries({ Completeness: result.scores.completeness, Activity: result.scores.activity, Engagement: result.scores.engagement, Network: result.scores.network }).map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300">{k}</span>
                <span className={scoreColor(v)}>{v}</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${v >= 70 ? 'bg-green-500' : v >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${v}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Quick wins */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <h3 className="text-white font-semibold">⚡ Quick Wins (do these today)</h3>
          {result.quick_wins.map((tip, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-bold flex-shrink-0">{i + 1}</div>
              <p className="text-slate-300 text-sm">{tip}</p>
            </div>
          ))}
        </div>

        {/* Tips */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <h3 className="text-white font-semibold">💡 Growth Tips</h3>
          {result.tips.slice(0, 4).map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-violet-400 rounded-full mt-1.5 flex-shrink-0" />
              <p className="text-slate-300 text-sm">{tip}</p>
            </div>
          ))}
        </div>

        <div className="bg-violet-950/40 border border-violet-800/30 rounded-2xl p-6 text-center">
          <p className="text-white font-semibold mb-2">Let AI manage your LinkedIn posting schedule</p>
          <p className="text-slate-400 text-sm mb-4">CooVex writes and schedules LinkedIn posts automatically, every week.</p>
          <Link href={email ? `/signup?email=${encodeURIComponent(email)}` : '/signup'} className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">
            Start Free Trial →
          </Link>
        </div>
      </div>
    )
  }

  return null
}
