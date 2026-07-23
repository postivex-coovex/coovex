'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function TeamPage() {
  const router = useRouter()
  const [emails, setEmails] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [inputError, setInputError] = useState('')
  const [loading, setLoading] = useState(false)

  const addEmail = () => {
    const email = input.trim().toLowerCase()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setInputError('Please enter a valid email address'); return }
    if (emails.includes(email)) { setInputError('Email already added'); return }
    setEmails(prev => [...prev, email])
    setInput('')
    setInputError('')
  }

  const removeEmail = (email: string) => setEmails(prev => prev.filter(e => e !== email))

  const handleInvite = async () => {
    if (emails.length > 0) {
      setLoading(true)
      try {
        await fetch('/api/team/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails }),
        })
      } catch { /* continue */ } finally {
        setLoading(false)
      }
    }
    router.push('/onboarding/scanning')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); addEmail() }
  }

  return (
    <div className="w-full max-w-2xl pt-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-10">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <div key={s} className={`h-1.5 rounded-full flex-1 transition-colors ${s <= 4 ? 'bg-blue-500' : 'bg-slate-200'}`} />
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6">
        <div>
          <p className="text-blue-600 text-sm font-semibold mb-1">Step 4 of 6</p>
          <h1 className="text-2xl font-bold text-slate-900">Invite your team</h1>
          <p className="text-slate-500 mt-1 text-base">
            Add team members who will work with you. They&apos;ll receive an invitation email.
          </p>
        </div>

        <div className="space-y-3">
          {/* Email input */}
          <div className="flex gap-2">
            <input
              type="email"
              value={input}
              onChange={e => { setInput(e.target.value); setInputError('') }}
              onKeyDown={handleKeyDown}
              placeholder="teammate@company.com"
              className="flex-1 bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors text-base"
            />
            <button
              type="button"
              onClick={addEmail}
              className="bg-slate-100 hover:bg-slate-200 border-2 border-slate-200 text-slate-700 px-5 py-3 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
            >
              Add
            </button>
          </div>

          {inputError && <p className="text-red-500 text-sm">{inputError}</p>}

          {/* Added emails */}
          {emails.length > 0 && (
            <div className="space-y-2">
              {emails.map(email => (
                <div key={email} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
                      <span className="text-blue-600 text-xs font-bold">{email[0].toUpperCase()}</span>
                    </div>
                    <span className="text-slate-700 text-sm font-medium">{email}</span>
                  </div>
                  <button onClick={() => removeEmail(email)} className="text-slate-400 hover:text-red-500 transition-colors text-xs font-medium">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {emails.length === 0 && (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
              <p className="text-slate-500 text-sm font-medium">No team members added yet</p>
              <p className="text-slate-400 text-xs mt-1">You can always invite people later from Settings</p>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p className="text-slate-500 text-sm">
              <span className="text-slate-900 font-semibold">Role assignment: </span>
              Invited members start as Viewers. You can change their roles in Settings after they join.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <a href="/onboarding/channels" className="text-slate-400 hover:text-slate-600 text-sm transition-colors font-medium">
            ← Back
          </a>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/onboarding/scanning')}
              className="text-slate-400 hover:text-slate-600 text-sm transition-colors font-medium"
            >
              Skip for now
            </button>
            <button
              onClick={handleInvite}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60 text-white font-bold px-8 py-3 rounded-xl transition-all text-base"
            >
              {loading ? 'Sending...' : emails.length > 0 ? `Invite ${emails.length} & Continue` : 'Continue'}
              {!loading && (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
