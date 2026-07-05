'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SiteFooter } from '@/components/layout/site-footer'

type Category = 'general' | 'sales' | 'support' | 'agency' | 'press' | 'legal'

const CATEGORIES: { value: Category; label: string; desc: string }[] = [
  { value: 'general',  label: '💬 General enquiry',      desc: 'Questions about CooVex' },
  { value: 'sales',    label: '💼 Sales & pricing',       desc: 'Talk to our sales team' },
  { value: 'support',  label: '🛠 Technical support',     desc: 'Help with your account' },
  { value: 'agency',   label: '🏢 Agency & white label',  desc: 'Reseller & partner enquiries' },
  { value: 'press',    label: '📰 Press & media',         desc: 'Media kit & interviews' },
  { value: 'legal',    label: '⚖️ Legal & privacy',        desc: 'GDPR, DPA requests' },
]

const EMAIL_MAP: Record<Category, string> = {
  general: 'hello@coovex.com',
  sales:   'sales@coovex.com',
  support: 'support@coovex.com',
  agency:  'agency@coovex.com',
  press:   'press@coovex.com',
  legal:   'legal@coovex.com',
}

export default function ContactPage() {
  const [category, setCategory]   = useState<Category>('general')
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [company, setCompany]     = useState('')
  const [message, setMessage]     = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading]     = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Placeholder — wire up to your email API (Resend, SendGrid, etc.)
    await new Promise(r => setTimeout(r, 1200))
    setSubmitted(true)
    setLoading(false)
  }

  const inp  = 'w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-violet-600 transition-colors'

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">

      {/* Nav */}
      <nav className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-white font-bold text-lg tracking-tight">⚡ CooVex</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/blog" className="text-slate-400 hover:text-white transition-colors">Guides</Link>
            <Link href="/login" className="text-slate-400 hover:text-white transition-colors">Login</Link>
            <Link href="/signup" className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">Start Free</Link>
          </div>
        </div>
      </nav>

      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-16">

        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-block bg-violet-900/30 border border-violet-700/40 text-violet-300 text-xs font-medium px-3 py-1.5 rounded-full mb-4">Get in touch</div>
          <h1 className="text-4xl font-bold text-white mb-3">Contact CooVex</h1>
          <p className="text-slate-400 max-w-md mx-auto text-sm leading-relaxed">
            Whether you&apos;re evaluating the platform, need support, or want to partner with us — we respond to every message.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-10">

          {/* ── Form ──────────────────────────────────────────────────── */}
          {submitted ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-bold text-white mb-2">Message sent!</h2>
              <p className="text-slate-400 text-sm mb-6 max-w-xs">
                Thanks for reaching out. We&apos;ll reply to <strong className="text-white">{email}</strong> within 1 business day.
              </p>
              <button
                onClick={() => { setSubmitted(false); setName(''); setEmail(''); setCompany(''); setMessage('') }}
                className="text-sm text-violet-400 hover:text-violet-300 border border-violet-800/50 px-4 py-2 rounded-lg transition-colors"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">

              {/* Category */}
              <div>
                <label className="block text-slate-400 text-xs mb-2">What&apos;s this about?</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIES.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      className={`text-left px-3 py-2.5 rounded-xl border text-xs transition-colors ${
                        category === c.value
                          ? 'bg-violet-600/20 border-violet-600 text-white'
                          : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      <div className="font-medium">{c.label}</div>
                      <div className="text-slate-500 mt-0.5 text-[10px]">{c.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name + email */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Full name <span className="text-red-500">*</span></label>
                  <input required value={name} onChange={e => setName(e.target.value)} placeholder="Sarah Johnson" className={inp} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Work email <span className="text-red-500">*</span></label>
                  <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="sarah@company.com" className={inp} />
                </div>
              </div>

              {/* Company */}
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Company / Agency</label>
                <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Corp" className={inp} />
              </div>

              {/* Message */}
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Message <span className="text-red-500">*</span></label>
                <textarea
                  required
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={5}
                  placeholder="Tell us what you need…"
                  className={`${inp} resize-none`}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-slate-600 text-xs">
                  Replies go to <span className="text-slate-500">{EMAIL_MAP[category]}</span>
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
                >
                  {loading ? 'Sending…' : 'Send Message →'}
                </button>
              </div>
            </form>
          )}

          {/* ── Sidebar ───────────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Response time */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-white font-semibold text-sm mb-4">Response times</h3>
              <div className="space-y-3">
                {[
                  { type: '💬 General',        time: '< 1 business day' },
                  { type: '🛠 Support',         time: '< 4 hours' },
                  { type: '💼 Sales',            time: '< 2 hours' },
                  { type: '🏢 Agency enquiries', time: '< 1 business day' },
                ].map(r => (
                  <div key={r.type} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{r.type}</span>
                    <span className="text-violet-400 font-medium">{r.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Direct emails */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-white font-semibold text-sm mb-4">Direct email</h3>
              <div className="space-y-2">
                {(Object.entries(EMAIL_MAP) as [Category, string][]).map(([key, addr]) => {
                  const cat = CATEGORIES.find(c => c.value === key)!
                  return (
                    <a key={key} href={`mailto:${addr}`} className="flex items-center justify-between text-xs group">
                      <span className="text-slate-400 group-hover:text-white transition-colors">{cat.label}</span>
                      <span className="text-slate-600 group-hover:text-violet-400 transition-colors">{addr}</span>
                    </a>
                  )
                })}
              </div>
            </div>

            {/* Quick links */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-white font-semibold text-sm mb-4">Helpful links</h3>
              <div className="space-y-2">
                {[
                  { label: '📖 Getting Started Guide', href: '/blog/getting-started' },
                  { label: '💰 Pricing & Plans',       href: '/pricing' },
                  { label: '🏢 Agency White Label',    href: '/blog/agency-white-label' },
                  { label: '⚖️ GDPR & Privacy',         href: '/gdpr' },
                ].map(l => (
                  <Link key={l.href} href={l.href} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
