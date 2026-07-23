'use client'

import { useState, useTransition } from 'react'
import { saveChannels } from '../actions'

const CHANNELS = [
  { key: 'linkedin_url',        icon: '💼', label: 'LinkedIn',        placeholder: 'https://linkedin.com/company/your-company', hint: 'Company page URL' },
  { key: 'facebook_url',        icon: '📘', label: 'Facebook',        placeholder: 'https://facebook.com/yourpage',             hint: 'Facebook Page URL' },
  { key: 'instagram_handle',    icon: '📸', label: 'Instagram',       placeholder: '@yourbrand',                                hint: 'Username or handle' },
  { key: 'google_business_url', icon: '🌐', label: 'Google Business', placeholder: 'https://g.page/your-business',              hint: 'Google Business Profile URL' },
]

export default function ChannelsPage() {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<Record<string, string>>({
    linkedin_url: '',
    facebook_url: '',
    instagram_handle: '',
    google_business_url: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      await saveChannels({
        linkedin_url: form.linkedin_url || undefined,
        facebook_url: form.facebook_url || undefined,
        instagram_handle: form.instagram_handle || undefined,
        google_business_url: form.google_business_url || undefined,
      })
    })
  }

  const hasAny = Object.values(form).some(v => v.trim().length > 0)

  return (
    <div className="w-full max-w-2xl pt-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-10">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <div key={s} className={`h-1.5 rounded-full flex-1 transition-colors ${s <= 3 ? 'bg-blue-500' : 'bg-slate-200'}`} />
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6">
        <div>
          <p className="text-blue-600 text-sm font-semibold mb-1">Step 3 of 6</p>
          <h1 className="text-2xl font-bold text-slate-900">Connect your channels</h1>
          <p className="text-slate-500 mt-1 text-base">
            Your agent will monitor these for engagement, reviews, and competitor activity. You can add more in Settings anytime.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {CHANNELS.map(ch => (
            <div key={ch.key} className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 hover:border-blue-200 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{ch.icon}</span>
                <div>
                  <p className="text-slate-900 font-semibold text-sm">{ch.label}</p>
                  <p className="text-slate-400 text-xs">{ch.hint}</p>
                </div>
              </div>
              <input
                type="text"
                value={form[ch.key]}
                onChange={e => setForm(f => ({ ...f, [ch.key]: e.target.value }))}
                placeholder={ch.placeholder}
                className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          ))}

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-xl">🔗</span>
            <p className="text-slate-500 text-sm">
              More integrations available later — Google Analytics, HubSpot, Shopify, and 30+ others.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <a href="/onboarding/business" className="text-slate-400 hover:text-slate-600 text-sm transition-colors font-medium">
              ← Back
            </a>
            <div className="flex items-center gap-3">
              {!hasAny && (
                <a href="/onboarding/team" className="text-slate-400 hover:text-slate-600 text-sm transition-colors font-medium">
                  Skip for now
                </a>
              )}
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold px-8 py-3 rounded-xl transition-all text-base"
              >
                {isPending ? 'Saving...' : hasAny ? 'Save & Continue' : 'Continue'}
                {!isPending && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
