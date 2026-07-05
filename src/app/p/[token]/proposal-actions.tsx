'use client'

import { useState } from 'react'

export default function ProposalActions({
  token,
  proposalId,
  clientName,
}: {
  token: string
  proposalId: string
  clientName: string
}) {
  const [status, setStatus] = useState<'idle' | 'customizing' | 'done'>('idle')
  const [action, setAction] = useState<'accepted' | 'declined' | null>(null)
  const [customNote, setCustomNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function respond(newStatus: 'accepted' | 'declined', note?: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/proposals/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, status: newStatus, note: note || null }),
      })
      if (!res.ok) throw new Error('Failed to submit response')
      setAction(newStatus)
      setStatus('done')
      window.location.reload()
    } catch {
      setError('Could not submit your response. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'done') return null

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-100">
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-1">Your Response</p>
        <h3 className="text-slate-900 font-bold text-lg leading-snug">
          Hi {clientName}, what would you like to do?
        </h3>
      </div>

      <div className="p-6">
        {status === 'customizing' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">
                What changes or clarifications would you like?
              </label>
              <textarea
                value={customNote}
                onChange={e => setCustomNote(e.target.value)}
                rows={4}
                autoFocus
                placeholder="e.g. Can you adjust the timeline? I'd like to start in August instead of July. Also, can we discuss the pricing for the first milestone?"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all placeholder-slate-300 leading-relaxed"
              />
            </div>
            {error && (
              <p className="text-red-500 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setStatus('idle')}
                className="px-5 py-2.5 border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 text-sm rounded-xl transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => respond('declined', customNote)}
                disabled={loading || !customNote.trim()}
                className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                {loading ? 'Sending…' : 'Send Customization Request →'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {error && (
              <p className="text-red-500 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg mb-4">{error}</p>
            )}
            <div className="grid grid-cols-3 gap-3">
              {/* Accept */}
              <button
                onClick={() => respond('accepted')}
                disabled={loading}
                className="group relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-emerald-200 bg-gradient-to-b from-emerald-50 to-white hover:from-emerald-100 hover:border-emerald-400 text-emerald-900 transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center transition-colors text-2xl">
                  ✓
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm text-emerald-800">Accept</p>
                  <p className="text-emerald-600 text-[11px] mt-0.5 leading-tight">I agree to this proposal</p>
                </div>
              </button>

              {/* Customize */}
              <button
                onClick={() => setStatus('customizing')}
                disabled={loading}
                className="group relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-violet-200 bg-gradient-to-b from-violet-50 to-white hover:from-violet-100 hover:border-violet-400 text-violet-900 transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
              >
                <div className="w-12 h-12 rounded-full bg-violet-100 group-hover:bg-violet-200 flex items-center justify-center transition-colors text-2xl">
                  ✏
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm text-violet-800">Customize</p>
                  <p className="text-violet-500 text-[11px] mt-0.5 leading-tight">Request changes</p>
                </div>
              </button>

              {/* Decline */}
              <button
                onClick={() => respond('declined')}
                disabled={loading}
                className="group relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-rose-200 bg-gradient-to-b from-rose-50 to-white hover:from-rose-100 hover:border-rose-400 text-rose-900 transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
              >
                <div className="w-12 h-12 rounded-full bg-rose-100 group-hover:bg-rose-200 flex items-center justify-center transition-colors text-2xl">
                  ✕
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm text-rose-700">Decline</p>
                  <p className="text-rose-400 text-[11px] mt-0.5 leading-tight">Not interested</p>
                </div>
              </button>
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 mt-4 text-slate-400 text-sm">
                <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                Submitting your response…
              </div>
            )}
            {!loading && (
              <p className="text-slate-400 text-xs text-center mt-4">
                Your decision will be sent to the sender immediately.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
