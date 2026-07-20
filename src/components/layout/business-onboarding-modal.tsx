'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Zap, Building2, Users2, Target, TrendingUp,
  ChevronRight, ArrowLeft, Loader2, CheckCircle2,
  Plus, Trash2, Link2,
} from 'lucide-react'

/* ── Types ──────────────────────────────────────────────────────────── */
interface Props {
  open: boolean
  businessName: string
  previousWorkspaceId: string | null
  onContinue: () => void
}

interface Step1Form {
  name:               string
  website_url:        string
  pricing_page_url:   string
  service_page_url:   string
  business_stage:     string
  current_mrr:        string
  currency:           string
  target_market:      string
  knows_icp:          boolean
  knows_competitors:  boolean
  has_marketing_plan: boolean
}

interface PricingPackage {
  name:  string
  price: string
  plan:  'monthly' | 'yearly' | 'onetime'
}

const CURRENCIES = [
  { value: 'USD', label: '$ USD — US Dollar' },
  { value: 'EUR', label: '€ EUR — Euro' },
  { value: 'GBP', label: '£ GBP — British Pound' },
  { value: 'CAD', label: '$ CAD — Canadian Dollar' },
  { value: 'AUD', label: '$ AUD — Australian Dollar' },
  { value: 'BDT', label: '৳ BDT — Bangladeshi Taka' },
  { value: 'INR', label: '₹ INR — Indian Rupee' },
  { value: 'SGD', label: '$ SGD — Singapore Dollar' },
  { value: 'AED', label: 'د.إ AED — UAE Dirham' },
  { value: 'MYR', label: 'RM MYR — Malaysian Ringgit' },
]

const TARGET_MARKETS = [
  'Global', 'Local Market',
  'United States', 'United Kingdom', 'Canada', 'Australia',
  'European Union', 'South Asia (BD/IN/PK)', 'Southeast Asia',
  'Middle East', 'Africa', 'Latin America',
]

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Angola','Argentina','Armenia','Australia',
  'Austria','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Bolivia',
  'Bosnia & Herzegovina','Brazil','Bulgaria','Cambodia','Cameroon','Canada',
  'Chile','China','Colombia','Congo','Costa Rica','Croatia','Cuba','Cyprus',
  'Czech Republic','Denmark','Ecuador','Egypt','El Salvador','Estonia',
  'Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece',
  'Guatemala','Honduras','Hungary','India','Indonesia','Iraq','Ireland',
  'Israel','Italy','Ivory Coast','Jamaica','Japan','Jordan','Kazakhstan',
  'Kenya','Kuwait','Kyrgyzstan','Latvia','Lebanon','Libya','Lithuania',
  'Luxembourg','Malaysia','Mali','Malta','Mexico','Moldova','Mongolia',
  'Morocco','Mozambique','Myanmar','Nepal','Netherlands','New Zealand',
  'Nicaragua','Nigeria','Norway','Oman','Pakistan','Palestine','Panama',
  'Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania',
  'Russia','Rwanda','Saudi Arabia','Senegal','Serbia','Singapore',
  'Slovakia','Slovenia','Somalia','South Africa','South Korea','Spain',
  'Sri Lanka','Sudan','Sweden','Switzerland','Syria','Taiwan','Tajikistan',
  'Tanzania','Thailand','Tunisia','Turkey','Turkmenistan','Uganda','Ukraine',
  'United Arab Emirates','United Kingdom','United States','Uruguay',
  'Uzbekistan','Venezuela','Vietnam','Yemen','Zimbabwe',
]

const STAGES = [
  { value: 'idea',              label: 'Idea Stage',         desc: 'Still validating the concept' },
  { value: 'beta',              label: 'Beta / Testing',     desc: 'Have a product, getting feedback' },
  { value: 'live_no_users',     label: 'Live — No Revenue',  desc: 'Launched but no paying users yet' },
  { value: 'live_transactions', label: 'Live — With Revenue',desc: 'Generating transactions / MRR' },
]

const STEPS_META = [
  { icon: Building2,  label: 'Provide your business details',    desc: 'Help AI understand what your business does and who you serve.' },
  { icon: Users2,     label: 'Setup your competitors with AI',   desc: 'AI discovers and tracks your top competitors in real-time.' },
  { icon: Target,     label: 'Setup your goal with AI',          desc: 'Set a target MRR and let AI map the path to get there.' },
  { icon: TrendingUp, label: 'Follow & accept AI actions',       desc: 'Review daily AI actions and watch your business grow.' },
]

