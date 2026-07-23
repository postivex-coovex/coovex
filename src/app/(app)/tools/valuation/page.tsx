'use client'

import { useState, useEffect } from 'react'

interface ValuationResult {
  low: number
  mid: number
  high: number
  methods: { name: string; value: number; multiple: string; basis: string }[]
  key_factors: string[]
  risks: string[]
  summary: string
}

function fmt(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`
  return `$${(n / 1000).toFixed(0)}K`
}

export default function ValuationPage() {
  const [form, setForm] = useState({
    arr: '', mrr: '', growth_rate: '', gross_margin: '',
    customer_count: '', churn_rate: '',
  })
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<ValuationResult | null>(null)

  useEffect(() => {
    async function prefill() {
      try {
        const res = await fetch('/api/integrations/website-metrics')
        if (!res.ok) return
        const { metrics } = await res.json()
        if (!metrics) return
        setForm(f => ({
          ...f,
          mrr: metrics.mrr ? String(metrics.mrr) : f.mrr,
          arr: metrics.mrr ? String(Math.round(Number(metrics.mrr) * 12)) : f.arr,
          customer_count: metrics.paying_customers ? String(metrics.paying_customers) : f.customer_count,
          churn_rate: metrics.churn_rate ? String(metrics.churn_rate) : f.churn_rate,
        }))
      } catch { /* no prefill */ }
    }
    prefill()
  }, [])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function calculate(e: React.FormEvent) {
    e.preventDefault()
    setGenerating(true)
    setResult(null)
    try {
      const res = await fetch('/api/tools/valuation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.valuation) setResult(data.valuation)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Business Valuation Estimator</h1>
        <p className="text-slate-400 text-sm mt-0.5">AI-powered valuation using revenue multiples, EBITDA, and DCF</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-1">Business Metrics</h2>
          <p className="text-slate-600 text-xs mb-4">Pre-filled from your connected data where available.</p>
          <form onSubmit={calculate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Annual Recurring Revenue</label>
                <input value={form.arr} onChange={set('arr')} placeholder="e.g. 150000"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Monthly MRR</label>
                <input value={form.mrr} onChange={set('mrr')} placeholder="e.g. 12500"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">YoY Growth Rate (%)</label>
                <input value={form.growth_rate} onChange={set('growth_rate')} placeholder="e.g. 85"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Gross Margin (%)</label>
                <input value={form.gross_margin} onChange={set('gross_margin')} placeholder="e.g. 78"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Paying Customers</label>
                <input value={form.customer_count} onChange={set('customer_count')} placeholder="e.g. 45"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Monthly Churn (%)</label>
                <input value={form.churn_rate} onChange={set('churn_rate')} placeholder="e.g. 3.2"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>
            <button type="submit" disabled={generating}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
              {generating
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Calculating…</>
                : '✨ Estimate Valuation'}
            </button>
          </form>
        </div>

        {/* Results */}
        <div>
          {result ? (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <p className="text-slate-500 text-xs mb-3">Estimated Valuation Range</p>
                <div className="flex items-end gap-3 mb-4">
                  <div className="text-center">
                    <p className="text-slate-500 text-xs mb-1">Low</p>
                    <p className="text-slate-400 text-xl font-bold">{fmt(result.low)}</p>
                  </div>
                  <div className="flex-1 text-center pb-1">
                    <p className="text-blue-300 text-xs mb-1">Most Likely</p>
                    <p className="text-white text-4xl font-black">{fmt(result.mid)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 text-xs mb-1">High</p>
                    <p className="text-slate-400 text-xl font-bold">{fmt(result.high)}</p>
                  </div>
                </div>
                <div className="relative h-3 bg-slate-800 rounded-full">
                  <div className="absolute h-3 bg-gradient-to-r from-slate-600 via-blue-500 to-blue-600 rounded-full inset-0" />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-blue-500 shadow-lg"
                    style={{ left: `${Math.round(((result.mid - result.low) / Math.max(result.high - result.low, 1)) * 80 + 10)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-600 text-[10px]">{fmt(result.low)}</span>
                  <span className="text-slate-600 text-[10px]">{fmt(result.high)}</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-white font-medium text-sm mb-3">Valuation Methods</h3>
                <div className="space-y-2">
                  {result.methods.map((m, i) => (
                    <div key={i} className="flex items-start gap-3 py-2 border-t border-slate-800 first:border-0 first:pt-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300 text-xs font-medium">{m.name}</span>
                          <span className="text-blue-400 text-xs">{m.multiple}</span>
                        </div>
                        <p className="text-slate-600 text-xs mt-0.5">{m.basis}</p>
                      </div>
                      <span className="text-white text-sm font-bold flex-shrink-0">{fmt(m.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 border-dashed rounded-2xl p-12 text-center h-full flex flex-col items-center justify-center">
              <div className="text-4xl mb-3">💰</div>
              <p className="text-slate-500 text-sm font-medium">Valuation preview</p>
              <p className="text-slate-600 text-xs mt-1">Fill in your metrics and click calculate</p>
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-blue-400 mb-3">✓ Value Drivers</h3>
            <ul className="space-y-1.5">
              {result.key_factors.map((f, i) => (
                <li key={i} className="text-xs text-slate-300 flex gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0 mt-1.5" />{f}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-red-400 mb-3">⚠ Risk Factors</h3>
            <ul className="space-y-1.5">
              {result.risks.map((r, i) => (
                <li key={i} className="text-xs text-slate-300 flex gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />{r}
                </li>
              ))}
            </ul>
          </div>
          <div className="sm:col-span-2 bg-slate-950/20 border border-slate-700/30 rounded-xl p-5">
            <p className="text-blue-300 text-xs font-semibold mb-2">🎯 Strategic Summary</p>
            <p className="text-slate-200 text-sm leading-relaxed">{result.summary}</p>
          </div>
        </div>
      )}
    </div>
  )
}
