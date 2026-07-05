'use client'

import { useState } from 'react'

type ReviewPlatform = 'google' | 'trustpilot' | 'g2' | 'capterra' | 'facebook' | 'tripadvisor'
type ReviewStatus = 'new' | 'responded' | 'flagged' | 'ignored'

interface Review {
  id: string
  platform: ReviewPlatform
  reviewer_name: string
  rating: number
  body: string | null
  response: string | null
  status: ReviewStatus
  posted_at: string
}

interface ReviewsClientProps {
  reviews: Review[]
}

const PLATFORM_META: Record<ReviewPlatform, { label: string; icon: string }> = {
  google: { label: 'Google', icon: '🔍' },
  trustpilot: { label: 'Trustpilot', icon: '⭐' },
  g2: { label: 'G2', icon: '🏅' },
  capterra: { label: 'Capterra', icon: '📊' },
  facebook: { label: 'Facebook', icon: '📘' },
  tripadvisor: { label: 'Tripadvisor', icon: '🌿' },
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400 text-sm tracking-wider">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

function AIResponseModal({ review, onClose, onSaved }: { review: Review; onClose: () => void; onSaved: (r: Review) => void }) {
  const [draft, setDraft] = useState(review.response || '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const generate = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch(`/api/reviews/${review.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      })
      const data = await res.json()
      if (data.draft) setDraft(data.draft)
    } finally {
      setIsGenerating(false)
    }
  }

  const save = async () => {
    if (!draft.trim()) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/reviews/${review.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', response: draft }),
      })
      const data = await res.json()
      if (data.review) {
        onSaved(data.review)
        onClose()
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-white font-semibold">Respond to Review</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none transition-colors">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Original review */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <p className="text-white font-medium text-sm">{review.reviewer_name}</p>
              <StarRating rating={review.rating} />
              <span className="text-slate-600 text-xs">{PLATFORM_META[review.platform]?.icon} {PLATFORM_META[review.platform]?.label}</span>
            </div>
            {review.body && <p className="text-slate-400 text-sm leading-relaxed">{review.body}</p>}
          </div>

          {/* Response draft */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-400">Your Response</label>
              <button
                onClick={generate}
                disabled={isGenerating}
                className="text-xs bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-300 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
              >
                {isGenerating ? '⏳ Generating…' : '✨ AI Draft'}
              </button>
            </div>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={6}
              placeholder="Write your response, or click 'AI Draft' to generate one…"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors resize-none"
            />
            <div className="flex justify-end mt-1">
              <span className="text-slate-600 text-xs">{draft.length} chars</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-800">
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm transition-colors">Cancel</button>
          <button
            onClick={save}
            disabled={isSaving || !draft.trim()}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {isSaving ? 'Saving…' : 'Save Response'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddReviewModal({ onClose, onAdded }: { onClose: () => void; onAdded: (r: Review) => void }) {
  const [form, setForm] = useState({ platform: 'google' as ReviewPlatform, reviewer_name: '', rating: 5, body: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.reviewer_name.trim()) { setError('Reviewer name required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return }
    onAdded(data.review)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-white font-semibold">Add Review Manually</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>
        <form onSubmit={save} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Platform</label>
              <select value={form.platform} onChange={e => set('platform', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm appearance-none focus:outline-none focus:border-violet-500">
                {(Object.keys(PLATFORM_META) as ReviewPlatform[]).map(p => (
                  <option key={p} value={p}>{PLATFORM_META[p].icon} {PLATFORM_META[p].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Rating</label>
              <select value={form.rating} onChange={e => set('rating', Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm appearance-none focus:outline-none focus:border-violet-500">
                {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)} {n} star{n !== 1 ? 's' : ''}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Reviewer Name <span className="text-red-400">*</span></label>
            <input type="text" value={form.reviewer_name} onChange={e => set('reviewer_name', e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Review Text <span className="text-slate-600 font-normal">(optional)</span></label>
            <textarea value={form.body} onChange={e => set('body', e.target.value)} rows={3}
              placeholder="What did they say?"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500 resize-none" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-sm transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
              {saving ? 'Saving…' : 'Add Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ReviewsClient({ reviews: initialReviews, gmbConfigured = false }: ReviewsClientProps & { gmbConfigured?: boolean }) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [respondingTo, setRespondingTo] = useState<Review | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [platformFilter, setPlatformFilter] = useState<ReviewPlatform | 'all'>('all')
  const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ type: 'ok' | 'err' | 'warn'; text: string } | null>(null)

  async function syncGoogle() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/reviews/sync/google', { method: 'POST' })
      const d = await res.json()
      if (d.status === 'not_configured' || d.status === 'incomplete_config') {
        setSyncMsg({ type: 'warn', text: 'Google Business Profile not connected. Go to Integrations → Google Business Profile to set up.' })
      } else if (d.status === 'token_expired') {
        setSyncMsg({ type: 'warn', text: 'Google token expired. Re-connect Google Business Profile in Integrations.' })
      } else if (d.status === 'ok') {
        setSyncMsg({ type: 'ok', text: d.imported > 0 ? `✓ ${d.imported} new review${d.imported > 1 ? 's' : ''} imported from Google.` : 'Already up to date — no new reviews.' })
        if (d.imported > 0) window.location.reload()
      } else {
        setSyncMsg({ type: 'err', text: d.message || 'Sync failed.' })
      }
    } catch {
      setSyncMsg({ type: 'err', text: 'Network error — try again.' })
    } finally {
      setSyncing(false)
    }
  }

  const handleSaved = (updated: Review) => {
    setReviews(prev => prev.map(r => r.id === updated.id ? updated : r))
  }
  const handleAdded = (r: Review) => setReviews(prev => [r, ...prev])

  const filtered = reviews.filter(r => {
    if (platformFilter !== 'all' && r.platform !== platformFilter) return false
    if (ratingFilter !== 'all' && r.rating !== ratingFilter) return false
    return true
  })

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—'

  // Rating distribution
  const dist = [5, 4, 3, 2, 1].map(n => ({
    stars: n,
    count: reviews.filter(r => r.rating === n).length,
    pct: reviews.length > 0 ? Math.round((reviews.filter(r => r.rating === n).length / reviews.length) * 100) : 0,
  }))

  const platforms = [...new Set(reviews.map(r => r.platform))] as ReviewPlatform[]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Review Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">Monitor and respond to reviews across all platforms</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={syncGoogle}
            disabled={syncing}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors border border-slate-700"
          >
            {syncing ? (
              <><span className="w-3.5 h-3.5 border border-slate-400 border-t-transparent rounded-full animate-spin" />Syncing…</>
            ) : (
              <>🔍 Sync Google</>
            )}
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            + Add Manually
          </button>
          <a href="/integrations" className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            + Connect Platform
          </a>
        </div>
      </div>

      {/* Sync status message */}
      {syncMsg && (
        <div className={`mb-5 px-4 py-3 rounded-xl text-sm border ${
          syncMsg.type === 'ok'   ? 'bg-emerald-950/20 border-emerald-800/30 text-emerald-400' :
          syncMsg.type === 'warn' ? 'bg-amber-950/20 border-amber-800/30 text-amber-400' :
                                    'bg-red-950/20 border-red-800/30 text-red-400'
        }`}>
          {syncMsg.text}
          {syncMsg.type === 'warn' && (
            <a href="/integrations/google_mybusiness" className="ml-2 underline hover:no-underline">Configure →</a>
          )}
        </div>
      )}

      {/* GMB not connected banner */}
      {!gmbConfigured && reviews.filter(r => r.platform === 'google').length === 0 && (
        <div className="mb-6 bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔍</span>
            <div>
              <p className="text-white text-sm font-medium">Connect Google Business Profile</p>
              <p className="text-slate-500 text-xs mt-0.5">Auto-sync Google reviews — click "Sync Google" after connecting.</p>
            </div>
          </div>
          <a href="/integrations/google_mybusiness"
            className="flex-shrink-0 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Connect →
          </a>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Average Rating', value: avgRating, icon: '⭐' },
          { label: 'Total Reviews', value: reviews.length, icon: '💬' },
          { label: 'Need Response', value: reviews.filter(r => r.status === 'new').length, icon: '❗' },
          { label: 'Responded', value: reviews.filter(r => r.status === 'responded').length, icon: '✅' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 text-xs">{s.label}</span>
              <span>{s.icon}</span>
            </div>
            <div className="text-2xl font-bold text-white">{s.value}</div>
          </div>
        ))}
      </div>

      {reviews.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 text-center">
          <div className="text-5xl mb-4">⭐</div>
          <h2 className="text-white font-semibold mb-2">No reviews yet</h2>
          <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
            Connect Google Business Profile, Trustpilot, or other review platforms to see and respond to reviews here.
          </p>
          <a href="/integrations" className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
            Connect Review Platform
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Rating breakdown sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-4">
              <div className="text-center mb-4">
                <div className="text-5xl font-bold text-white">{avgRating}</div>
                <div className="text-amber-400 text-lg mt-1">
                  {'★'.repeat(Math.round(Number(avgRating)))}{'☆'.repeat(5 - Math.round(Number(avgRating)))}
                </div>
                <div className="text-slate-500 text-xs mt-1">{reviews.length} reviews</div>
              </div>
              <div className="space-y-2">
                {dist.map(d => (
                  <div key={d.stars} className="flex items-center gap-2">
                    <span className="text-amber-400 text-xs w-4">{d.stars}★</span>
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${d.pct}%` }} />
                    </div>
                    <span className="text-slate-500 text-xs w-5 text-right">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Filter</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Platform</label>
                  <select
                    value={platformFilter}
                    onChange={e => setPlatformFilter(e.target.value as ReviewPlatform | 'all')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none appearance-none"
                  >
                    <option value="all">All platforms</option>
                    {platforms.map(p => <option key={p} value={p}>{PLATFORM_META[p]?.label || p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Rating</label>
                  <select
                    value={ratingFilter}
                    onChange={e => setRatingFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none appearance-none"
                  >
                    <option value="all">All ratings</option>
                    {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} stars</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Reviews list */}
          <div className="lg:col-span-2 space-y-3">
            {filtered.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl py-10 text-center">
                <p className="text-slate-500 text-sm">No reviews match your filters</p>
              </div>
            ) : filtered.map(review => (
              <div key={review.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-white font-medium text-sm">{review.reviewer_name}</span>
                      <StarRating rating={review.rating} />
                      <span className="text-slate-500 text-xs">
                        {PLATFORM_META[review.platform]?.icon} {PLATFORM_META[review.platform]?.label}
                      </span>
                      <span className="text-slate-600 text-xs">
                        {new Date(review.posted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      {review.status === 'new' && (
                        <span className="text-xs bg-red-900/20 text-red-400 border border-red-900/40 px-2 py-0.5 rounded-full">Needs response</span>
                      )}
                      {review.status === 'responded' && (
                        <span className="text-xs bg-emerald-900/20 text-emerald-400 border border-emerald-900/40 px-2 py-0.5 rounded-full">Responded</span>
                      )}
                    </div>
                    {review.body && <p className="text-slate-400 text-sm leading-relaxed">{review.body}</p>}
                    {review.response && (
                      <div className="mt-3 pl-3 border-l-2 border-violet-800/60">
                        <p className="text-slate-500 text-xs mb-1">Your response:</p>
                        <p className="text-slate-300 text-sm">{review.response}</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setRespondingTo(review)}
                    className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border ${
                      review.status === 'responded'
                        ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        : 'bg-violet-600/20 border-violet-500/30 text-violet-300 hover:bg-violet-600 hover:text-white'
                    }`}
                  >
                    {review.status === 'responded' ? 'Edit' : '✨ Respond'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {respondingTo && (
        <AIResponseModal
          review={respondingTo}
          onClose={() => setRespondingTo(null)}
          onSaved={handleSaved}
        />
      )}

      {showAdd && (
        <AddReviewModal
          onClose={() => setShowAdd(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  )
}
