'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { MarketingPlan, MarketingAction, Community } from '@/types/marketing-plan'

// ── Types ──────────────────────────────────────────────────────────────────────
interface LaunchPlatform {
  id: string; name: string; icon: string; description: string; tip: string
  category: 'product' | 'community' | 'content' | 'outreach'
}
interface PlatformState { status: 'not_started' | 'in_progress' | 'done'; url: string; notes: string }
interface SavedPlan { goal: string; plan_json: MarketingPlan; actions_done: Record<string, boolean> }

// ── Constants ──────────────────────────────────────────────────────────────────
const LOADING_STEPS = [
  { label: 'Reading your business profile…',    icon: '🏢' },
  { label: 'Analyzing pipeline and leads…',      icon: '🎯' },
  { label: 'Researching your competitors…',      icon: '🔍' },
  { label: 'Identifying the best channels…',     icon: '📡' },
  { label: 'Building quarterly action plan…',    icon: '🗓️' },
  { label: 'Connecting actions to your tools…', icon: '🔗' },
  { label: 'Writing your execution roadmap…',    icon: '✍️' },
]

const LAUNCH_PLATFORMS: LaunchPlatform[] = [
  { id: 'product_hunt',  name: 'Product Hunt',    icon: '🐱', category: 'product',    description: 'List your product on the #1 platform for new tools', tip: 'Best days to launch: Tuesday–Thursday. Schedule at 12:01 AM PST.' },
  { id: 'indie_hackers', name: 'Indie Hackers',   icon: '🛠️', category: 'community',  description: 'Share your journey with indie founders and bootstrappers', tip: 'Post a milestone story. Be transparent with numbers.' },
  { id: 'hacker_news',   name: 'Hacker News',     icon: '🟧', category: 'community',  description: 'Reach technical founders and early adopters', tip: 'Submit as "Show HN: [Product] — [what it does]". Be in comments for the first 2 hours.' },
  { id: 'reddit',        name: 'Reddit',          icon: '🔴', category: 'community',  description: 'Post in relevant subreddits (r/SaaS, r/Entrepreneur)', tip: 'Build karma first. Read subreddit rules before posting.' },
  { id: 'twitter_x',    name: 'Twitter / X',     icon: '🐦', category: 'content',    description: 'Build an audience with daily founder insights and product updates', tip: 'Tweet your launch day. Reply to every comment within 1 hour.' },
  { id: 'linkedin',      name: 'LinkedIn',        icon: '💼', category: 'content',    description: 'Reach B2B buyers and decision-makers with professional content', tip: 'Personal posts get 5× more reach than company posts.' },
  { id: 'email',         name: 'Email Newsletter', icon: '📧', category: 'outreach',   description: 'Announce to your waiting list and existing subscribers', tip: "Send a 'we're live' email with a limited early-bird offer." },
  { id: 'blog',          name: 'Blog / SEO',      icon: '✍️', category: 'content',    description: 'Publish launch announcement and feature articles for organic traffic', tip: 'Write a "how I built X" post on launch day.' },
  { id: 'appsumo',       name: 'AppSumo',         icon: '💡', category: 'product',    description: 'Reach 1M+ entrepreneurs and get an initial revenue spike', tip: 'Only apply when your product is mature. Prepare heavy support load.' },
]

