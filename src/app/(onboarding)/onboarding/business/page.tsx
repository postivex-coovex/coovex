'use client'

import { useState, useTransition } from 'react'
import { saveBusiness } from '../actions'

const COUNTRY_CURRENCY: { name: string; currency: string; flag: string }[] = [
  { name: 'Bangladesh',       currency: 'BDT', flag: '🇧🇩' },
  { name: 'United States',    currency: 'USD', flag: '🇺🇸' },
  { name: 'United Kingdom',   currency: 'GBP', flag: '🇬🇧' },
  { name: 'European Union',   currency: 'EUR', flag: '🇪🇺' },
  { name: 'India',            currency: 'INR', flag: '🇮🇳' },
  { name: 'Pakistan',         currency: 'PKR', flag: '🇵🇰' },
  { name: 'Canada',           currency: 'CAD', flag: '🇨🇦' },
  { name: 'Australia',        currency: 'AUD', flag: '🇦🇺' },
  { name: 'Germany',          currency: 'EUR', flag: '🇩🇪' },
  { name: 'France',           currency: 'EUR', flag: '🇫🇷' },
  { name: 'Netherlands',      currency: 'EUR', flag: '🇳🇱' },
  { name: 'Spain',            currency: 'EUR', flag: '🇪🇸' },
  { name: 'Italy',            currency: 'EUR', flag: '🇮🇹' },
  { name: 'UAE',              currency: 'AED', flag: '🇦🇪' },
  { name: 'Saudi Arabia',     currency: 'SAR', flag: '🇸🇦' },
  { name: 'Singapore',        currency: 'SGD', flag: '🇸🇬' },
  { name: 'Malaysia',         currency: 'MYR', flag: '🇲🇾' },
  { name: 'Nigeria',          currency: 'NGN', flag: '🇳🇬' },
  { name: 'South Africa',     currency: 'ZAR', flag: '🇿🇦' },
  { name: 'Brazil',           currency: 'BRL', flag: '🇧🇷' },
  { name: 'Mexico',           currency: 'MXN', flag: '🇲🇽' },
  { name: 'Indonesia',        currency: 'IDR', flag: '🇮🇩' },
  { name: 'Philippines',      currency: 'PHP', flag: '🇵🇭' },
  { name: 'Thailand',         currency: 'THB', flag: '🇹🇭' },
  { name: 'Vietnam',          currency: 'VND', flag: '🇻🇳' },
  { name: 'Japan',            currency: 'JPY', flag: '🇯🇵' },
  { name: 'South Korea',      currency: 'KRW', flag: '🇰🇷' },
  { name: 'China',            currency: 'CNY', flag: '🇨🇳' },
  { name: 'Kenya',            currency: 'KES', flag: '🇰🇪' },
  { name: 'Egypt',            currency: 'EGP', flag: '🇪🇬' },
  { name: 'Turkey',           currency: 'TRY', flag: '🇹🇷' },
  { name: 'Switzerland',      currency: 'CHF', flag: '🇨🇭' },
  { name: 'Sweden',           currency: 'SEK', flag: '🇸🇪' },
  { name: 'Norway',           currency: 'NOK', flag: '🇳🇴' },
  { name: 'Denmark',          currency: 'DKK', flag: '🇩🇰' },
  { name: 'Poland',           currency: 'PLN', flag: '🇵🇱' },
  { name: 'New Zealand',      currency: 'NZD', flag: '🇳🇿' },
  { name: 'Other',            currency: 'USD', flag: '🌍' },
]

const INDUSTRIES = [
  'SaaS / Software', 'E-commerce / Retail', 'Consulting / Advisory',
  'Marketing / Advertising Agency', 'Healthcare / Medical', 'Real Estate',
  'Restaurant / Food & Beverage', 'Education / Training', 'Finance / Fintech',
  'Manufacturing', 'Logistics / Supply Chain', 'Media / Entertainment', 'Other',
]

const SIZES = [
  { value: '1', label: 'Just me' },
  { value: '2-10', label: '2–10 people' },
  { value: '11-50', label: '11–50 people' },
  { value: '51-200', label: '51–200 people' },
  { value: '201-500', label: '201–500 people' },
  { value: '500+', label: '500+ people' },
]

