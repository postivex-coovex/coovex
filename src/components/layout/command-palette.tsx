'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, LayoutDashboard, Users, Star, Calendar, Target, TrendingUp,
  BarChart3, ClipboardCheck, FileText, Mail, Lightbulb, Bot, MessageSquare,
  Settings, Zap, Building2, FileDown, Activity, Crosshair,
  ThumbsUp, DollarSign, PieChart, Map, UserCircle, Presentation, BookOpen,
  LineChart, Sparkles, RefreshCw, PlusCircle, ArrowRight, Snowflake, Bell, Filter, Package,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  group: string
  keywords?: string[]
}

interface AgentAction {
  label: string
  desc: string
  icon: React.ElementType
  action: () => Promise<void>
}

const NAV_ITEMS: NavItem[] = [
  // Pages
  { label: 'Dashboard',      href: '/dashboard',              icon: LayoutDashboard, group: 'Pages', keywords: ['home', 'inbox', 'signals'] },
  { label: 'Agent Report',   href: '/agent/report',           icon: Bot,             group: 'Pages', keywords: ['daily', 'activity', 'timeline'] },
  { label: 'Notifications',  href: '/notifications',          icon: Bell,            group: 'Pages', keywords: ['alerts', 'signals'] },
  { label: 'Agency View',    href: '/agency',                 icon: Building2,       group: 'Pages', keywords: ['clients', 'agency'] },
  // Setup
  { label: 'Audit',          href: '/audit',                  icon: ClipboardCheck,  group: 'Setup',  keywords: ['website', 'seo', 'health'] },
  { label: 'Goals',          href: '/goals',                  icon: Crosshair,       group: 'Setup',  keywords: ['okr', 'targets'] },
  { label: 'Products',       href: '/products',               icon: Package,         group: 'Setup',  keywords: ['services', 'offerings'] },
  // Growth
  { label: 'Leads',          href: '/leads',                  icon: Users,           group: 'Growth', keywords: ['pipeline', 'crm', 'contacts'] },
  { label: 'Cold Leads',     href: '/leads/cold',             icon: Snowflake,       group: 'Growth', keywords: ['re-engage', 'inactive', 'stale'] },
  { label: 'Lead Funnel',    href: '/leads/funnel',           icon: Filter,          group: 'Growth', keywords: ['pipeline', 'conversion', 'stages'] },
  { label: 'Campaigns',      href: '/campaigns',              icon: Mail,            group: 'Growth', keywords: ['email', 'marketing', 'drip'] },
  // Intelligence
  { label: 'Competitors',    href: '/competitors',            icon: Target,          group: 'Intel',  keywords: ['rival', 'analysis'] },
  { label: 'Benchmark',      href: '/competitors/benchmark',  icon: TrendingUp,      group: 'Intel',  keywords: ['compare', 'market'] },
  { label: 'Trends',         href: '/trends',                 icon: TrendingUp,      group: 'Intel' },
  { label: 'Analytics',      href: '/analytics',              icon: BarChart3,       group: 'Intel' },
  { label: 'Metrics',        href: '/metrics',                icon: Activity,        group: 'Intel',  keywords: ['kpi', 'history'] },
  // Engagement
  { label: 'Reviews',        href: '/reviews',                icon: Star,            group: 'Engage', keywords: ['ratings', 'feedback', 'google'] },
  { label: 'Content',        href: '/content',                icon: Calendar,        group: 'Engage', keywords: ['posts', 'schedule', 'social'] },
  { label: 'Post Performance',href: '/content/performance',   icon: BarChart3,       group: 'Engage', keywords: ['engagement', 'views', 'likes'] },
  { label: 'NPS Survey',     href: '/nps',                    icon: ThumbsUp,        group: 'Engage', keywords: ['satisfaction', 'survey'] },
  // Finance
  { label: 'Revenue',        href: '/revenue',                icon: DollarSign,      group: 'Finance', keywords: ['deals', 'income', 'won'] },
  { label: 'Forecast',       href: '/forecast',               icon: LineChart,       group: 'Finance', keywords: ['pipeline', 'predict'] },
  { label: 'Reports',        href: '/reports',                icon: FileDown,        group: 'Finance' },
  { label: 'Proposals',      href: '/proposals',              icon: FileText,        group: 'Finance', keywords: ['quotes', 'send'] },
  { label: 'Attribution',    href: '/attribution',            icon: PieChart,        group: 'Finance', keywords: ['source', 'channel', 'roi'] },
  // AI Tools
  { label: 'SWOT Analysis',  href: '/tools/swot',             icon: Lightbulb,       group: 'AI Tools' },
  { label: 'ICP Builder',    href: '/tools/persona',          icon: UserCircle,      group: 'AI Tools', keywords: ['persona', 'customer'] },
  { label: 'Pitch Deck',     href: '/tools/pitch-deck',       icon: Presentation,    group: 'AI Tools', keywords: ['slides', 'investor'] },
  { label: 'Business Plan',  href: '/tools/business-plan',    icon: BookOpen,        group: 'AI Tools' },
  { label: 'Marketing Plan', href: '/tools/marketing-plan',   icon: TrendingUp,      group: 'AI Tools', keywords: ['strategy', 'growth'] },
  { label: 'Valuation',      href: '/tools/valuation',        icon: DollarSign,      group: 'AI Tools', keywords: ['worth', 'price'] },
  { label: 'Journey Map',    href: '/tools/journey',          icon: Map,             group: 'AI Tools', keywords: ['customer journey'] },
  { label: 'AI Coach',       href: '/chat',                   icon: MessageSquare,   group: 'AI Tools', keywords: ['chat', 'ask', 'help'] },
  { label: 'Chatbot',        href: '/chatbot',                icon: Bot,             group: 'AI Tools', keywords: ['widget', 'embed'] },
  // Settings
  { label: 'Settings',       href: '/settings',               icon: Settings,        group: 'Settings' },
  { label: 'Integrations',   href: '/integrations',           icon: Zap,             group: 'Settings', keywords: ['connect', 'api', 'webhook'] },
  { label: 'Email Settings', href: '/settings/email',         icon: Mail,            group: 'Settings', keywords: ['smtp', 'sending'] },
  { label: 'Team',           href: '/settings/team',          icon: Users,           group: 'Settings', keywords: ['members', 'invite'] },
  { label: 'Agent Settings', href: '/settings/agent',         icon: Bot,             group: 'Settings' },
  { label: 'White-Label',    href: '/settings/white-label',   icon: Sparkles,        group: 'Settings', keywords: ['brand', 'custom'] },
  { label: 'Lead Scoring',   href: '/settings/scoring',       icon: Target,          group: 'Settings' },
  { label: 'Agent Memory',   href: '/settings/agent-memory',  icon: Bot,             group: 'Settings' },
]

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

