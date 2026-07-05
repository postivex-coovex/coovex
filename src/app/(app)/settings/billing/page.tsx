'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Zap, TrendingUp, Crown, Building2, Check, ArrowRight, ShoppingCart, RefreshCw, Clock } from 'lucide-react'

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: 29,
    credits: 500,
    icon: Zap,
    color: 'blue',
    maxLeads: 100,
    maxCompetitors: 3,
    features: [
      '500 AI credits / month',
      '100 leads',
      '3 competitors monitored',
      'AI Coach & Daily Brief',
      'Website audit & GEO',
      'Basic analytics',
      '1 team member',
      'Email support',
    ],
  },
  {
    key: 'growth',
    name: 'Growth',
    price: 79,
    credits: 2000,
    icon: TrendingUp,
    color: 'violet',
    maxLeads: 500,
    maxCompetitors: 10,
    highlight: true,
    features: [
      '2,000 AI credits / month',
      '500 leads',
      '10 competitors monitored',
      'All AI features',
      'Cold lead finder',
      'Drip campaigns',
      'Revenue & forecast',
      '5 team members',
      'Priority support',
    ],
  },
  {
    key: 'scale',
    name: 'Scale',
    price: 149,
    credits: 6000,
    icon: Crown,
    color: 'amber',
    maxLeads: 2000,
    maxCompetitors: 25,
    features: [
      '6,000 AI credits / month',
      '2,000 leads',
      '25 competitors monitored',
      'White-label',
      'CRM integrations',
      'Proposals & AI reports',
      'NPS & reviews',
      '10 team members',
      'Dedicated support',
    ],
  },
  {
    key: 'agency',
    name: 'Agency',
    price: 299,
    credits: 20000,
    icon: Building2,
    color: 'emerald',
    maxLeads: -1,
    maxCompetitors: -1,
    features: [
      '20,000 AI credits / month',
      'Unlimited leads',
      'Unlimited competitors',
      'Full white-label + domain',
      'Multi-client dashboard',
      'All integrations',
      'Unlimited team members',
      'SLA + account manager',
    ],
  },
]

const CREDIT_PACKS = [
  { credits: 500,   price: 5,   bonus: '' },
  { credits: 1200,  price: 10,  bonus: '+200 bonus' },
  { credits: 3000,  price: 25,  bonus: '+500 bonus' },
  { credits: 7000,  price: 50,  bonus: '+2,000 bonus' },
  { credits: 15000, price: 100, bonus: '+5,000 bonus' },
]

const FEATURE_COSTS = [
  { name: 'AI Chat message',           cost: 2,  tier: 'light',  note: '~250/mo on Starter' },
  { name: 'Chat + tool action',        cost: 3,  tier: 'light',  note: 'e.g. create post via chat' },
  { name: 'Daily Brief',               cost: 5,  tier: 'light',  note: 'once per day' },
  { name: 'Lead AI scoring',           cost: 2,  tier: 'light',  note: 'per lead' },
  { name: 'Cold lead search',          cost: 10, tier: 'medium', note: 'Reddit / HN scan' },
  { name: 'Competitor full scan',      cost: 15, tier: 'medium', note: 'per scan' },
  { name: 'Website Audit',             cost: 20, tier: 'medium', note: 'full + GEO check' },
  { name: 'Report generation',         cost: 15, tier: 'medium', note: '' },
  { name: 'Proposal generation',       cost: 20, tier: 'medium', note: '' },
  { name: 'SWOT Analysis',             cost: 15, tier: 'tool',   note: '' },
  { name: 'Marketing Plan',            cost: 30, tier: 'tool',   note: '' },
  { name: 'Pitch Deck',                cost: 40, tier: 'tool',   note: '' },
  { name: 'Business Plan',             cost: 50, tier: 'tool',   note: '' },
]

const TIER_COLOR = {
  light:  'bg-blue-500/10 text-blue-400',
  medium: 'bg-amber-500/10 text-amber-400',
  tool:   'bg-violet-500/10 text-violet-400',
}

interface CreditData {
  balance: number
  monthly: number
  reset_at: string | null
  plan: string
  recent: { amount: number; feature?: string; description?: string; type: string; created_at: string }[]
}

interface ApiCost {
  id: string
  feature_key: string
  cost: number
  label: string
  tier: string
  note?: string
}

const colorMap = {
  blue:   { card: 'border-blue-800/40 bg-blue-950/20',   badge: 'bg-blue-500/20 text-blue-300',   btn: 'bg-blue-600 hover:bg-blue-500' },
  violet: { card: 'border-violet-700/40 bg-violet-950/30', badge: 'bg-violet-500/20 text-violet-300', btn: 'bg-violet-600 hover:bg-violet-500' },
  amber:  { card: 'border-amber-800/40 bg-amber-950/20', badge: 'bg-amber-500/20 text-amber-300', btn: 'bg-amber-600 hover:bg-amber-500' },
  emerald:{ card: 'border-emerald-800/40 bg-emerald-950/20', badge: 'bg-emerald-500/20 text-emerald-300', btn: 'bg-emerald-600 hover:bg-emerald-500' },
}

