'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

function SelectDropdown({
  value, onChange, options, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-left transition-colors focus:outline-none ${open ? 'border-blue-500' : 'border-slate-700 hover:border-slate-600'}`}
      >
        <span className={value ? 'text-white' : 'text-slate-500'}>{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt} type="button"
              onClick={() => { onChange(opt); setOpen(false) }}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm text-left transition-colors ${
                value === opt
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-200 hover:bg-slate-700'
              }`}
            >
              <span>{opt}</span>
              {value === opt && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const SERVICE_TYPES = [
  'CRM Integration (HubSpot, Pipedrive, Salesforce)',
  'Payment Gateway (Stripe, PayPal, Razorpay)',
  'E-commerce (Shopify, WooCommerce)',
  'Email Marketing (Mailchimp, Klaviyo, SendGrid)',
  'Social Media (LinkedIn, Facebook, Instagram)',
  'Accounting (QuickBooks, Xero)',
  'Communication (Slack, Teams, WhatsApp)',
  'Custom API / Webhook',
  'Other',
]

const BUDGET_RANGES = [
  'Under $200',
  '$200 – $500',
  '$500 – $1,000',
  '$1,000 – $3,000',
  '$3,000+',
  'Not decided yet',
]

export function IntegrationServiceWidget() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    service_type: '',
    description: '',
    budget: '',
  })
  const [error, setError] = useState('')

  function reset() {
    setStep('form')
    setForm({ name: '', email: '', service_type: '', description: '', budget: '' })
    setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.service_type || !form.description) {
      setError('Please fill in all required fields.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/integration-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed')
      setStep('success')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const f = (key: keyof typeof form, val: string) => setForm(p => ({ ...p, [key]: val }))

  return (
    <>
      {/* Floating button — sits above AI Coach (bottom-20) */}
      <button
        onClick={() => { reset(); setOpen(true) }}
        className="fixed bottom-20 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl font-medium text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/60 transition-all duration-200"
      >
        <span className="text-base">🔧</span>
        <span>Setup & Integration</span>
      </button>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-lg">🔧</div>
                <div>
                  <p className="text-white font-semibold text-sm">Setup & Integration Inquiry</p>
                  <p className="text-slate-500 text-xs">Tell us what you need — we will set it up for you</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors">✕</button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {step === 'success' ? (
                <div className="text-center py-6">
                  <div className="text-5xl mb-4">✅</div>
                  <p className="text-white font-bold text-lg mb-2">Inquiry Received!</p>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    We will review your request and send a budget proposal to your email within 24 hours.
                  </p>
                  <button
                    onClick={() => setOpen(false)}
                    className="mt-6 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 font-medium block mb-1">Your Name <span className="text-red-400">*</span></label>
                      <input
                        value={form.name}
                        onChange={e => f('name', e.target.value)}
                        placeholder="John Smith"
                        className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-medium block mb-1">Email <span className="text-red-400">*</span></label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={e => f('email', e.target.value)}
                        placeholder="you@company.com"
                        className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1">Integration Needed <span className="text-red-400">*</span></label>
                    <SelectDropdown
                      value={form.service_type}
                      onChange={v => f('service_type', v)}
                      options={SERVICE_TYPES}
                      placeholder="Select integration type…"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1">What do you need? <span className="text-red-400">*</span></label>
                    <textarea
                      value={form.description}
                      onChange={e => f('description', e.target.value)}
                      placeholder="Describe what you want to connect and what data should flow between the systems…"
                      rows={3}
                      className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none transition-colors resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1">Budget Range</label>
                    <div className="grid grid-cols-3 gap-2">
                      {BUDGET_RANGES.map(b => (
                        <button
                          key={b} type="button"
                          onClick={() => f('budget', b)}
                          className={`text-xs px-2 py-2 rounded-xl border transition-all text-center ${
                            form.budget === b
                              ? 'bg-blue-600 border-blue-500 text-white font-semibold'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && <p className="text-red-400 text-xs bg-red-950/30 border border-red-800/30 rounded-xl px-3 py-2">{error}</p>}

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
                    >
                      {loading ? 'Sending…' : 'Send Inquiry →'}
                    </button>
                  </div>
                  <p className="text-slate-600 text-[10px] text-center">We respond within 24 hours with a detailed proposal.</p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
