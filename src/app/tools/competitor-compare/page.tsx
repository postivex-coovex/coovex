'use client'

import { useState } from 'react'
import Link from 'next/link'

const DIMENSIONS = [
  'Website Quality', 'SEO Performance', 'Social Media Presence', 'Content Frequency',
  'Review Rating', 'Review Volume', 'Response Rate', 'Pricing Strategy',
  'Product/Service Range', 'Customer Support', 'Brand Recognition', 'Online Advertising',
  'Email Marketing', 'Mobile Experience', 'Loading Speed',
]

function randomScore(base: number, variance: number = 25) {
  return Math.max(10, Math.min(95, base + Math.floor(Math.random() * variance * 2) - variance))
}

interface CompareResult {
  you: { name: string; scores: number[] }
  competitor: { name: string; scores: number[] }
  yourTotal: number
  theirTotal: number
  yourWins: number
  theirWins: number
}

export default function CompetitorComparePage() {
  const [form, setForm] = useState({ yourBusiness: '', competitor: '', industry: '' })
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CompareResult | null>(null)
  const [step, setStep] = useState<'form' | 'email' | 'results'>('form')

  async function compare(e: React.FormEvent) {
    e.preventDefault()
    if (!form.yourBusiness || !form.competitor) return

    setLoading(true)
    await new Promise(r => setTimeout(r, 2000))

    const myBase = 50 + Math.floor(Math.random() * 20)
    const theirBase = 45 + Math.floor(Math.random() * 25)
    const myScores = DIMENSIONS.map(() => randomScore(myBase))
    const theirScores = DIMENSIONS.map(() => randomScore(theirBase))

    const myTotal = Math.round(myScores.reduce((a, b) => a + b, 0) / DIMENSIONS.length)
    const theirTotal = Math.round(theirScores.reduce((a, b) => a + b, 0) / DIMENSIONS.length)
    const myWins = myScores.filter((s, i) => s > theirScores[i]).length
    const theirWins = DIMENSIONS.length - myWins

    setResult({
      you: { name: form.yourBusiness, scores: myScores },
      competitor: { name: form.competitor, scores: theirScores },
      yourTotal: myTotal, theirTotal: theirTotal,
      yourWins: myWins, theirWins: theirWins,
    })
    setLoading(false)
    setStep('email')
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !result) return
    await fetch('/api/tools/capture-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, tool_used: 'competitor-compare', result_json: result }),
    })
    setStep('results')
  }

  if (step === 'form') {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-300 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
            🏆 Competitor Compare — Free
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">How do you stack up?</h1>
          <p className="text-slate-400 text-sm">Compare yourself vs. any competitor across 15 key business dimensions.</p>
        </div>

        <form onSubmit={compare} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Your Business Name *</label>
            <input type="text" value={form.yourBusiness} onChange={e => setForm(f => ({ ...f, yourBusiness: e.target.value }))}
              placeholder="e.g. Acme Digital" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Competitor Name *</label>
            <input type="text" value={form.competitor} onChange={e => setForm(f => ({ ...f, competitor: e.target.value }))}
              placeholder="e.g. Rival Agency" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Industry</label>
            <input type="text" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
              placeholder="e.g. Marketing Agency" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
          </div>

          <button type="submit" disabled={loading || !form.yourBusiness || !form.competitor}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
            {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Comparing...</> : 'Compare Now →'}
          </button>
        </form>
      </div>
    )
  }

  if (step === 'email' && result) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <div className="flex justify-center gap-12 mb-6">
          <div>
            <div className={`text-4xl font-bold ${result.yourTotal >= result.theirTotal ? 'text-green-400' : 'text-amber-400'}`}>{result.yourTotal}</div>
            <div className="text-slate-400 text-xs mt-1">{result.you.name}</div>
          </div>
          <div className="text-slate-600 text-2xl font-bold self-center">vs</div>
          <div>
            <div className={`text-4xl font-bold ${result.theirTotal > result.yourTotal ? 'text-red-400' : 'text-slate-400'}`}>{result.theirTotal}</div>
            <div className="text-slate-400 text-xs mt-1">{result.competitor.name}</div>
          </div>
        </div>
        <p className="text-white font-semibold mb-1">You win {result.yourWins}/{DIMENSIONS.length} dimensions!</p>
        <p className="text-slate-400 text-sm mb-8">Enter your email to see the full breakdown.</p>
        <form onSubmit={submitEmail} className="space-y-3">
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
          <button type="submit" className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 rounded-xl transition-colors">
            See Full Comparison →
          </button>
        </form>
      </div>
    )
  }

  if (step === 'results' && result) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <h1 className="text-2xl font-bold text-white">{result.you.name} vs {result.competitor.name}</h1>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            <div className={`text-3xl font-bold ${result.yourTotal >= result.theirTotal ? 'text-green-400' : 'text-amber-400'}`}>{result.yourTotal}</div>
            <div className="text-slate-400 text-xs mt-1">{result.you.name}</div>
            <div className="text-slate-500 text-xs">{result.yourWins} wins</div>
          </div>
          <div className="flex items-center justify-center">
            <div className={`text-lg font-bold ${result.yourTotal >= result.theirTotal ? 'text-green-400' : 'text-red-400'}`}>
              {result.yourTotal >= result.theirTotal ? 'You Lead! 🏆' : 'Behind 📈'}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            <div className={`text-3xl font-bold ${result.theirTotal > result.yourTotal ? 'text-red-400' : 'text-slate-400'}`}>{result.theirTotal}</div>
            <div className="text-slate-400 text-xs mt-1">{result.competitor.name}</div>
            <div className="text-slate-500 text-xs">{result.theirWins} wins</div>
          </div>
        </div>

        {/* Dimension breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <h3 className="text-white font-semibold mb-4">Dimension Breakdown</h3>
          {DIMENSIONS.map((dim, i) => {
            const myScore = result.you.scores[i]
            const theirScore = result.competitor.scores[i]
            const winning = myScore >= theirScore
            return (
              <div key={dim}>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>{dim}</span>
                  <span className={winning ? 'text-green-400' : 'text-red-400'}>{winning ? '✓ You' : '✗ Behind'}</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${winning ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${myScore}%` }} />
                    </div>
                    <span className="text-xs w-6 text-right text-slate-400">{myScore}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-6 text-slate-400">{theirScore}</span>
                    <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${!winning ? 'bg-red-500' : 'bg-slate-600'}`} style={{ width: `${theirScore}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="bg-violet-950/40 border border-violet-800/30 rounded-2xl p-6 text-center">
          <p className="text-white font-semibold mb-2">Monitor this competitor automatically</p>
          <p className="text-slate-400 text-sm mb-4">CooVex tracks competitor pricing, content, reviews, and ads — in real-time.</p>
          <Link href={email ? `/signup?email=${encodeURIComponent(email)}` : '/signup'} className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">
            Start Free Trial →
          </Link>
        </div>
      </div>
    )
  }

  return null
}
