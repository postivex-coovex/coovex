import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pricing — CooVex',
  description: 'Simple, transparent pricing for every stage of your business. Start free, upgrade when you\'re ready.',
  openGraph: {
    title: 'CooVex Pricing — Start Free, Grow with AI',
    description: 'Starter, Growth, Scale, and Agency plans. No contracts, cancel anytime.',
  },
}

const PLANS = [
  {
    name: 'Starter',
    price: 0,
    period: 'forever',
    badge: null,
    color: 'border-slate-700',
    cta: 'Get started free',
    ctaStyle: 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white',
    features: [
      '1 workspace',
      '1 business profile',
      'Website audit (1/month)',
      'CRM — up to 50 leads',
      'Content calendar (5 posts/month)',
      'Competitor tracking (2 competitors)',
      'Agent Inbox (read-only)',
      'Community support',
    ],
    limits: ['No AI generation', 'No review management', 'No analytics'],
  },
  {
    name: 'Growth',
    price: 49,
    period: 'per month',
    badge: 'Most Popular',
    color: 'border-violet-500',
    cta: 'Start 14-day free trial',
    ctaStyle: 'bg-violet-600 hover:bg-violet-500 text-white',
    features: [
      '1 workspace',
      '3 business profiles',
      'Website audit (unlimited)',
      'CRM — unlimited leads',
      'AI post generator (50 posts/month)',
      'AI fill calendar ("Fill My Month")',
      'Review management (all platforms)',
      'AI review response generator',
      'Competitor tracking (10 competitors)',
      'Agent Inbox + auto-scoring',
      'Analytics dashboard',
      'Trends intelligence feed',
      'Email support (24h SLA)',
    ],
    limits: [],
  },
  {
    name: 'Scale',
    price: 149,
    period: 'per month',
    badge: null,
    color: 'border-slate-700',
    cta: 'Start 14-day free trial',
    ctaStyle: 'bg-violet-600 hover:bg-violet-500 text-white',
    features: [
      'Everything in Growth',
      '3 workspaces',
      '10 business profiles',
      'AI post generator (unlimited)',
      'LinkedIn + Facebook publishing',
      'Team collaboration (5 seats)',
      'CRM import (CSV)',
      'Lead embed script for your website',
      'AI lead scoring engine',
      'Daily AI brief report',
      'Priority support (4h SLA)',
      'API access',
    ],
    limits: [],
  },
  {
    name: 'Agency',
    price: 399,
    period: 'per month',
    badge: 'Best for agencies',
    color: 'border-amber-600/50',
    cta: 'Contact sales',
    ctaStyle: 'bg-amber-600 hover:bg-amber-500 text-white',
    features: [
      'Everything in Scale',
      'Unlimited workspaces',
      'Unlimited business profiles',
      'White-label portal (custom domain)',
      'Client guest portal',
      'Unlimited team seats',
      'Multi-client dashboard',
      'Agency analytics (MRR, client health)',
      'Dedicated account manager',
      'Custom onboarding',
      'SLA guarantee (99.9% uptime)',
      'Phone + email support',
    ],
    limits: [],
  },
]

const FAQS = [
  { q: 'Is there a free trial?', a: 'Yes — Growth and Scale plans include a 14-day free trial. You get full access to all features during the trial and can cancel anytime.' },
  { q: 'Can I change plans later?', a: 'Absolutely. You can upgrade or downgrade at any time. Upgrades take effect immediately; downgrades apply at the next billing cycle.' },
  { q: 'What happens when my trial ends?', a: 'You\'ll be asked to add a payment method. If you don\'t, your account switches to the Starter (free) plan automatically — no data is lost.' },
  { q: 'Do you offer annual billing?', a: 'Yes — annual billing saves you 2 months (roughly 17% off). Contact us to switch to annual after signing up.' },
  { q: 'Is my data secure?', a: 'All data is encrypted at rest and in transit. We use Supabase (Postgres) hosted on AWS, and we never sell your data to third parties.' },
  { q: 'Does CooVex work for businesses outside the US?', a: 'Yes — CooVex is built for international businesses. UI supports multiple languages and the AI is aware of regional context.' },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-white font-semibold text-lg">CooVex</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-slate-400 hover:text-white text-sm transition-colors">Sign in</Link>
            <Link href="/signup" className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              Start free
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Simple, honest pricing
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Start free. Upgrade when your business is ready. No lock-in contracts, no hidden fees.
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-20">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className={`relative bg-slate-900 border ${plan.color} rounded-2xl p-6 flex flex-col ${plan.name === 'Growth' ? 'ring-1 ring-violet-500/40 shadow-lg shadow-violet-500/10' : ''}`}
            >
              {plan.badge && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${
                  plan.name === 'Growth' ? 'bg-violet-600 text-white' : 'bg-amber-600 text-white'
                }`}>
                  {plan.badge}
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-white font-bold text-lg mb-2">{plan.name}</h2>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-bold text-white">${plan.price}</span>
                  <span className="text-slate-500 text-sm mb-1">/{plan.period}</span>
                </div>
              </div>

              <Link
                href={plan.name === 'Agency' ? 'mailto:sales@coovex.com' : '/signup'}
                className={`block text-center text-sm font-medium px-4 py-2.5 rounded-lg transition-colors mb-6 ${plan.ctaStyle}`}
              >
                {plan.cta}
              </Link>

              <div className="flex-1 space-y-2.5">
                {plan.features.map(f => (
                  <div key={f} className="flex items-start gap-2 text-sm">
                    <span className="text-emerald-400 flex-shrink-0 mt-0.5">✓</span>
                    <span className="text-slate-300">{f}</span>
                  </div>
                ))}
                {plan.limits.map(l => (
                  <div key={l} className="flex items-start gap-2 text-sm">
                    <span className="text-slate-600 flex-shrink-0 mt-0.5">✕</span>
                    <span className="text-slate-600">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Feature comparison callout */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-20 text-center">
          <h2 className="text-white text-2xl font-bold mb-3">Not sure which plan is right?</h2>
          <p className="text-slate-400 mb-6 max-w-lg mx-auto">
            Start with the free Starter plan and upgrade when you need more. Most growing businesses find Growth covers everything they need.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/signup" className="bg-violet-600 hover:bg-violet-500 text-white font-medium px-6 py-3 rounded-xl transition-colors">
              Start free trial
            </Link>
            <a href="mailto:hello@coovex.com" className="border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white font-medium px-6 py-3 rounded-xl transition-colors">
              Talk to sales
            </a>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-10">Frequently asked questions</h2>
          <div className="space-y-4">
            {FAQS.map(faq => (
              <div key={faq.q} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-white font-semibold mb-2">{faq.q}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-20 py-10 text-center">
        <p className="text-slate-600 text-sm">© 2026 CooVex. All rights reserved.</p>
        <div className="flex justify-center gap-6 mt-3 text-sm">
          <Link href="/privacy" className="text-slate-600 hover:text-slate-400 transition-colors">Privacy</Link>
          <Link href="/terms" className="text-slate-600 hover:text-slate-400 transition-colors">Terms</Link>
          <a href="mailto:hello@coovex.com" className="text-slate-600 hover:text-slate-400 transition-colors">Contact</a>
        </div>
      </footer>
    </div>
  )
}