/* ── Toggle component ───────────────────────────────────────────────── */
function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-4 p-3.5 rounded-xl border transition-all text-left"
      style={{ borderColor: checked ? '#7c3aed' : '#e2e8f0', background: checked ? '#f5f3ff' : '#f8fafc' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-xs font-bold transition-colors ${checked ? 'text-violet-600' : 'text-slate-400'}`}>
          {checked ? 'Yes' : 'No'}
        </span>
        <div
          className="relative rounded-full transition-colors duration-200"
          style={{ background: checked ? '#7c3aed' : '#cbd5e1', width: 40, height: 22 }}
        >
          <div
            className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
            style={{ transform: checked ? 'translateX(20px)' : 'translateX(2px)', margin: 1 }}
          />
        </div>
      </div>
    </button>
  )
}

/* ── Switch Business Button ─────────────────────────────────────────── */
function SwitchBusinessButton({
  previousWorkspaceId,
  onSwitch,
  switching,
}: {
  previousWorkspaceId: string | null
  onSwitch: () => void
  switching: boolean
}) {
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<{ workspace_id: string; business_name: string; is_current: boolean }[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function fetchWorkspaces() {
    setLoading(true)
    const res = await fetch('/api/workspaces')
    const data = await res.json() as { workspaces?: typeof workspaces }
    setWorkspaces((data.workspaces ?? []).filter(w => !w.is_current))
    setLoading(false)
    setOpen(true)
  }

  async function switchTo(wsId: string) {
    await fetch('/api/workspaces/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: wsId }),
    })
    router.refresh()
    router.push('/dashboard')
  }

  if (previousWorkspaceId) {
    return (
      <button onClick={onSwitch} disabled={switching}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-500 mt-3 py-1.5 transition-colors disabled:opacity-50">
        <ArrowLeft className="w-3 h-3" />
        {switching ? 'Switching back…' : 'Cancel — go back to previous business'}
      </button>
    )
  }

  return (
    <div className="mt-3">
      {!open ? (
        <button
          onClick={fetchWorkspaces}
          className="w-full text-xs text-slate-400 hover:text-slate-600 py-1.5 transition-colors"
        >
          {loading ? 'Loading…' : '↩ Switch to another business'}
        </button>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <p className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-200">
            Switch to existing business
          </p>
          {workspaces.length === 0 ? (
            <p className="px-3 py-3 text-xs text-slate-400 text-center">No other businesses found.</p>
          ) : (
            workspaces.map(ws => (
              <button
                key={ws.workspace_id}
                onClick={() => switchTo(ws.workspace_id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-0"
              >
                <span className="text-base">🏢</span>
                <span className="text-sm text-slate-700 font-medium">{ws.business_name}</span>
                <span className="ml-auto text-xs text-violet-600">Switch →</span>
              </button>
            ))
          )}
          <button onClick={() => setOpen(false)} className="w-full text-xs text-slate-400 py-2 hover:text-slate-600 transition-colors">
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Main modal ─────────────────────────────────────────────────────── */
export function BusinessOnboardingModal({ open, businessName, previousWorkspaceId, onContinue }: Props) {
  const router = useRouter()
  const [step, setStep]           = useState<'overview' | 'step1' | 'step2' | 'step3' | 'step4'>('overview')
  const [saving, setSaving]       = useState(false)
  const [competitorUrls, setCompetitorUrls] = useState<string[]>([''])

  // Step 3 — Goal states
  const [mrrTarget,      setMrrTarget]      = useState('')
  const [mrrPeriod,      setMrrPeriod]      = useState<'monthly' | 'quarterly' | 'yearly'>('monthly')
  const [goalTimeframe,  setGoalTimeframe]  = useState<'3m' | '6m' | '1y' | '2y' | ''>('')
  const [extraGoals,     setExtraGoals]     = useState({
    leads:   { on: false, target: '50',  period: 'monthly' as 'monthly' | 'quarterly' | 'yearly' },
    content: { on: false, target: '12',  period: 'monthly' as 'monthly' | 'quarterly' | 'yearly' },
    reviews: { on: false, target: '20',  period: 'monthly' as 'monthly' | 'quarterly' | 'yearly' },
  })
  const [localCountry, setLocalCountry]     = useState('')
  const [pricingMode, setPricingMode]       = useState<'url' | 'manual' | 'none'>('url')
  const [pricingPackages, setPricingPackages] = useState<PricingPackage[]>([
    { name: '', price: '', plan: 'monthly' },
  ])
  const [switching, setSwitching] = useState(false)
  const [loadingBiz, setLoadingBiz] = useState(false)
  const [errors, setErrors]       = useState<Partial<Step1Form>>({})
  const [step3Error, setStep3Error] = useState('')

  const [form, setForm] = useState<Step1Form>({
    name:               businessName,
    website_url:        '',
    pricing_page_url:   '',
    service_page_url:   '',
    business_stage:     '',
    current_mrr:        '',
    currency:           'USD',
    target_market:      '',
    knows_icp:          false,
    knows_competitors:  false,
    has_marketing_plan: false,
  })

  // Auto-fill step3 from saved goals + step1 MRR when entering step3
  useEffect(() => {
    if (step !== 'step3') return
    fetch('/api/goals')
      .then(r => r.json())
      .then(({ goals }) => {
        if (!Array.isArray(goals) || goals.length === 0) {
          // Fall back to step1 current_mrr
          if (form.current_mrr && !mrrTarget) setMrrTarget(form.current_mrr)
          return
        }
        const rev = goals.find((g: { category: string }) => g.category === 'revenue')
        if (rev) {
          setMrrTarget(String(rev.target))
          setMrrPeriod(rev.period)
        } else if (form.current_mrr && !mrrTarget) {
          setMrrTarget(form.current_mrr)
        }
        const leadsGoal   = goals.find((g: { category: string }) => g.category === 'leads')
        const contentGoal = goals.find((g: { category: string }) => g.category === 'content')
        const reviewGoal  = goals.find((g: { category: string }) => g.category === 'reviews')
        setExtraGoals(prev => ({
          leads:   leadsGoal   ? { on: true, target: String(leadsGoal.target),   period: leadsGoal.period   } : prev.leads,
          content: contentGoal ? { on: true, target: String(contentGoal.target), period: contentGoal.period } : prev.content,
          reviews: reviewGoal  ? { on: true, target: String(reviewGoal.target),  period: reviewGoal.period  } : prev.reviews,
        }))
      })
      .catch(() => {
        if (form.current_mrr && !mrrTarget) setMrrTarget(form.current_mrr)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Auto-fill from DB when entering step1
  useEffect(() => {
    if (step !== 'step1') return
    setLoadingBiz(true)
    fetch('/api/business/profile')
      .then(r => r.json())
      .then(({ business }) => {
        if (!business) return
        setForm(f => ({
          ...f,
          name:               business.name               ?? f.name,
          website_url:        business.website_url        ?? '',
          pricing_page_url:   business.pricing_page_url   ?? '',
          service_page_url:   business.service_page_url   ?? '',
          business_stage:     business.business_stage     ?? '',
          current_mrr:        business.current_mrr != null ? String(business.current_mrr) : '',
          currency:           business.currency           ?? 'USD',
          target_market:      business.target_market      ?? '',
          knows_icp:          business.knows_icp          ?? false,
          knows_competitors:  business.knows_competitors  ?? false,
          has_marketing_plan: business.has_marketing_plan ?? false,
        }))
        if (business.pricing_mode) setPricingMode(business.pricing_mode)
        if (business.pricing_packages?.length) setPricingPackages(business.pricing_packages)
        // Restore local country if previously saved as "Local: CountryName"
        if (business.target_market?.startsWith('Local: ')) {
          setLocalCountry(business.target_market.replace('Local: ', ''))
          setForm(f => ({ ...f, target_market: 'Local Market' }))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingBiz(false))
  }, [step])

  if (!open) return null

  function set(field: keyof Step1Form, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: undefined }))
  }

  function validate(): boolean {
    const e: Partial<Step1Form> = {}
    if (!form.name.trim())             e.name = 'Required'
    if (!form.website_url.trim())      e.website_url = 'Required'
    if (pricingMode === 'url' && !form.pricing_page_url.trim()) e.pricing_page_url = 'Required'
    if (!form.service_page_url.trim()) e.service_page_url = 'Required'
    if (!form.business_stage)          e.business_stage = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function saveStep1() {
    if (!validate()) return
    setSaving(true)
    try {
      const packages = pricingMode === 'manual'
        ? pricingPackages.filter(p => p.name.trim())
        : null

      const resolvedMarket = form.target_market === 'Local Market'
        ? (localCountry ? `Local: ${localCountry}` : 'Local Market')
        : form.target_market

      const res = await fetch('/api/onboarding/step1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          target_market:    resolvedMarket,
          pricing_page_url: pricingMode === 'url' ? form.pricing_page_url : null,
          pricing_packages: packages,
          pricing_mode:     pricingMode,
          current_mrr:      form.current_mrr ? parseFloat(form.current_mrr) : null,
        }),
      })
      if (!res.ok) return
      if (form.knows_competitors) {
        setStep('step2')
      } else {
        setStep('step3')
      }
    } finally {
      setSaving(false)
    }
  }

  async function saveStep2() {
    const urls = competitorUrls.map(u => u.trim()).filter(Boolean)
    if (!urls.length) { setStep('step3'); return }
    setSaving(true)
    try {
      await fetch('/api/onboarding/step2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      })
      setStep('step3')
    } finally {
      setSaving(false)
    }
  }

  function addCompetitorUrl() {
    setCompetitorUrls(us => [...us, ''])
  }

  function removeCompetitorUrl(i: number) {
    setCompetitorUrls(us => us.filter((_, idx) => idx !== i))
  }

  function setCompetitorUrl(i: number, val: string) {
    setCompetitorUrls(us => us.map((u, idx) => idx === i ? val : u))
  }

  async function saveStep3() {
    if (!mrrTarget || parseFloat(mrrTarget) <= 0) {
      setStep3Error('Please enter your MRR target to continue.')
      return
    }
    setStep3Error('')
    setSaving(true)
    try {
      const timeframeDue: Record<string, string> = {
        '3m': new Date(Date.now() + 90  * 86400000).toISOString().slice(0, 10),
        '6m': new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
        '1y': new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
        '2y': new Date(Date.now() + 730 * 86400000).toISOString().slice(0, 10),
      }
      const due = goalTimeframe ? timeframeDue[goalTimeframe] : undefined

      // Fetch existing goals so we don't wipe them
      let existingGoals: unknown[] = []
      try {
        const r = await fetch('/api/goals')
        const d = await r.json() as { goals?: unknown[] }
        existingGoals = d.goals ?? []
      } catch { /* ignore */ }

      const newGoals: unknown[] = []

      if (mrrTarget && parseFloat(mrrTarget) > 0) {
        // Replace existing revenue goal if present
        const existing = (existingGoals as { category: string; id: string }[]).find(g => g.category === 'revenue')
        newGoals.push({
          id:       existing?.id ?? `onb-mrr-${Date.now()}`,
          title:    `Reach ${form.currency} ${Number(mrrTarget).toLocaleString()} MRR`,
          category: 'revenue',
          period:   mrrPeriod,
          target:   parseFloat(mrrTarget),
          unit:     form.currency || 'USD',
          due,
        })
      }

      const extraMeta = {
        leads:   { title: 'Generate new leads',    unit: 'leads' },
        content: { title: 'Publish content posts', unit: 'posts' },
        reviews: { title: 'Collect reviews',       unit: 'reviews' },
      } as const

      for (const [cat, g] of Object.entries(extraGoals) as [keyof typeof extraMeta, typeof extraGoals[keyof typeof extraGoals]][]) {
        if (g.on && g.target && parseInt(g.target) > 0) {
          const existing = (existingGoals as { category: string; id: string }[]).find(e => e.category === cat)
          newGoals.push({
            id:       existing?.id ?? `onb-${cat}-${Date.now()}`,
            title:    extraMeta[cat].title,
            category: cat,
            period:   g.period,
            target:   parseInt(g.target),
            unit:     extraMeta[cat].unit,
            due,
          })
        }
      }

      // Merge: keep non-overlapping existing goals + new/updated ones
      const newCats = new Set(newGoals.map((g) => (g as { category: string }).category))
      const kept    = existingGoals.filter(g => !newCats.has((g as { category: string }).category))
      const merged  = [...kept, ...newGoals]

      if (merged.length > 0) {
        await fetch('/api/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goals: merged }),
        })
      }

      setStep('step4')
    } finally {
      setSaving(false)
    }
  }

  async function finishOnboarding() {
    setSaving(true)
    try {
      await fetch('/api/onboarding/complete', { method: 'POST' })
      onContinue()
    } finally {
      setSaving(false)
    }
  }

  async function handleDismiss() {
    if (!previousWorkspaceId) return
    setSwitching(true)
    try {
      await fetch('/api/workspaces/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: previousWorkspaceId }),
      })
      router.refresh()
      router.push('/dashboard')
    } finally {
      setSwitching(false)
    }
  }

  /* ── Shared shell ─────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Gradient bar */}
        <div className="h-1 flex-shrink-0 bg-gradient-to-r from-violet-600 via-blue-500 to-violet-600" />

        {/* ── OVERVIEW ── */}
        {step === 'overview' && (
          <div className="p-8 overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <span className="text-xs font-semibold text-violet-600 uppercase tracking-widest">New Business Setup</span>
                <p className="text-base font-bold text-slate-900 leading-tight mt-0.5">{businessName}</p>
              </div>
            </div>

            <h2 className="text-2xl font-extrabold text-slate-900 leading-tight mb-3">
              AI Can Monitor Your Business &amp; Guide You to Your Target MRR
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-7">
              Complete these 4 quick steps and your AI agent will start working 24/7 — tracking competitors, scoring leads, and sending you daily briefings tailored to your business.
            </p>

            <div className="space-y-2.5 mb-8">
              {STEPS_META.map((s, i) => {
                const Icon = s.icon
                return (
                  <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <Icon className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{s.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5 leading-snug">{s.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              onClick={() => setStep('step1')}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
            >
              Start &amp; Continue <ChevronRight className="w-4 h-4" />
            </button>

            <SwitchBusinessButton previousWorkspaceId={previousWorkspaceId} onSwitch={handleDismiss} switching={switching} />
          </div>
        )}

        {/* ── STEP 4 ── */}
        {step === 'step4' && (
          <>
            <div className="px-8 pt-6 pb-4 flex-shrink-0 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                {STEPS_META.map((_, i) => (
                  <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-100">
                    <div className="h-full rounded-full bg-violet-600" />
                  </div>
                ))}
              </div>
              <span className="text-xs font-bold text-violet-600 uppercase tracking-widest">Step 4 of 4 — Final</span>
              <h3 className="text-xl font-extrabold text-slate-900 mt-1">Launch Your AI Business Agent</h3>
              <p className="text-xs text-slate-400 mt-0.5">Complete each task once. CooVex AI runs them 24/7 for you after setup.</p>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-5 space-y-4">
              {/* Hero banner */}
              <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-4 text-white">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-sm leading-snug" style={{ color: '#ffffff' }}>Train once. AI works for your business every single day.</p>
                    <p className="text-white/90 text-xs mt-1 leading-relaxed">
                      After this setup, CooVex AI will autonomously track competitors, generate content, score leads, and send you a daily briefing — all without you lifting a finger.
                    </p>
                  </div>
                </div>
              </div>

              {/* Task grid */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Your AI Training Checklist</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { n: 1,  icon: '🔍', title: 'Website Analysis',          desc: 'AI learns your brand, voice & positioning.',               ai: true  },
                    { n: 2,  icon: '📦', title: 'Add Products & Services',    desc: 'Help AI know what you sell for better targeting.',          ai: false },
                    { n: 3,  icon: '🔗', title: 'Connect Social Profiles',    desc: 'AI monitors & generates social content daily.',            ai: true  },
                    { n: 4,  icon: '🕵️', title: 'Competitor Analysis',        desc: 'AI tracks rivals, pricing & content in real-time.',        ai: true  },
                    { n: 5,  icon: '🎯', title: 'ICP Building with AI',       desc: 'Define who you serve — AI targets them precisely.',        ai: true  },
                    { n: 6,  icon: '📋', title: 'Create Marketing Plan',      desc: 'AI builds a growth plan based on your goals & market.',    ai: true  },
                    { n: 7,  icon: '👥', title: 'Find 10–20 Leads',           desc: 'AI discovers qualified leads from your target market.',    ai: true  },
                    { n: 8,  icon: '📧', title: 'Connect Email SMTP',         desc: 'Set up email so AI runs campaigns from your domain.',      ai: false },
                    { n: 9,  icon: '📄', title: 'Send First Proposal',        desc: 'AI generates a tracked proposal — impress your client.',   ai: true  },
                    { n: 10, icon: '🔄', title: 'Integrate Your CRM',         desc: 'AI learns from every deal and improves daily advice.',     ai: false },
                  ]).map(({ n, icon, title, desc, ai }) => (
                    <div
                      key={n}
                      className="flex gap-3 p-3.5 rounded-xl border border-slate-100 bg-slate-50 hover:border-violet-200 hover:bg-violet-50/50 transition-all"
                    >
                      <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5">
                        <div className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px] font-extrabold">
                          {n}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-base leading-none">{icon}</span>
                          <p className="text-xs font-bold text-slate-800 leading-tight">{title}</p>
                          {ai && (
                            <span className="flex-shrink-0 text-[9px] font-bold bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded uppercase tracking-wide">AI</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom note */}
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <p className="text-xs text-emerald-700 font-medium">These tasks appear in your Dashboard. Complete them in any order — AI starts working immediately after each one.</p>
              </div>
            </div>

            <div className="px-8 py-5 flex-shrink-0 border-t border-slate-100 space-y-2">
              <button
                onClick={finishOnboarding}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all text-sm shadow-lg shadow-violet-200"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Launching…</>
                  : <><span className="text-base">🚀</span> Finish Setup &amp; Launch AI</>
                }
              </button>
              <button
                onClick={() => setStep('step3')}
                className="w-full text-xs text-slate-400 hover:text-slate-500 transition-colors py-1 flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> Back to Goals
              </button>
            </div>
          </>
        )}

        {/* ── STEP 3 ── */}
        {step === 'step3' && (
          <>
            <div className="px-8 pt-6 pb-4 flex-shrink-0 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                {STEPS_META.map((_, i) => (
                  <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-100">
                    <div className={`h-full rounded-full transition-all ${i <= 2 ? 'bg-violet-600' : 'bg-transparent'}`} />
                  </div>
                ))}
              </div>
              <span className="text-xs font-bold text-violet-600 uppercase tracking-widest">Step 3 of 4</span>
              <h3 className="text-lg font-extrabold text-slate-900 mt-1">Set your growth goals</h3>
              <p className="text-xs text-slate-400 mt-0.5">AI will track progress and give you a daily execution plan to hit these targets.</p>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-5 space-y-5">

              {/* MRR Target — primary */}
              <div className="p-4 rounded-xl border-2 border-violet-200 bg-violet-50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">💰</span>
                  <p className="text-sm font-bold text-violet-800">MRR / Revenue Target</p>
                  <span className="text-[10px] bg-violet-200 text-violet-700 px-1.5 py-0.5 rounded font-semibold ml-auto">Primary Goal</span>
                </div>
                <div className="flex gap-2">
                  <div className="w-24 flex-shrink-0">
                    <div className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 bg-white">
                      {form.currency || 'USD'}
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={mrrTarget}
                    onChange={e => { setMrrTarget(e.target.value); setStep3Error('') }}
                    placeholder="e.g. 5000"
                    className={`flex-1 border rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 bg-white transition-all ${step3Error ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:border-violet-400 focus:ring-violet-200'}`}
                  />
                  <select
                    value={mrrPeriod}
                    onChange={e => setMrrPeriod(e.target.value as typeof mrrPeriod)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-1 focus:border-violet-400"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              {step3Error && (
                <p className="text-red-500 text-xs -mt-2">{step3Error}</p>
              )}

              {/* Achievement Timeframe */}
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">Achievement Timeframe</p>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { key: '3m', label: '3 Months' },
                    { key: '6m', label: '6 Months' },
                    { key: '1y', label: '1 Year'   },
                    { key: '2y', label: '2 Years'  },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setGoalTimeframe(g => g === key ? '' : key)}
                      className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                        goalTimeframe === key
                          ? 'bg-violet-600 border-violet-600 text-white'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-violet-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Extra goals */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Additional Goals (optional)</p>
                <div className="space-y-2">
                  {([
                    { key: 'leads',   icon: '👥', label: 'Lead Generation', unit: 'leads'   },
                    { key: 'content', icon: '📝', label: 'Content Posts',   unit: 'posts'   },
                    { key: 'reviews', icon: '⭐', label: 'Reviews',         unit: 'reviews' },
                  ] as const).map(({ key, icon, label, unit }) => {
                    const g = extraGoals[key]
                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${g.on ? 'border-violet-200 bg-violet-50' : 'border-slate-100 bg-slate-50'}`}
                      >
                        <span className="text-base flex-shrink-0">{icon}</span>
                        <p className="text-sm font-semibold text-slate-700 flex-1">{label}</p>
                        {g.on && (
                          <>
                            <input
                              type="number"
                              min="1"
                              value={g.target}
                              onChange={e => setExtraGoals(prev => ({ ...prev, [key]: { ...prev[key], target: e.target.value } }))}
                              className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:border-violet-400 bg-white text-center"
                            />
                            <span className="text-xs text-slate-400 flex-shrink-0">{unit}</span>
                            <select
                              value={g.period}
                              onChange={e => setExtraGoals(prev => ({ ...prev, [key]: { ...prev[key], period: e.target.value as 'monthly' | 'quarterly' | 'yearly' } }))}
                              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 bg-white focus:outline-none"
                            >
                              <option value="monthly">Monthly</option>
                              <option value="quarterly">Quarterly</option>
                              <option value="yearly">Yearly</option>
                            </select>
                          </>
                        )}
                        {/* Toggle */}
                        <button
                          type="button"
                          onClick={() => setExtraGoals(prev => ({ ...prev, [key]: { ...prev[key], on: !prev[key].on } }))}
                          className="flex-shrink-0"
                        >
                          <div className="relative rounded-full transition-colors duration-200" style={{ background: g.on ? '#7c3aed' : '#cbd5e1', width: 36, height: 20 }}>
                            <div className="absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform duration-200"
                              style={{ transform: g.on ? 'translateX(18px)' : 'translateX(2px)', margin: 1 }} />
                          </div>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="px-8 py-5 flex-shrink-0 border-t border-slate-100 space-y-2">
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(form.knows_competitors ? 'step2' : 'step1')}
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors px-3"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={saveStep3}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <>Save &amp; Continue <ChevronRight className="w-4 h-4" /></>}
                </button>
              </div>
              <button type="button" onClick={onContinue} className="w-full text-xs text-slate-400 hover:text-slate-500 transition-colors py-1">
                Skip → Let AI suggest goals after onboarding
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2 ── */}
        {step === 'step2' && (
          <>
            {/* Header */}
            <div className="px-8 pt-6 pb-4 flex-shrink-0 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                {STEPS_META.map((_, i) => (
                  <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-100">
                    <div className={`h-full rounded-full transition-all ${i <= 1 ? 'bg-violet-600' : 'bg-transparent'}`} />
                  </div>
                ))}
              </div>
              <span className="text-xs font-bold text-violet-600 uppercase tracking-widest">Step 2 of 4</span>
              <h3 className="text-lg font-extrabold text-slate-900 mt-1">Setup your competitors with AI</h3>
              <p className="text-xs text-slate-400 mt-0.5">Add competitor URLs so AI can track them and surface insights for you.</p>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-8 py-5 space-y-3">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Add Competitor URLs</p>

              {competitorUrls.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="url"
                      value={url}
                      onChange={e => setCompetitorUrl(i, e.target.value)}
                      placeholder="https://competitor.com"
                      className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:border-violet-400 focus:ring-violet-200 bg-white transition-all"
                    />
                  </div>
                  {competitorUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCompetitorUrl(i)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addCompetitorUrl}
                className="flex items-center gap-2 text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors py-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Another Competitor
              </button>

              <div className="pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setStep('step3')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-violet-300 bg-violet-50 hover:bg-violet-100 hover:border-violet-400 transition-all text-xs font-semibold text-violet-600"
                >
                  <span>⚡</span>
                  Skip Now → AI will search competitors after onboarding
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-5 flex-shrink-0 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setStep('step1')}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors px-3"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={saveStep2}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <>Save &amp; Continue <ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 1 ── */}
        {step === 'step1' && (
          <>
            {/* Header */}
            <div className="px-8 pt-6 pb-4 flex-shrink-0 border-b border-slate-100">
              {/* Progress */}
              <div className="flex items-center gap-2 mb-4">
                {STEPS_META.map((_, i) => (
                  <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-100">
                    <div className={`h-full rounded-full transition-all ${i === 0 ? 'bg-violet-600' : 'bg-transparent'}`} />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-violet-600 uppercase tracking-widest">Step 1 of 4</span>
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 mt-1">Provide your business details</h3>
              <p className="text-xs text-slate-400 mt-0.5">Help AI understand your business so it can work accurately from day one.</p>
            </div>

            {/* Scrollable form body */}
            <div className="flex-1 overflow-y-auto px-8 py-5 space-y-4">
              {loadingBiz ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
                </div>
              ) : (
                <>
                  {/* Business Name + Website */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Business Name" required error={errors.name}>
                      <input value={form.name} onChange={e => set('name', e.target.value)}
                        placeholder="e.g. Acme Inc." className={input(!!errors.name)} />
                    </Field>
                    <Field label="Website URL" required error={errors.website_url}>
                      <input value={form.website_url} onChange={e => set('website_url', e.target.value)}
                        placeholder="https://yoursite.com" className={input(!!errors.website_url)} />
                    </Field>
                  </div>

                  {/* Pricing — 3 modes */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-600">
                        Pricing Setup <span className="text-red-500">*</span>
                        <span className="font-normal text-slate-400 ml-1">— AI uses this for MRR planning</span>
                      </label>
                    </div>
                    {/* Mode tabs */}
                    <div className="flex gap-1.5 mb-2.5">
                      {([
                        { key: 'url',    label: '🔗 Has pricing URL' },
                        { key: 'manual', label: '📦 Add manually' },
                        { key: 'none',   label: '⭕ No plan yet' },
                      ] as const).map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setPricingMode(key)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                            pricingMode === key
                              ? 'bg-violet-600 border-violet-600 text-white'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {pricingMode === 'url' && (
                      <input
                        value={form.pricing_page_url}
                        onChange={e => set('pricing_page_url', e.target.value)}
                        placeholder="https://yoursite.com/pricing"
                        className={input(!!errors.pricing_page_url)}
                      />
                    )}

                    {pricingMode === 'manual' && (
                      <div className="space-y-2">
                        {/* Column headers */}
                        <div className="grid grid-cols-[1fr_100px_120px_28px] gap-1.5 px-0.5">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase">Package Name</span>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase">Price</span>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase">Billing</span>
                          <span />
                        </div>
                        {pricingPackages.map((pkg, i) => (
                          <div key={i} className="grid grid-cols-[1fr_100px_120px_28px] gap-1.5 items-center">
                            <input
                              value={pkg.name}
                              onChange={e => setPricingPackages(ps => ps.map((p, idx) => idx === i ? { ...p, name: e.target.value } : p))}
                              placeholder="Pro, Starter…"
                              className={input(false)}
                            />
                            <input
                              type="number"
                              min="0"
                              value={pkg.price}
                              onChange={e => setPricingPackages(ps => ps.map((p, idx) => idx === i ? { ...p, price: e.target.value } : p))}
                              placeholder="49"
                              className={input(false)}
                            />
                            <select
                              value={pkg.plan}
                              onChange={e => setPricingPackages(ps => ps.map((p, idx) => idx === i ? { ...p, plan: e.target.value as PricingPackage['plan'] } : p))}
                              className={input(false)}
                            >
                              <option value="monthly">Monthly</option>
                              <option value="yearly">Yearly</option>
                              <option value="onetime">One-time</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => setPricingPackages(ps => ps.filter((_, idx) => idx !== i))}
                              disabled={pricingPackages.length === 1}
                              className="p-1 rounded text-slate-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setPricingPackages(ps => [...ps, { name: '', price: '', plan: 'monthly' }])}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 hover:text-violet-700 transition-colors py-0.5"
                        >
                          <Plus className="w-3 h-3" /> Add Package
                        </button>
                      </div>
                    )}

                    {pricingMode === 'none' && (
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                        <span className="text-base">💡</span>
                        <p className="text-xs text-amber-700">No pricing plan yet — you can add it later from Settings. AI will skip MRR analysis until then.</p>
                      </div>
                    )}

                    {errors.pricing_page_url && pricingMode === 'url' && (
                      <p className="text-red-500 text-xs mt-1">{errors.pricing_page_url}</p>
                    )}
                  </div>
                  <Field label="Service / Product Page URL" required hint="AI will analyze your offerings" error={errors.service_page_url}>
                    <input value={form.service_page_url} onChange={e => set('service_page_url', e.target.value)}
                      placeholder="https://yoursite.com/services" className={input(!!errors.service_page_url)} />
                  </Field>

                  {/* Business Stage */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-2">
                      Business Stage <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {STAGES.map(s => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => { set('business_stage', s.value); if (s.value !== 'live_transactions') set('current_mrr', '') }}
                          className={`p-3 rounded-xl border text-left transition-all text-sm ${
                            form.business_stage === s.value
                              ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-400'
                              : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {form.business_stage === s.value && <CheckCircle2 className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />}
                            <span className={`font-semibold ${form.business_stage === s.value ? 'text-violet-700' : 'text-slate-700'}`}>{s.label}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 pl-0">{s.desc}</p>
                        </button>
                      ))}
                    </div>
                    {errors.business_stage && <p className="text-red-500 text-xs mt-1">{errors.business_stage}</p>}
                  </div>

                  {/* Current MRR — only if live_transactions */}
                  {form.business_stage === 'live_transactions' && (
                    <Field label="Current MRR" hint="Monthly Recurring Revenue">
                      <div className="flex gap-2">
                        <select
                          value={form.currency}
                          onChange={e => set('currency', e.target.value)}
                          className={`${input(false)} w-44 flex-shrink-0`}
                        >
                          {CURRENCIES.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                        <div className="relative flex-1">
                          <input
                            type="number" min="0" step="100"
                            value={form.current_mrr}
                            onChange={e => set('current_mrr', e.target.value)}
                            placeholder="0"
                            className={input(false)}
                          />
                        </div>
                      </div>
                    </Field>
                  )}

                  {/* Currency + Target Market */}
                  <div className="grid grid-cols-2 gap-3">
                    {form.business_stage !== 'live_transactions' && (
                      <Field label="Business Currency">
                        <select value={form.currency} onChange={e => set('currency', e.target.value)} className={input(false)}>
                          {CURRENCIES.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <Field label="Target Market" hint="Where are your customers?">
                      <select
                        value={form.target_market}
                        onChange={e => { set('target_market', e.target.value); if (e.target.value !== 'Local Market') setLocalCountry('') }}
                        className={input(false)}
                      >
                        <option value="">Select market…</option>
                        {TARGET_MARKETS.map(m => (
                          <option key={m} value={m}>{m === 'Local Market' ? '📍 Local Market (single country)' : m}</option>
                        ))}
                      </select>
                      {form.target_market === 'Local Market' && (
                        <select
                          value={localCountry}
                          onChange={e => setLocalCountry(e.target.value)}
                          className={`${input(false)} mt-2`}
                        >
                          <option value="">Select your country…</option>
                          {COUNTRIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      )}
                    </Field>
                  </div>

                  {/* Toggles */}
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quick questions</p>
                    <Toggle
                      checked={form.knows_icp}
                      onChange={v => set('knows_icp', v)}
                      label="Do you know your Business ICP?"
                      sub="Ideal Customer Profile — who you're building this for"
                    />
                    <Toggle
                      checked={form.knows_competitors}
                      onChange={v => set('knows_competitors', v)}
                      label="Do you know your competitors?"
                      sub="We'll help you find more and track them"
                    />
                    <Toggle
                      checked={form.has_marketing_plan}
                      onChange={v => set('has_marketing_plan', v)}
                      label="Do you have a marketing plan template?"
                      sub="AI will build on it or create one from scratch"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-5 flex-shrink-0 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setStep('overview')}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors px-3"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={saveStep1}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <>Save &amp; Next <ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
function input(err: boolean) {
  return `w-full border rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 transition-all ${
    err ? 'border-red-400 focus:ring-red-300 bg-red-50' : 'border-slate-200 focus:border-violet-400 focus:ring-violet-200 bg-white'
  }`
}

function Field({ label, required, hint, error, children }: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
        {hint && <span className="font-normal text-slate-400 ml-1">— {hint}</span>}
      </label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
