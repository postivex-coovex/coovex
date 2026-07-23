'use client'

import { useState, useEffect } from 'react'

interface NpsResponse {
  id: string
  score: number
  comment: string | null
  respondent_name: string | null
  respondent_email: string | null
  category: 'promoter' | 'passive' | 'detractor'
  created_at: string
}

const CATEGORY_META = {
  promoter:  { label: 'Promoter',  color: 'bg-slate-900/50 text-blue-300 border-slate-700/40', dot: 'bg-blue-500' },
  passive:   { label: 'Passive',   color: 'bg-slate-900/50 text-slate-400 border-slate-700/40',       dot: 'bg-slate-500' },
  detractor: { label: 'Detractor', color: 'bg-red-900/50 text-red-300 border-red-800/40',             dot: 'bg-red-400' },
}

function ScoreButton({ value, selected, onClick }: { value: number; selected: boolean; onClick: () => void }) {
  const color = value >= 9 ? 'border-blue-600 hover:bg-slate-900/30 text-blue-300'
    : value >= 7 ? 'border-slate-600 hover:bg-slate-900/30 text-slate-400'
    : 'border-red-700 hover:bg-red-900/20 text-red-300'
  const selectedColor = value >= 9 ? 'bg-blue-600 border-blue-500 text-white'
    : value >= 7 ? 'bg-slate-600 border-slate-500 text-white'
    : 'bg-red-700 border-red-600 text-white'
  return (
    <button
      onClick={onClick}
      className={`w-9 h-9 rounded-lg border text-sm font-bold transition-colors ${selected ? selectedColor : `border-slate-700 text-slate-400 ${color}`}`}
    >
      {value}
    </button>
  )
}