const PLATFORM_COLOR = {
  product:   'bg-violet-500/20 text-violet-300 border-violet-500/30',
  community: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  content:   'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  outreach:  'bg-amber-500/20 text-amber-300 border-amber-500/30',
}
const STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: 'bg-slate-700 text-slate-400 border-slate-600' },
  in_progress: { label: 'In Progress', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  done:        { label: 'Done ✓',      color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
}
const PLATFORM_ICON: Record<Community['platform'], string> = {
  reddit: '🔴', facebook: '🔵', linkedin: '💼', slack: '🟣', discord: '🎮', other: '🌐',
}
const FEATURE: Record<string, { link: string; label: string; color: string }> = {
  'leads':       { link: '/leads',       label: 'Open AI Lead Finder',  color: 'bg-violet-600 hover:bg-violet-500' },
  'leads/cold':  { link: '/leads/cold',  label: 'Cold Outreach',        color: 'bg-blue-600 hover:bg-blue-500' },
  'content':     { link: '/content',     label: 'Write with AI',        color: 'bg-emerald-600 hover:bg-emerald-500' },
  'campaigns':   { link: '/campaigns',   label: 'Create Campaign',      color: 'bg-blue-600 hover:bg-blue-500' },
  'proposals':   { link: '/proposals',   label: 'Build Proposal',       color: 'bg-violet-600 hover:bg-violet-500' },
  'competitors': { link: '/competitors', label: 'Track Competitors',    color: 'bg-red-600 hover:bg-red-500' },
  'reviews':     { link: '/reviews',     label: 'Manage Reviews',       color: 'bg-amber-600 hover:bg-amber-500' },
  'analytics':   { link: '/analytics',   label: 'View Analytics',       color: 'bg-slate-600 hover:bg-slate-500' },
}
const AI_HELP_LABEL: Record<string, string> = {
  linkedin_post:  '✨ Write LinkedIn Post',
  email_sequence: '✨ Generate Email Sequence',
  ad_copy:        '✨ Write Ad Copy',
  linkedin_bio:   '✨ Optimize LinkedIn Bio',
}
const AI_HELP_LABEL_MAP: Record<string, string> = {
  product_hunt:  '✨ Write Launch Kit',
  indie_hackers: '✨ Write Milestone Post',
  hacker_news:   '✨ Write Show HN Post',
  reddit:        '✨ Write Reddit Post',
  twitter_x:     '✨ Write Tweet Thread',
  linkedin:      '✨ Write LinkedIn Post',
  email:         '✨ Write Launch Email',
  blog:          '✨ Write Blog Post',
  appsumo:       '✨ Write Listing Copy',
}
const GOAL_PRESETS = [
  { icon: '🎯', label: 'Get 100 qualified leads in 30 days' },
  { icon: '💰', label: 'Grow MRR by 30% this quarter' },
  { icon: '📱', label: 'Build LinkedIn brand presence' },
  { icon: '🤝', label: 'Land 10 new enterprise clients' },
  { icon: '⭐', label: 'Get 50 new 5-star reviews' },
  { icon: '📧', label: 'Build email list of 1,000 subscribers' },
  { icon: '🚀', label: 'Launch a new product successfully' },
]
const IMPACT_COLOR: Record<string, string> = {
  high:   'bg-red-500/20 text-red-300 border-red-500/30',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  low:    'bg-slate-700 text-slate-400 border-slate-600',
}
const PHASE_ACCENT = ['border-violet-500/40','border-blue-500/40','border-emerald-500/40','border-amber-500/40']
const PHASE_LABEL  = ['text-violet-400','text-blue-400','text-emerald-400','text-amber-400']

// ── Plan Loader ────────────────────────────────────────────────────────────────
function PlanLoader({ goal }: { goal: string }) {
  const [step, setStep] = useState(0)
  const [fade, setFade] = useState(true)
  useEffect(() => {
    const t = setInterval(() => {
      setFade(false)
      setTimeout(() => { setStep(s => (s + 1) % LOADING_STEPS.length); setFade(true) }, 300)
    }, 1800)
    return () => clearInterval(t)
  }, [])
  const cur = LOADING_STEPS[step]
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
      <div className="relative w-20 h-20 mx-auto mb-8">
        <div className="absolute inset-0 rounded-full border-2 border-violet-500/10 animate-ping" style={{ animationDuration: '2s' }} />
        <div className="absolute inset-1 rounded-full border-2 border-violet-500/20 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.3s' }} />
        <div className="absolute inset-0 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" style={{ animationDuration: '1.2s' }} />
        <div className="absolute inset-0 flex items-center justify-center text-2xl">
          <span className="transition-all duration-300" style={{ opacity: fade ? 1 : 0, transform: fade ? 'scale(1)' : 'scale(0.7)' }}>{cur.icon}</span>
        </div>
      </div>
      <div className="inline-flex items-center gap-2 bg-violet-600/20 border border-violet-500/30 rounded-full px-4 py-1.5 mb-5">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
        <span className="text-violet-300 text-xs font-medium truncate max-w-xs">{goal}</span>
      </div>
      <div className="h-6 flex items-center justify-center mb-6">
        <p className="text-slate-300 text-sm font-medium transition-all duration-300" style={{ opacity: fade ? 1 : 0, transform: fade ? 'translateY(0)' : 'translateY(6px)' }}>{cur.label}</p>
      </div>
      <div className="flex items-center justify-center gap-1.5">
        {LOADING_STEPS.map((_, i) => (
          <div key={i} className="rounded-full transition-all duration-500" style={{ width: i === step ? '20px' : '6px', height: '6px', background: i === step ? '#7c3aed' : i < step ? '#4c1d95' : '#1e293b' }} />
        ))}
      </div>
    </div>
  )
}