export default function BillingPage() {
  const [credits, setCredits] = useState<CreditData | null>(null)
  const [apiCosts, setApiCosts] = useState<ApiCost[] | null>(null)

  useEffect(() => {
    fetch('/api/credits/balance').then(r => r.json()).then(setCredits).catch(() => {})
    fetch('/api/pricing').then(r => r.json()).then(d => setApiCosts(d.costs ?? null)).catch(() => {})
  }, [])

  const pct = credits ? Math.min(100, Math.round((credits.balance / Math.max(credits.monthly, 1)) * 100)) : 0
  const daysToReset = credits?.reset_at
    ? Math.max(0, Math.ceil((new Date(credits.reset_at).getTime() - Date.now()) / 86400000))
    : null

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing & Credits</h1>
        <p className="text-slate-400 text-sm mt-0.5">Manage your plan, AI credits, and usage.</p>
      </div>

      {/* Credit balance card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-1">AI Credits Balance</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-white">{credits?.balance?.toLocaleString() ?? '—'}</span>
              <span className="text-slate-500 text-sm">/ {credits?.monthly?.toLocaleString() ?? '—'} monthly</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 flex items-center gap-1 justify-end">
              <RefreshCw className="w-3 h-3" />
              <span>{daysToReset !== null ? `Resets in ${daysToReset} days` : 'Refreshes monthly'}</span>
            </div>
            <p className="text-xs text-slate-600 mt-1 capitalize">Plan: {credits?.plan ?? '—'}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
          <div
            className={`h-2 rounded-full transition-all ${pct > 75 ? 'bg-emerald-500' : pct > 30 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-slate-500">{pct}% remaining</p>

        {/* Recent usage */}
        {credits?.recent && credits.recent.length > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-800">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Recent usage</p>
            <div className="space-y-2">
              {credits.recent.slice(0, 6).map((tx, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${tx.amount < 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {tx.amount < 0 ? tx.amount : `+${tx.amount}`}
                    </span>
                    <span className="text-slate-300">{tx.description ?? tx.feature ?? tx.type}</span>
                  </div>
                  <span className="text-slate-600 text-xs">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Plans */}
      <div>
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
          Choose a Plan
          <span className="text-xs text-slate-500 font-normal">· All plans include monthly credit refresh</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLANS.map(plan => {
            const c = colorMap[plan.color as keyof typeof colorMap]
            const Icon = plan.icon
            const isCurrent = credits?.plan === plan.key
            return (
              <div key={plan.key} className={`relative rounded-2xl border p-5 flex flex-col ${plan.highlight ? c.card : 'bg-slate-900 border-slate-800'}`}>
                {plan.highlight && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold ${c.badge}`}>
                    Most Popular
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 right-4 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400">
                    Current
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.badge}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-white font-bold">{plan.name}</h3>
                </div>
                <div className="mb-1">
                  <span className="text-3xl font-bold text-white">${plan.price}</span>
                  <span className="text-slate-500 text-sm">/mo</span>
                </div>
                <div className={`text-xs font-semibold mb-4 ${c.badge.split(' ')[1]}`}>
                  <Zap className="w-3 h-3 inline mr-1" />
                  {plan.credits.toLocaleString()} credits/month
                </div>
                <ul className="space-y-1.5 flex-1 mb-5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-400">
                      <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  disabled
                  className={`w-full py-2 rounded-xl text-sm font-semibold text-white transition-colors cursor-not-allowed opacity-60 ${c.btn}`}
                >
                  {isCurrent ? 'Current Plan' : `Upgrade — coming soon`}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Credit top-up packs */}
      <div>
        <h2 className="text-white font-semibold mb-1">Buy Extra Credits</h2>
        <p className="text-slate-500 text-sm mb-4">Credits never expire. Stack them on top of your monthly allowance.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {CREDIT_PACKS.map(pack => (
            <button
              key={pack.price}
              disabled
              className="flex flex-col items-center p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-violet-700 transition-colors cursor-not-allowed opacity-70 text-center group"
            >
              <div className="flex items-center gap-1 mb-1">
                <ShoppingCart className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-white font-bold">{pack.credits.toLocaleString()}</span>
              </div>
              <span className="text-slate-500 text-xs mb-2">credits</span>
              {pack.bonus && <span className="text-emerald-400 text-xs mb-2">{pack.bonus}</span>}
              <span className="text-violet-400 font-bold text-sm">${pack.price}</span>
              <span className="text-slate-600 text-xs mt-1">${(pack.price / pack.credits).toFixed(4)}/cr</span>
            </button>
          ))}
        </div>
        <p className="text-slate-600 text-xs mt-3">
          <Clock className="w-3 h-3 inline mr-1" />
          Stripe integration coming soon — email <a href="mailto:billing@coovex.com" className="text-violet-400">billing@coovex.com</a> to purchase manually.
        </p>
      </div>

      {/* Credit cost reference */}
      {(() => {
        const rows = apiCosts
          ? apiCosts.map(c => ({ key: c.feature_key, label: c.label, cost: c.cost, tier: c.tier, note: c.note ?? '' }))
          : FEATURE_COSTS.map(f => ({ key: f.name, label: f.name, cost: f.cost, tier: f.tier, note: f.note }))
        return (
          <div>
            <h2 className="text-white font-semibold mb-4">Credit Cost per Feature</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-slate-800">
                {rows.map(f => (
                  <div key={f.key} className="bg-slate-900 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-slate-300 text-sm">{f.label}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${TIER_COLOR[f.tier as keyof typeof TIER_COLOR]}`}>
                          {f.tier}
                        </span>
                        {f.note && <span className="text-slate-600 text-xs">{f.note}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-bold">{f.cost}</span>
                      <p className="text-slate-600 text-xs">credits</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      <div className="text-center text-slate-600 text-xs pb-4">
        Questions? <a href="mailto:billing@coovex.com" className="text-violet-400 hover:text-violet-300">billing@coovex.com</a>
        {' · '}
        <Link href="/settings" className="text-slate-500 hover:text-slate-300">← Back to Settings</Link>
      </div>
    </div>
  )
}