const RECENT_KEY = 'cv_recent_pages'
const MAX_RECENT  = 6

function getRecentHrefs(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}
export function trackPageVisit(href: string) {
  try {
    const prev = getRecentHrefs().filter(h => h !== href)
    localStorage.setItem(RECENT_KEY, JSON.stringify([href, ...prev].slice(0, MAX_RECENT)))
  } catch {}
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery]           = useState('')
  const [selected, setSelected]     = useState(0)
  const [actionStatus, setActionStatus] = useState<string | null>(null)
  const [recentHrefs, setRecentHrefs]   = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const agentActions: AgentAction[] = [
    {
      label: 'Generate Daily Brief',
      desc: 'Ask the AI agent to generate today\'s business brief',
      icon: Sparkles,
      action: async () => {
        setActionStatus('Generating brief…')
        await fetch('/api/agent/brief', { method: 'POST' }).catch(() => {})
        setActionStatus('Brief generated! Check Agent Inbox.')
        setTimeout(() => { setActionStatus(null); router.push('/dashboard') }, 1500)
      },
    },
    {
      label: 'Fill Content Calendar',
      desc: 'Auto-generate this month\'s social media posts',
      icon: Calendar,
      action: async () => {
        setActionStatus('Generating posts…')
        await fetch('/api/posts/fill-month', { method: 'POST' }).catch(() => {})
        setActionStatus('Calendar filled! Check Content page.')
        setTimeout(() => { setActionStatus(null); router.push('/content') }, 1500)
      },
    },
    {
      label: 'Run Pipeline Intelligence',
      desc: 'Scan for stale deals and uncontacted leads',
      icon: Target,
      action: async () => {
        setActionStatus('Scanning pipeline…')
        await fetch('/api/forecast', { method: 'POST' }).catch(() => {})
        setActionStatus('Pipeline signals added to inbox.')
        setTimeout(() => { setActionStatus(null); router.push('/dashboard') }, 1500)
      },
    },
    {
      label: 'Record Metrics Snapshot',
      desc: 'Save today\'s KPIs to metrics history',
      icon: Activity,
      action: async () => {
        setActionStatus('Recording snapshot…')
        await fetch('/api/metrics/snapshot', { method: 'POST' }).catch(() => {})
        setActionStatus('Snapshot saved!')
        setTimeout(() => { setActionStatus(null); onClose() }, 1200)
      },
    },
    {
      label: 'Add a New Lead',
      desc: 'Navigate to leads and open the add form',
      icon: PlusCircle,
      action: async () => {
        router.push('/leads?new=1')
        onClose()
      },
    },
    {
      label: 'Run Website Audit',
      desc: 'Re-audit your business website now',
      icon: RefreshCw,
      action: async () => {
        router.push('/audit')
        onClose()
      },
    },
  ]

  const recentItems = recentHrefs
    .map(h => NAV_ITEMS.find(n => n.href === h))
    .filter(Boolean) as NavItem[]

  const filteredNav = query.trim()
    ? NAV_ITEMS.filter(item => {
        const q = query.toLowerCase()
        return (
          item.label.toLowerCase().includes(q) ||
          item.group.toLowerCase().includes(q) ||
          item.keywords?.some(k => k.includes(q))
        )
      })
    : (recentItems.length > 0 ? recentItems : NAV_ITEMS.slice(0, 6))

  const filteredActions = query.trim()
    ? agentActions.filter(a =>
        a.label.toLowerCase().includes(query.toLowerCase()) ||
        a.desc.toLowerCase().includes(query.toLowerCase())
      )
    : agentActions.slice(0, 3)

  const totalItems = filteredNav.length + filteredActions.length

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setActionStatus(null)
      setRecentHrefs(getRecentHrefs())
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const handleSelect = useCallback((index: number) => {
    if (index < filteredNav.length) {
      router.push(filteredNav[index].href)
      onClose()
    } else {
      const action = filteredActions[index - filteredNav.length]
      if (action) action.action()
    }
  }, [filteredNav, filteredActions, router, onClose])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, totalItems - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter') { e.preventDefault(); handleSelect(selected) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, selected, totalItems, handleSelect, onClose])

  useEffect(() => { setSelected(0) }, [query])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800">
          <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages, actions, AI tools…"
            className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none"
          />
          <kbd className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">ESC</kbd>
        </div>

        {/* Action status */}
        {actionStatus && (
          <div className="px-4 py-2.5 bg-violet-950/40 border-b border-violet-800/30 text-violet-300 text-xs flex items-center gap-2">
            <Sparkles className="w-3 h-3 animate-pulse" />
            {actionStatus}
          </div>
        )}

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {/* Navigation items */}
          {filteredNav.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                {query ? 'Pages' : 'Recent Pages'}
              </p>
              {filteredNav.map((item, i) => {
                const isSelected = i === selected
                return (
                  <button
                    key={item.href}
                    onClick={() => handleSelect(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-violet-600/20 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-violet-400' : 'text-slate-500'}`} />
                    <span className="flex-1 text-sm">{item.label}</span>
                    <span className="text-[10px] text-slate-600">{item.group}</span>
                    {isSelected && <ArrowRight className="w-3 h-3 text-violet-500" />}
                  </button>
                )
              })}
            </div>
          )}

          {/* Agent Actions */}
          {filteredActions.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                Agent Actions
              </p>
              {filteredActions.map((action, j) => {
                const i = filteredNav.length + j
                const isSelected = i === selected
                return (
                  <button
                    key={action.label}
                    onClick={() => handleSelect(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-violet-600/20 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-violet-600/30 border border-violet-500/30' : 'bg-slate-800 border border-slate-700'
                    }`}>
                      <action.icon className={`w-3.5 h-3.5 ${isSelected ? 'text-violet-400' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{action.label}</p>
                      <p className="text-xs text-slate-600 truncate">{action.desc}</p>
                    </div>
                    <span className="text-[10px] text-slate-600 flex-shrink-0">Run</span>
                  </button>
                )
              })}
            </div>
          )}

          {totalItems === 0 && (
            <div className="px-4 py-8 text-center text-slate-600 text-sm">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-800 flex items-center gap-4 text-[10px] text-slate-600">
          <span><kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700">↑↓</kbd> navigate</span>
          <span><kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700">↵</kbd> select</span>
          <span><kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700">esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