// ── AI Assist Panel ────────────────────────────────────────────────────────────
function AssistPanel({ action, onClose, bizName, industry, target }: {
  action: MarketingAction; onClose: () => void; bizName: string; industry: string; target: string
}) {
  const [content, setContent] = useState(''); const [loading, setLoading] = useState(false); const [copied, setCopied] = useState(false)
  async function generate() {
    setLoading(true); setContent('')
    try {
      const res = await fetch('/api/tools/marketing-plan/assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: action.ai_help_type, context: `${action.title}: ${action.description}`, business_name: bizName, industry, target_customer: target }) })
      const data = await res.json()
      if (data.content) setContent(data.content)
    } finally { setLoading(false) }
  }
  function copy() { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div className="mt-3 bg-slate-800/80 border border-violet-500/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-violet-300 text-xs font-semibold">{AI_HELP_LABEL[action.ai_help_type ?? ''] ?? 'AI Help'}</p>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xs">✕ Close</button>
      </div>
      {!content ? (
        <button onClick={generate} disabled={loading} className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
          {loading ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating…</> : `Generate ${AI_HELP_LABEL[action.ai_help_type ?? ''] ?? 'Content'}`}
        </button>
      ) : (
        <div>
          <pre className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap bg-slate-900/60 rounded-lg p-3 max-h-64 overflow-y-auto">{content}</pre>
          <div className="flex gap-2 mt-2">
            <button onClick={copy} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors">{copied ? '✓ Copied' : '📋 Copy'}</button>
            <button onClick={generate} disabled={loading} className="text-xs text-violet-400 hover:text-violet-300 px-3 py-1.5 transition-colors">↺ Regenerate</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Action Card ────────────────────────────────────────────────────────────────
function ActionCard({ action, actionId, done, onToggle, bizName, industry, target }: {
  action: MarketingAction; actionId: string; done: boolean; onToggle: () => void; bizName: string; industry: string; target: string
}) {
  const [showAssist, setShowAssist] = useState(false)
  const feature = FEATURE[action.action_type]
  const hasAiHelp = !!action.ai_help_type && AI_HELP_LABEL[action.ai_help_type]
  return (
    <div className={`bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 transition-opacity ${done ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-2 mb-2">
        <button onClick={onToggle} className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${done ? 'bg-violet-600 border-violet-600' : 'border-slate-600 hover:border-slate-400'}`}>
          {done && <span className="text-white text-[9px]">✓</span>}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${IMPACT_COLOR[action.impact]}`}>{action.impact} impact</span>
            <span className="text-[10px] text-slate-600">{action.effort} effort</span>
            <span className="text-[10px] text-slate-600 ml-auto">{action.timeline}</span>
          </div>
          <p className={`text-sm font-medium leading-snug ${done ? 'line-through text-slate-500' : 'text-slate-200'}`}>{action.title}</p>
          <p className="text-slate-500 text-xs mt-1 leading-relaxed">{action.description}</p>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap mt-3">
        {feature && <Link href={feature.link} className={`inline-flex items-center gap-1.5 text-xs text-white font-medium px-3 py-1.5 rounded-lg transition-colors ${feature.color}`}>{feature.label} →</Link>}
        {action.action_type === 'external' && action.external_tools?.length > 0 && (
          <span className="text-xs text-slate-500 flex items-center gap-1 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700">🔧 {action.external_tools.join(', ')}</span>
        )}
        {hasAiHelp && (
          <button onClick={() => setShowAssist(v => !v)} className="text-xs text-violet-400 hover:text-violet-300 border border-violet-500/30 hover:border-violet-400/50 px-3 py-1.5 rounded-lg transition-colors">
            {showAssist ? 'Hide AI Help' : (AI_HELP_LABEL[action.ai_help_type!] ?? '✨ AI Help')}
          </button>
        )}
      </div>
      {showAssist && action.ai_help_type && <AssistPanel action={action} onClose={() => setShowAssist(false)} bizName={bizName} industry={industry} target={target} />}
    </div>
  )
}

// ── Launch Tracker Tab ─────────────────────────────────────────────────────────
function LaunchTrackerTab() {
  const defaultPlatforms = () => Object.fromEntries(LAUNCH_PLATFORMS.map(p => [p.id, { status: 'not_started' as const, url: '', notes: '' }]))
  const [platforms, setPlatforms] = useState<Record<string, PlatformState>>(defaultPlatforms)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [aiPanel, setAiPanel] = useState<string | null>(null)
  const [aiContent, setAiContent] = useState<Record<string, string>>({})
  const [generatingAi, setGeneratingAi] = useState<string | null>(null)
  const [copiedAi, setCopiedAi] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load from DB on mount
  useEffect(() => {
    fetch('/api/integrations/launch-tracker')
      .then(r => r.json())
      .then(res => {
        if (res.data && Object.keys(res.data).length > 0) {
          setPlatforms(prev => {
            const merged = { ...prev }
            for (const [id, state] of Object.entries(res.data as Record<string, PlatformState>)) {
              merged[id] = state
            }
            return merged
          })
        }
      })
      .catch(() => {})
  }, [])

  // Debounced save to DB on change
  const debouncedSave = useCallback((data: Record<string, PlatformState>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await fetch('/api/integrations/launch-tracker', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      } finally { setSaving(false) }
    }, 1000)
  }, [])

  function cycleStatus(id: string) {
    setPlatforms(prev => {
      const order: PlatformState['status'][] = ['not_started', 'in_progress', 'done']
      const cur = prev[id]?.status ?? 'not_started'
      const next = order[(order.indexOf(cur) + 1) % order.length]
      const updated = { ...prev, [id]: { ...prev[id], status: next } }
      debouncedSave(updated)
      return updated
    })
  }

  function update(id: string, field: 'url' | 'notes', value: string) {
    setPlatforms(prev => {
      const updated = { ...prev, [id]: { ...prev[id], [field]: value } }
      debouncedSave(updated)
      return updated
    })
  }

  async function generateAiHelp(platformId: string) {
    setGeneratingAi(platformId)
    try {
      const res = await fetch('/api/tools/marketing-plan/launch-help', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform_id: platformId }) })
      const data = await res.json()
      if (data.content) setAiContent(prev => ({ ...prev, [platformId]: data.content }))
    } finally { setGeneratingAi(null) }
  }

  function copyAi(id: string) { navigator.clipboard.writeText(aiContent[id] ?? ''); setCopiedAi(id); setTimeout(() => setCopiedAi(null), 2000) }

  const doneCount = Object.values(platforms).filter(p => p.status === 'done').length
  const inProgressCount = Object.values(platforms).filter(p => p.status === 'in_progress').length

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{LAUNCH_PLATFORMS.length}</p>
          <p className="text-slate-500 text-xs mt-0.5">Total Channels</p>
        </div>
        <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{inProgressCount}</p>
          <p className="text-slate-500 text-xs mt-0.5">In Progress</p>
        </div>
        <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{doneCount}</p>
          <p className="text-slate-500 text-xs mt-0.5">Completed</p>
        </div>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-400 text-sm">Launch Progress</span>
          <span className="text-xs text-slate-500">{doneCount} / {LAUNCH_PLATFORMS.length} channels launched</span>
        </div>
        <div className="h-2.5 bg-slate-800 rounded-full">
          <div className="h-2.5 bg-gradient-to-r from-violet-500 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${(doneCount / LAUNCH_PLATFORMS.length) * 100}%` }} />
        </div>
        {saving && <p className="text-xs text-slate-600 mt-2">Saving…</p>}
      </div>

      <div className="space-y-3">
        {LAUNCH_PLATFORMS.map(platform => {
          const state = platforms[platform.id] ?? { status: 'not_started', url: '', notes: '' }
          const isExpanded = expanded === platform.id
          const isAiOpen = aiPanel === platform.id
          const statusCfg = STATUS_CONFIG[state.status]
          const content = aiContent[platform.id]
          const isGenerating = generatingAi === platform.id
          return (
            <div key={platform.id} className={`bg-slate-900 border rounded-xl overflow-hidden transition-all ${state.status === 'done' ? 'border-emerald-500/30' : state.status === 'in_progress' ? 'border-amber-500/30' : 'border-slate-800'}`}>
              <div className="flex items-center gap-3 p-4">
                <span className="text-xl flex-shrink-0">{platform.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-slate-200 font-medium text-sm">{platform.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${PLATFORM_COLOR[platform.category]}`}>{platform.category}</span>
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5 truncate">{platform.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => cycleStatus(platform.id)} className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${statusCfg.color}`}>{statusCfg.label}</button>
                  <button onClick={() => { setExpanded(isExpanded ? null : platform.id); if (!isExpanded) setAiPanel(null) }} className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                    {isExpanded ? '▲' : '▼'}
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-800">
                  <div className="bg-violet-900/20 border border-violet-500/20 rounded-lg p-3 mb-3 mt-3">
                    <p className="text-violet-300 text-xs leading-relaxed">💡 {platform.tip}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-slate-500 text-xs mb-1 block">URL / Link</label>
                      <input value={state.url} onChange={e => update(platform.id, 'url', e.target.value)} placeholder="https://…" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-xs placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors" />
                    </div>
                    <div>
                      <label className="text-slate-500 text-xs mb-1 block">Notes / Metrics</label>
                      <input value={state.notes} onChange={e => update(platform.id, 'notes', e.target.value)} placeholder="e.g. 240 upvotes, 12 signups…" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-xs placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors" />
                    </div>
                  </div>
                  <button onClick={() => setAiPanel(isAiOpen ? null : platform.id)} className={`text-xs font-medium px-4 py-2 rounded-lg border transition-colors ${isAiOpen ? 'bg-violet-600/20 border-violet-500/50 text-violet-300' : 'border-violet-500/30 text-violet-400 hover:border-violet-400/60 hover:text-violet-300'}`}>
                    {isAiOpen ? 'Hide AI Help' : (AI_HELP_LABEL_MAP[platform.id] ?? '✨ AI Help')}
                  </button>
                  {isAiOpen && (
                    <div className="mt-3 bg-slate-800/60 border border-violet-500/20 rounded-xl p-4">
                      <p className="text-violet-300 text-xs font-semibold mb-3">{AI_HELP_LABEL_MAP[platform.id] ?? 'AI Content'} for {platform.name}</p>
                      {!content ? (
                        <button onClick={() => generateAiHelp(platform.id)} disabled={isGenerating} className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
                          {isGenerating ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Writing…</> : `✨ Generate ${platform.name} Content`}
                        </button>
                      ) : (
                        <div>
                          <pre className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap bg-slate-900/70 rounded-lg p-4 max-h-72 overflow-y-auto mb-3 font-sans">{content}</pre>
                          <div className="flex gap-2">
                            <button onClick={() => copyAi(platform.id)} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors">{copiedAi === platform.id ? '✓ Copied' : '📋 Copy All'}</button>
                            <button onClick={() => generateAiHelp(platform.id)} disabled={isGenerating} className="text-xs text-violet-400 hover:text-violet-300 px-3 py-1.5 transition-colors">↺ Regenerate</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Community Hub Tab ──────────────────────────────────────────────────────────
function CommunityHubTab() {
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(false)
  const [joinedPosted, setJoinedPosted] = useState<Record<string, { joined: boolean; posted: boolean }>>({})
  const [postPanel, setPostPanel] = useState<string | null>(null)
  const [posts, setPosts] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    try { const s = localStorage.getItem('lt_communities'); if (s) setJoinedPosted(JSON.parse(s)) } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('lt_communities', JSON.stringify(joinedPosted)) } catch {}
  }, [joinedPosted])

  async function discover() {
    setLoading(true)
    try {
      const res = await fetch('/api/tools/marketing-plan/communities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const data = await res.json()
      if (data.communities) setCommunities(data.communities)
    } finally { setLoading(false) }
  }

  function toggleJoined(name: string) { setJoinedPosted(prev => ({ ...prev, [name]: { ...prev[name], joined: !prev[name]?.joined } })) }
  function togglePosted(name: string) { setJoinedPosted(prev => ({ ...prev, [name]: { ...prev[name], posted: !prev[name]?.posted } })) }

  async function generatePost(community: Community) {
    setGenerating(community.name)
    try {
      const res = await fetch('/api/tools/marketing-plan/communities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generate_post: true, community }) })
      const data = await res.json()
      if (data.post) setPosts(prev => ({ ...prev, [community.name]: data.post }))
    } finally { setGenerating(null) }
  }

  function copyPost(name: string) { navigator.clipboard.writeText(posts[name] ?? ''); setCopied(name); setTimeout(() => setCopied(null), 2000) }
  const joinedCount = Object.values(joinedPosted).filter(v => v?.joined).length
  const postedCount = Object.values(joinedPosted).filter(v => v?.posted).length

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <p className="text-slate-400 text-sm">Find the right communities, get AI tips on what to post, and generate tailored posts in one click.</p>
        <button onClick={discover} disabled={loading} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors flex-shrink-0">
          {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Discovering…</> : '🔍 Discover Communities'}
        </button>
      </div>
      {communities.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[['Communities', communities.length, 'text-white', 'border-slate-800'], ['Joined', joinedCount, 'text-emerald-400', 'border-emerald-500/30'], ['Posted', postedCount, 'text-violet-400', 'border-violet-500/30']].map(([label, count, color, border]) => (
            <div key={label as string} className={`bg-slate-900 border ${border} rounded-xl p-3 text-center`}>
              <p className={`text-xl font-bold ${color}`}>{count}</p>
              <p className="text-slate-500 text-xs">{label}</p>
            </div>
          ))}
        </div>
      )}
      {communities.length === 0 && !loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-4">💬</div>
          <p className="text-slate-300 font-medium mb-2">Find your audience communities</p>
          <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">AI will suggest 8 online communities where your target customers hang out — with tips on what to post and how not to get banned.</p>
          <button onClick={discover} className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors">🔍 Discover Communities</button>
        </div>
      )}
      {communities.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {communities.map((c, i) => {
            const state = joinedPosted[c.name] ?? { joined: false, posted: false }
            const isPostOpen = postPanel === c.name
            return (
              <div key={i} className={`bg-slate-900 border rounded-xl p-4 transition-all ${state.joined ? 'border-emerald-500/30' : 'border-slate-800'}`}>
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-xl flex-shrink-0">{PLATFORM_ICON[c.platform]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-slate-200 font-medium text-sm">{c.name}</p>
                      <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{c.members} members</span>
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{c.why}</p>
                  </div>
                </div>
                <div className="bg-slate-800/60 rounded-lg p-2.5 mb-3">
                  <p className="text-xs text-slate-400 leading-relaxed">💡 {c.post_tip}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => toggleJoined(c.name)} className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${state.joined ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'}`}>{state.joined ? '✓ Joined' : '+ Join'}</button>
                  <button onClick={() => togglePosted(c.name)} className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${state.posted ? 'bg-violet-500/20 text-violet-300 border-violet-500/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'}`}>{state.posted ? '✓ Posted' : '📝 Mark Posted'}</button>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">Visit ↗</a>
                  <button onClick={() => setPostPanel(isPostOpen ? null : c.name)} className="ml-auto text-xs text-violet-400 hover:text-violet-300 border border-violet-500/30 hover:border-violet-400/50 px-3 py-1.5 rounded-lg transition-colors">✨ Write Post</button>
                </div>
                {isPostOpen && (
                  <div className="mt-3 bg-slate-800/60 border border-violet-500/20 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-violet-300 text-xs font-semibold">AI Post for {c.name}</p>
                      <button onClick={() => setPostPanel(null)} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
                    </div>
                    {!posts[c.name] ? (
                      <button onClick={() => generatePost(c)} disabled={generating === c.name} className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                        {generating === c.name ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Writing…</> : `✨ Generate ${c.platform.charAt(0).toUpperCase() + c.platform.slice(1)} Post`}
                      </button>
                    ) : (
                      <div>
                        <pre className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap bg-slate-900/60 rounded-lg p-3 max-h-48 overflow-y-auto mb-2">{posts[c.name]}</pre>
                        <div className="flex gap-2">
                          <button onClick={() => copyPost(c.name)} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors">{copied === c.name ? '✓ Copied' : '📋 Copy'}</button>
                          <button onClick={() => generatePost(c)} disabled={generating === c.name} className="text-xs text-violet-400 hover:text-violet-300 px-3 py-1.5 transition-colors">↺ Regenerate</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
type Tab = 'plan' | 'launch' | 'communities'

export default function MarketingPlanPage() {
  const [activeTab, setActiveTab] = useState<Tab>('plan')
  const [activeGoal, setActiveGoal] = useState('')
  const [customGoal, setCustomGoal] = useState('')
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([])
  const [generating, setGenerating] = useState(false)
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [exportHtml, setExportHtml] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Load all saved plans from Supabase on mount
  useEffect(() => {
    fetch('/api/tools/marketing-plan/plans')
      .then(r => r.json())
      .then(data => {
        const plans: SavedPlan[] = data.plans ?? []
        setSavedPlans(plans)
        if (plans.length > 0) setActiveGoal(plans[0].goal)
      })
      .catch(() => {})
      .finally(() => setLoadingPlans(false))
  }, [])

  const plansCache = Object.fromEntries(savedPlans.map(p => [p.goal, p.plan_json]))
  const doneCache  = Object.fromEntries(savedPlans.map(p => [p.goal, p.actions_done ?? {}]))
  const plan = activeGoal ? (plansCache[activeGoal] ?? null) : null
  const done = activeGoal ? (doneCache[activeGoal] ?? {}) : {}
  const totalActions = plan?.phases.reduce((s, p) => s + p.actions.length, 0) ?? 0
  const doneCount = Object.values(done).filter(Boolean).length
  const progress = totalActions > 0 ? Math.round((doneCount / totalActions) * 100) : 0

  async function selectGoal(g: string) {
    if (!g.trim()) return
    setActiveGoal(g)
    if (plansCache[g]) return  // already in DB cache — instant load
    await generateForGoal(g)
  }

  async function generateForGoal(g: string) {
    setGenerating(true)
    try {
      const res = await fetch('/api/tools/marketing-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal: g }),
      })
      const data = await res.json()
      if (data.plan && !data._fallback) {
        // Save to Supabase
        await fetch('/api/tools/marketing-plan/plans', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goal: g, plan_json: data.plan, actions_done: {} }),
        })
        setSavedPlans(prev => {
          const idx = prev.findIndex(p => p.goal === g)
          const entry: SavedPlan = { goal: g, plan_json: data.plan, actions_done: {} }
          if (idx >= 0) { const next = [...prev]; next[idx] = entry; return next }
          return [...prev, entry]
        })
      } else if (data.plan && data._fallback) {
        // Show fallback without saving — will retry next time
        setSavedPlans(prev => {
          const existing = prev.findIndex(p => p.goal === g)
          if (existing >= 0) return prev
          return [...prev, { goal: g, plan_json: data.plan, actions_done: {} }]
        })
      }
    } finally { setGenerating(false) }
  }

  function toggleDone(id: string) {
    if (!activeGoal) return
    setSavedPlans(prev => {
      const idx = prev.findIndex(p => p.goal === activeGoal)
      if (idx < 0) return prev
      const cur = prev[idx].actions_done ?? {}
      const next = { ...cur, [id]: !cur[id] }
      const updated = [...prev]; updated[idx] = { ...prev[idx], actions_done: next }
      // Persist to DB (fire-and-forget)
      fetch('/api/tools/marketing-plan/plans', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: activeGoal, actions_done: next }),
      }).catch(() => {})
      return updated
    })
  }

  async function clearGoalCache(g: string) {
    // Remove from local state then regenerate
    setSavedPlans(prev => prev.filter(p => p.goal !== g))
    await generateForGoal(g)
  }

  function buildPdf(): string {
    if (!plan) return ''
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const phasesHtml = plan.phases.map(ph => `
      <div style="margin-bottom:32px;page-break-inside:avoid">
        <h2 style="font-size:18px;color:#7c3aed;margin-bottom:4px">${ph.name} — ${ph.weeks}</h2>
        <p style="font-size:13px;color:#64748b;margin-bottom:12px">${ph.focus}</p>
        ${ph.actions.map(a => `
          <div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="font-size:11px;font-weight:600;color:#dc2626;text-transform:uppercase">${a.impact} impact</span>
              <span style="font-weight:600;font-size:14px;color:#1e293b">${a.title}</span>
              <span style="margin-left:auto;font-size:11px;color:#64748b">${a.timeline}</span>
            </div>
            <p style="font-size:13px;color:#475569;margin:0">${a.description}</p>
            ${FEATURE[a.action_type] ? `<p style="font-size:12px;color:#7c3aed;margin-top:6px">→ CooVex: ${FEATURE[a.action_type].label}</p>` : ''}
          </div>`).join('')}
      </div>`).join('')
    return `<!DOCTYPE html><html><head><title>Marketing Plan — ${plan.goal}</title>
<style>body{font-family:-apple-system,Arial,sans-serif;max-width:860px;margin:40px auto;color:#1e293b;line-height:1.6}@media print{body{margin:20px}}</style>
</head><body>
<div style="border-bottom:3px solid #7c3aed;padding-bottom:16px;margin-bottom:24px">
  <h1 style="margin:0;font-size:26px">Marketing Plan</h1>
  <p style="margin:4px 0 0;color:#64748b;font-size:13px">${plan.goal} · ${date}</p>
</div>
<div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px">
  <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase">Strategy</p>
  <p style="margin:0;font-size:15px;color:#1e293b">${plan.strategy_summary}</p>
</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:32px">
  ${plan.expected_results.map(r => `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px"><p style="margin:0 0 4px;font-size:11px;color:#94a3b8">${r.label}</p><p style="margin:0;font-size:20px;font-weight:700;color:#7c3aed">${r.value}</p></div>`).join('')}
</div>
${phasesHtml}
</body></html>`
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'plan',        label: '📋 Marketing Plan' },
    { id: 'launch',      label: '🚀 Launch Tracker' },
    { id: 'communities', label: '💬 Communities' },
  ]

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">AI Marketing Plan</h1>
            <p className="text-slate-400 text-sm mt-0.5">Your personal AI marketing agent — plan, launch, and grow</p>
          </div>
          {activeTab === 'plan' && plan && (
            <button onClick={() => setExportHtml(buildPdf())} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors flex-shrink-0">
              📄 Export PDF
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-6 w-fit">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`text-sm font-medium px-4 py-2 rounded-lg transition-all ${activeTab === tab.id ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>{tab.label}</button>
          ))}
        </div>

        {/* ── PLAN TAB ── */}
        {activeTab === 'plan' && (
          <div>
            {loadingPlans ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Goal presets */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
                  {GOAL_PRESETS.map(g => {
                    const isSaved = !!plansCache[g.label]
                    const isActive = activeGoal === g.label
                    return (
                      <button key={g.label} onClick={() => selectGoal(g.label)} className={`relative text-left rounded-xl p-4 transition-all border ${isActive ? 'bg-violet-600/20 border-violet-500 shadow-[0_0_0_1px_#7c3aed]' : 'bg-slate-900 hover:bg-slate-800 border-slate-800 hover:border-violet-500/40'}`}>
                        <span className="text-2xl mb-2 block">{g.icon}</span>
                        <p className={`text-sm leading-snug ${isActive ? 'text-white font-medium' : 'text-slate-300'}`}>{g.label}</p>
                        {isSaved && !isActive && <span className="absolute top-2 right-2 text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">saved</span>}
                      </button>
                    )
                  })}
                </div>

                {/* Custom goal */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6">
                  <div className="flex gap-3">
                    <input value={customGoal} onChange={e => setCustomGoal(e.target.value)} onKeyDown={e => e.key === 'Enter' && selectGoal(customGoal)} placeholder="Or type your own goal — e.g. reach $50K MRR, expand to UK market…" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors" />
                    <button onClick={() => selectGoal(customGoal)} disabled={!customGoal.trim()} className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors flex-shrink-0">✨ Build Plan</button>
                  </div>
                </div>

                {generating && <PlanLoader goal={activeGoal} />}

                {plan && !generating && (
                  <div>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
                      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Strategy</p>
                          <p className="text-slate-300 text-sm leading-relaxed">{plan.strategy_summary}</p>
                        </div>
                        <button onClick={() => clearGoalCache(activeGoal)} className="text-xs text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 whitespace-nowrap">↺ Regenerate</button>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-800 rounded-full">
                          <div className="h-2 bg-violet-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0">{doneCount}/{totalActions} done · {progress}%</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                      {plan.expected_results.map((r, i) => (
                        <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                          <p className="text-slate-500 text-xs mb-1">{r.label}</p>
                          <p className="text-violet-400 font-bold text-lg">{r.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {plan.phases.map((phase, pi) => (
                        <div key={pi} className={`border rounded-2xl p-5 bg-slate-900/40 ${PHASE_ACCENT[pi]}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-bold text-base ${PHASE_LABEL[pi]}`}>{phase.name}</span>
                            <span className="text-slate-500 text-xs">{phase.weeks}</span>
                          </div>
                          <p className="text-slate-400 text-xs mb-4">{phase.focus}</p>
                          <div className="space-y-3">
                            {phase.actions.map((action, ai) => {
                              const id = `${pi}-${ai}`
                              return <ActionCard key={id} action={action} actionId={id} done={!!done[id]} onToggle={() => toggleDone(id)} bizName="" industry="" target="" />
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 flex items-center gap-2 flex-wrap">
                      <span className="text-slate-500 text-xs">Key channels:</span>
                      {plan.key_channels.map((ch, i) => <span key={i} className="text-xs bg-slate-800 border border-slate-700 text-slate-400 px-2.5 py-1 rounded-lg">{ch}</span>)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'launch' && <LaunchTrackerTab />}
        {activeTab === 'communities' && <CommunityHubTab />}
      </div>

      {exportHtml && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800 flex-shrink-0">
            <span className="text-white font-medium text-sm">Marketing Plan — Print / Save PDF</span>
            <div className="flex gap-2">
              <button onClick={() => iframeRef.current?.contentWindow?.print()} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">🖨️ Print / Save PDF</button>
              <button onClick={() => setExportHtml(null)} className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 text-sm px-4 py-1.5 rounded-lg transition-colors">✕ Close</button>
            </div>
          </div>
          <iframe ref={iframeRef} srcDoc={exportHtml} className="flex-1 w-full border-0 bg-white" />
        </div>
      )}
    </>
  )
}