const inputCls = "w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors text-base"
const selectCls = "w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-violet-500 transition-colors appearance-none text-base"
const labelCls = "block text-sm font-semibold text-slate-700 mb-2"

export default function BusinessPage() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    industry: '',
    size: '2-10',
    target_customer: 'b2b',
    country: '',
    currency: 'USD',
    website_url: '',
    description: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Business name is required'); return }
    if (!form.industry) { setError('Please select your industry'); return }
    if (!form.country.trim()) { setError('Country is required'); return }
    if (!form.website_url.trim()) { setError('Website URL is required'); return }
    if (!/^https?:\/\/.+\..+/.test(form.website_url.trim())) { setError('Enter a valid URL (e.g. https://yourbusiness.com)'); return }

    startTransition(async () => {
      try {
        await saveBusiness({
          name: form.name.trim(),
          industry: form.industry,
          size: form.size,
          target_customer: form.target_customer,
          country: form.country.trim(),
          website_url: form.website_url.trim(),
          description: form.description.trim() || undefined,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))

  return (
    <div className="w-full max-w-2xl pt-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-10">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <div key={s} className={`h-1.5 rounded-full flex-1 transition-colors ${s <= 2 ? 'bg-violet-500' : 'bg-slate-200'}`} />
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6">
        <div>
          <p className="text-violet-600 text-sm font-semibold mb-1">Step 2 of 6</p>
          <h1 className="text-2xl font-bold text-slate-900">Tell me about your business</h1>
          <p className="text-slate-500 mt-1 text-base">This helps your AI agent understand your context.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Business Name */}
          <div>
            <label className={labelCls}>Business Name <span className="text-violet-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Acme Digital Agency"
              className={inputCls}
            />
          </div>

          {/* Industry + Size */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Industry <span className="text-violet-500">*</span></label>
              <select value={form.industry} onChange={e => set('industry', e.target.value)} className={selectCls}>
                <option value="">Select industry</option>
                {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Team Size</label>
              <select value={form.size} onChange={e => set('size', e.target.value)} className={selectCls}>
                {SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Target Customer + Country */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Target Customer</label>
              <div className="flex gap-2">
                {(['b2b', 'b2c', 'both'] as const).map(tc => (
                  <button
                    key={tc}
                    type="button"
                    onClick={() => set('target_customer', tc)}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-colors ${
                      form.target_customer === tc
                        ? 'bg-violet-600 border-violet-600 text-white'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-violet-300'
                    }`}
                  >
                    {tc.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Country <span className="text-violet-500">*</span></label>
              <select
                value={form.country}
                onChange={e => {
                  const selected = COUNTRY_CURRENCY.find(c => c.name === e.target.value)
                  set('country', e.target.value)
                  if (selected) set('currency', selected.currency)
                }}
                className={selectCls}
              >
                <option value="">Select country</option>
                {COUNTRY_CURRENCY.map(c => (
                  <option key={c.name} value={c.name}>{c.flag} {c.name} ({c.currency})</option>
                ))}
              </select>
              {form.country && (
                <p className="text-slate-400 text-xs mt-1.5">
                  Currency: <span className="text-violet-600 font-semibold">{form.currency}</span>
                </p>
              )}
            </div>
          </div>

          {/* Website URL */}
          <div>
            <label className={labelCls}>Website URL <span className="text-violet-500">*</span></label>
            <input
              type="url"
              value={form.website_url}
              onChange={e => set('website_url', e.target.value)}
              placeholder="https://yourbusiness.com"
              className={inputCls}
            />
            <p className="text-slate-400 text-xs mt-1.5">Used to run your business audit and AI analysis</p>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>What does your business do? <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Brief description of your products, services, or business model..."
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
          )}

          <div className="flex items-center justify-between pt-2">
            <a href="/onboarding/welcome" className="text-slate-400 hover:text-slate-600 text-sm transition-colors font-medium">
              ← Back
            </a>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold px-8 py-3 rounded-xl transition-all text-base"
            >
              {isPending ? 'Saving...' : 'Continue'}
              {!isPending && (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