function NpsCollector({ onSubmitted }: { onSubmitted: (r: NpsResponse) => void }) {
  const [score, setScore] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [showReview, setShowReview] = useState(false)

  async function submit() {
    if (score === null) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/nps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, comment, respondent_name: name || null }),
      })
      const data = await res.json()
      if (data.ok) {
        setDone(true)
        setShowReview(data.show_review_request)
        if (data.response) onSubmitted(data.response)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">{score! >= 9 ? '🎉' : score! >= 7 ? '😊' : '🙏'}</div>
        <h3 className="text-white font-semibold mb-2">Thank you for your feedback!</h3>
        <p className="text-slate-400 text-sm">Your response has been recorded.</p>
        {showReview && (
          <div className="mt-6 p-4 bg-slate-950/30 border border-slate-700/40 rounded-xl">
            <p className="text-blue-300 text-sm font-medium mb-3">
              You gave us a {score}/10 — we&apos;re thrilled! 🙌
            </p>
            <p className="text-slate-400 text-xs mb-3">
              Would you mind sharing your experience on Google? It helps us reach more customers like you.
            </p>
            <button className="bg-blue-600 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              Leave a Google Review →
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <h2 className="text-white font-semibold mb-1">Submit NPS Response</h2>
      <p className="text-slate-400 text-sm mb-6">How likely are you to recommend us to a colleague?</p>

      <div className="mb-2">
        <div className="flex gap-1.5 flex-wrap mb-2">
          {Array.from({ length: 11 }, (_, i) => (
            <ScoreButton key={i} value={i} selected={score === i} onClick={() => setScore(i)} />
          ))}
        </div>
        <div className="flex justify-between text-xs text-slate-600 mt-1">
          <span>0 — Not at all likely</span>
          <span>10 — Extremely likely</span>
        </div>
      </div>

      {score !== null && (
        <div className="mt-5 space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              {score >= 9 ? "What do you love most?" : score >= 7 ? "What could we improve?" : "What went wrong?"}
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Share your thoughts…"
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Your name (optional)</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit Response'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function NpsPage() {
  const [responses, setResponses] = useState<NpsResponse[]>([])
  const [score, setScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'dashboard' | 'collect'>('dashboard')

  useEffect(() => {
    fetch('/api/nps')
      .then(r => r.json())
      .then(d => {
        setResponses(d.responses || [])
        setScore(d.score ?? null)
      })
      .finally(() => setLoading(false))
  }, [])

  const promoters  = responses.filter(r => r.category === 'promoter').length
  const passives   = responses.filter(r => r.category === 'passive').length
  const detractors = responses.filter(r => r.category === 'detractor').length
  const total = responses.length

  const handleNewResponse = (r: NpsResponse) => {
    setResponses(prev => [r, ...prev])
    const all = [r, ...responses]
    const p = all.filter(x => x.category === 'promoter').length
    const d = all.filter(x => x.category === 'detractor').length
    setScore(Math.round(((p - d) / all.length) * 100))
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">NPS Survey</h1>
          <p className="text-slate-400 text-sm mt-0.5">Net Promoter Score — track customer satisfaction over time</p>
        </div>
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          {(['dashboard', 'collect'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}
            >
              {t === 'dashboard' ? '📊 Dashboard' : '📝 Collect Response'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'collect' && (
        <NpsCollector onSubmitted={handleNewResponse} />
      )}

      {tab === 'dashboard' && (
        <>
          {/* NPS score ring */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <div className="sm:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center">
              <div className={`text-5xl font-black ${
                score === null ? 'text-slate-600'
                : score >= 50 ? 'text-blue-400'
                : score >= 0 ? 'text-slate-500'
                : 'text-red-400'
              }`}>
                {score !== null ? (score > 0 ? `+${score}` : score) : '—'}
              </div>
              <p className="text-slate-500 text-xs mt-1">NPS Score</p>
              {score !== null && (
                <span className={`text-xs mt-2 px-2 py-0.5 rounded-full ${
                  score >= 50 ? 'bg-slate-900/50 text-blue-300'
                  : score >= 0 ? 'bg-slate-900/50 text-slate-400'
                  : 'bg-red-900/50 text-red-300'
                }`}>
                  {score >= 70 ? 'Excellent' : score >= 50 ? 'Great' : score >= 0 ? 'Good' : 'Needs Work'}
                </span>
              )}
            </div>

            <div className="sm:col-span-3 grid grid-cols-3 gap-4">
              {[
                { label: 'Promoters',  count: promoters,  pct: total > 0 ? Math.round(promoters / total * 100) : 0,  color: 'text-blue-400', bar: 'bg-blue-600' },
                { label: 'Passives',   count: passives,   pct: total > 0 ? Math.round(passives / total * 100) : 0,   color: 'text-slate-500',   bar: 'bg-slate-600' },
                { label: 'Detractors', count: detractors, pct: total > 0 ? Math.round(detractors / total * 100) : 0, color: 'text-red-400',     bar: 'bg-red-500' },
              ].map(s => (
                <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <p className="text-slate-500 text-xs mb-1">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.pct}%</p>
                  <p className="text-slate-600 text-xs">{s.count} response{s.count !== 1 ? 's' : ''}</p>
                  <div className="mt-2 bg-slate-800 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${s.bar}`} style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Response list */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-900 rounded-xl animate-pulse" />)}
            </div>
          ) : responses.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 text-center">
              <div className="text-5xl mb-4">🌟</div>
              <h2 className="text-white font-semibold mb-2">No responses yet</h2>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
                Start collecting NPS scores from your customers. Promoters (9-10) will be prompted to leave a Google review.
              </p>
              <button onClick={() => setTab('collect')}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
                Collect First Response
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {responses.map(r => {
                const meta = CATEGORY_META[r.category]
                return (
                  <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black flex-shrink-0 ${
                      r.score >= 9 ? 'bg-slate-900/50 text-blue-300'
                      : r.score >= 7 ? 'bg-slate-900/50 text-slate-400'
                      : 'bg-red-900/30 text-red-300'
                    }`}>
                      {r.score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-slate-300 text-sm font-medium">{r.respondent_name || 'Anonymous'}</span>
                        <span className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded border ${meta.color}`}>
                          {meta.label}
                        </span>
                      </div>
                      {r.comment && <p className="text-slate-400 text-xs italic">&quot;{r.comment}&quot;</p>}
                      <p className="text-slate-600 text-xs mt-1">
                        {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    {r.category === 'promoter' && (
                      <div className="flex-shrink-0">
                        <span className="text-xs text-blue-600">Review requested →</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
