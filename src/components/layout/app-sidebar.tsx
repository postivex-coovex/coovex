'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  LayoutDashboard, Calendar, Users, BarChart3,
  MessageSquare, Star, Target, TrendingUp,
  Settings, Zap, Search, ChevronRight, ClipboardCheck, FileText, Mail,
  Lightbulb, UserCircle, Presentation, BookOpen, LineChart, ThumbsUp, DollarSign,
  PieChart, Map, Bot, Building2, FileDown, Activity, Crosshair, Banknote, Snowflake, Bell, Filter, LogOut, Package, Globe2, LayoutGrid, Inbox, Radio, GripVertical, Pin, PinOff, FolderGit2, UserSquare2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BrandLogo } from './brand-logo'
import { trackPageVisit } from './command-palette'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { WorkspaceSwitcher } from '@/components/layout/workspace-switcher'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge: string | null
  sub: boolean
}

const navGroups: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { label: 'Dashboard',       href: '/dashboard',        icon: LayoutDashboard, badge: null,  sub: false },
      { label: 'Agent Inbox',     href: '/agent/inbox',      icon: Inbox,           badge: null,  sub: false },
      { label: 'Getting Started', href: '/getting-started',  icon: Lightbulb,       badge: null,  sub: false },
      { label: 'GTM Autopilot',   href: '/gtm-agent',        icon: Zap,             badge: 'new', sub: false },
      { label: 'Progress Report', href: '/agent/report',     icon: Bot,             badge: null,  sub: false },
      { label: 'Notifications',   href: '/notifications',    icon: Bell,            badge: null,  sub: false },
      { label: 'Agency View',     href: '/agency',           icon: Building2,       badge: null,  sub: false },
    ],
  },
  {
    label: 'Setup',
    items: [
      { label: 'Audit',         href: '/audit',    icon: ClipboardCheck, badge: null,  sub: false },
      { label: 'GEO Optimizer', href: '/geo',      icon: Globe2,         badge: 'hot', sub: false },
      { label: 'Goals',         href: '/goals',    icon: Crosshair,      badge: null,  sub: false },
      { label: 'Products',      href: '/products', icon: Package,        badge: null,  sub: false },
    ],
  },
  {
    label: 'Growth',
    items: [
      { label: 'Leads',           href: '/leads',           icon: Users,     badge: null,  sub: false },
      { label: 'Cold Leads',      href: '/leads/cold',      icon: Snowflake, badge: null,  sub: false },
      { label: 'Community Leads', href: '/community-leads', icon: Radio,     badge: 'new', sub: false },
      { label: 'Lead Funnel',     href: '/leads/funnel',    icon: Filter,    badge: null,  sub: false },
      { label: 'Campaigns',       href: '/campaigns',       icon: Mail,      badge: null,  sub: false },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'Competitors', href: '/competitors',           icon: Target,    badge: null, sub: false },
      { label: 'Benchmark',   href: '/competitors/benchmark', icon: TrendingUp,badge: null, sub: false },
      { label: 'Trends',      href: '/trends',               icon: LineChart,  badge: null, sub: false },
      { label: 'Analytics',   href: '/analytics',            icon: BarChart3,  badge: null, sub: false },
      { label: 'Metrics',     href: '/metrics',              icon: Activity,   badge: null, sub: false },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { label: 'Content',   href: '/content',       icon: Calendar,  badge: null, sub: false },
      { label: 'GEO Ideas', href: '/content/ideas', icon: Lightbulb, badge: null, sub: true  },
      { label: 'Reviews',   href: '/reviews',       icon: Star,      badge: null, sub: false },
      { label: 'NPS Survey',href: '/nps',           icon: ThumbsUp,  badge: null, sub: false },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Revenue',     href: '/revenue',     icon: Banknote,  badge: null, sub: false },
      { label: 'Forecast',    href: '/forecast',    icon: LineChart,  badge: null, sub: false },
      { label: 'Reports',     href: '/reports',     icon: FileDown,   badge: null, sub: false },
      { label: 'Proposals',   href: '/proposals',   icon: FileText,   badge: null, sub: false },
      { label: 'Attribution', href: '/attribution', icon: PieChart,   badge: null, sub: false },
    ],
  },
  {
    label: 'Resources',
    items: [
      { label: 'Software Hub', href: '/software', icon: LayoutGrid, badge: 'new', sub: false },
    ],
  },
  {
    label: 'AI Tools',
    items: [
      { label: 'SWOT Analysis',  href: '/tools/swot',           icon: Lightbulb,     badge: null,  sub: false },
      { label: 'ICP Builder',    href: '/tools/persona',        icon: UserCircle,    badge: null,  sub: false },
      { label: 'Pitch Deck',     href: '/tools/pitch-deck',     icon: Presentation,  badge: null,  sub: false },
      { label: 'Business Plan',  href: '/tools/business-plan',  icon: BookOpen,      badge: null,  sub: false },
      { label: 'Marketing Plan', href: '/tools/marketing-plan', icon: TrendingUp,    badge: 'new', sub: false },
      { label: 'Valuation',      href: '/tools/valuation',      icon: DollarSign,    badge: null,  sub: false },
      { label: 'Journey Map',    href: '/tools/journey',        icon: Map,           badge: null,  sub: false },
      { label: 'AI Coach',       href: '/chat',                 icon: MessageSquare, badge: 'new', sub: false },
      { label: 'Chatbot',        href: '/chatbot',              icon: Bot,           badge: null,  sub: false },
      { label: 'GitHub Coding',  href: '/github',               icon: FolderGit2,    badge: 'new', sub: false },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Settings',     href: '/settings',       icon: Settings,      badge: null, sub: false },
      { label: 'Team',         href: '/settings/team',  icon: UserSquare2,   badge: null, sub: true  },
      { label: 'Integrations', href: '/integrations',   icon: Zap,           badge: null, sub: true  },
      { label: 'Email',        href: '/settings/email', icon: Mail,          badge: null, sub: true  },
    ],
  },
]

// Flat lookup of all nav items by href
const ALL_ITEMS_MAP: Record<string, NavItem> = Object.fromEntries(
  navGroups.flatMap(g => g.items).map(item => [item.href, item])
)

const DEFAULT_PINS = [
  '/gtm-agent',
  '/agent/inbox',
  '/leads',
  '/community-leads',
  '/content',
  '/geo',
  '/competitors',
]

const LS_KEY = 'coovex:sidebar-pins'

function loadPins(): string[] {
  if (typeof window === 'undefined') return DEFAULT_PINS
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return DEFAULT_PINS
    const parsed = JSON.parse(raw) as string[]
    // Keep only hrefs that still exist
    return parsed.filter(h => h in ALL_ITEMS_MAP)
  } catch {
    return DEFAULT_PINS
  }
}

function savePins(pins: string[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(pins)) } catch {}
}

interface AppSidebarProps {
  user: { name?: string; email?: string } | null
  currentBusinessName?: string
  onNavClick?: () => void
  onSearchClick?: () => void
}

export function AppSidebar({ user, currentBusinessName = 'My Business', onNavClick, onSearchClick }: AppSidebarProps) {
  const pathname = usePathname()
  const [inboxCount, setInboxCount] = useState(0)
  const [contentDraftCount, setContentDraftCount] = useState(0)
  const [pins, setPins] = useState<string[]>(DEFAULT_PINS)
  const [hoveredHref, setHoveredHref] = useState<string | null>(null)

  // Drag state
  const dragSrc = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // Load pins from localStorage on mount
  useEffect(() => { setPins(loadPins()) }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      fetch('/api/agent/inbox-count')
        .then(r => r.json())
        .then(d => setInboxCount(d.count ?? 0))
        .catch(() => {})
      fetch('/api/posts/pending-count')
        .then(r => r.json())
        .then(d => setContentDraftCount(d.count ?? 0))
        .catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [currentBusinessName])

  useEffect(() => {
    const handler = () => setContentDraftCount(c => c + 1)
    window.addEventListener('coovex:content-draft-added', handler)
    return () => window.removeEventListener('coovex:content-draft-added', handler)
  }, [])

  const togglePin = useCallback((href: string) => {
    setPins(prev => {
      const next = prev.includes(href)
        ? prev.filter(h => h !== href)
        : [...prev, href]
      savePins(next)
      return next
    })
  }, [])

  // Drag handlers
  const onDragStart = (idx: number) => { dragSrc.current = idx }
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragOverIdx(idx)
  }
  const onDrop = (e: React.DragEvent, toIdx: number) => {
    e.preventDefault()
    const fromIdx = dragSrc.current
    if (fromIdx === null || fromIdx === toIdx) { setDragOverIdx(null); return }
    setPins(prev => {
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      savePins(next)
      return next
    })
    dragSrc.current = null
    setDragOverIdx(null)
  }
  const onDragEnd = () => { dragSrc.current = null; setDragOverIdx(null) }

  const pinnedItems = pins.map(h => ALL_ITEMS_MAP[h]).filter(Boolean) as NavItem[]

  function NavLink({ item, showPinBtn = true }: { item: NavItem; showPinBtn?: boolean }) {
    const active = pathname === item.href ||
      (item.href.length > 1 && item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
    const isPinned = pins.includes(item.href)
    const isHovered = hoveredHref === item.href
    const isDashboard = item.href === '/dashboard'

    return (
      <div
        className="relative group/navitem"
        onMouseEnter={() => setHoveredHref(item.href)}
        onMouseLeave={() => setHoveredHref(null)}
      >
        <Link
          href={item.href}
          onClick={() => { trackPageVisit(item.href); onNavClick?.() }}
          className={cn(
            'flex items-center gap-3 rounded-lg text-sm transition-all group',
            item.sub ? 'px-3 py-1.5 ml-4 pr-7' : 'px-3 py-2 pr-7',
            active
              ? isDashboard
                ? 'bg-violet-600/25 text-violet-300 ring-1 ring-violet-600/40'
                : 'bg-blue-600/20 text-blue-400'
              : isDashboard
                ? 'bg-slate-800 text-slate-200 hover:bg-violet-900/30 hover:text-violet-200 ring-1 ring-slate-700/60'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          )}
        >
          <item.icon className={cn(
            'flex-shrink-0',
            item.sub ? 'w-3.5 h-3.5' : 'w-4 h-4',
            active
              ? isDashboard ? 'text-violet-400' : 'text-blue-400'
              : isDashboard ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-400'
          )} />
          <span className={cn('flex-1 truncate', item.sub && 'text-[13px]')}>{item.label}</span>
          {item.badge && (
            <Badge className="text-xs px-1.5 py-0 bg-blue-600 text-white border-0 flex-shrink-0">
              {item.badge}
            </Badge>
          )}
          {item.href === '/content' && contentDraftCount > 0 && (
            <span className="bg-amber-500 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none flex-shrink-0">
              {contentDraftCount}
            </span>
          )}
          {item.href === '/agent/inbox' && inboxCount > 0 && (
            <span className="bg-violet-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none flex-shrink-0">
              {inboxCount}
            </span>
          )}
          {active && <ChevronRight className="w-3 h-3 text-blue-500 flex-shrink-0" />}
        </Link>

        {/* Pin/unpin button */}
        {showPinBtn && isHovered && (
          <button
            onClick={(e) => { e.stopPropagation(); togglePin(item.href) }}
            title={isPinned ? 'Remove from favorites' : 'Add to favorites'}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-slate-600 hover:text-amber-400 transition-colors"
          >
            {isPinned
              ? <PinOff className="w-3 h-3" />
              : <Pin className="w-3 h-3" />
            }
          </button>
        )}
      </div>
    )
  }

  return (
    <aside className="w-60 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
      {/* Logo */}
      <div className="h-20 flex items-center px-5 border-b border-slate-800">
        <Link href="/dashboard"><BrandLogo iconSize="h-11" textSize="text-xl" /></Link>
      </div>

      {/* Workspace switcher */}
      <WorkspaceSwitcher currentBusinessName={currentBusinessName} />

      {/* Search */}
      <div className="px-3 pt-1 pb-1">
        <button
          onClick={onSearchClick}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-slate-800 text-slate-400 text-sm hover:bg-slate-700 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search...</span>
          <span className="ml-auto text-xs bg-slate-700 px-1.5 py-0.5 rounded">⌘K</span>
        </button>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">

        {/* ── FAVORITES (drag-sortable) ── */}
        {pinnedItems.length > 0 && (
          <div className="mb-3">
            <p className="px-3 py-1 text-[10px] font-semibold text-amber-500/80 uppercase tracking-wider flex items-center gap-1.5">
              <Star className="w-2.5 h-2.5 fill-amber-500/80" /> Favorites
            </p>
            <div className="space-y-0.5">
              {pinnedItems.map((item, idx) => {
                const active = pathname === item.href ||
                  (item.href.length > 1 && item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
                const isHovered = hoveredHref === `pin:${item.href}`
                const isDragOver = dragOverIdx === idx

                return (
                  <div
                    key={item.href}
                    draggable
                    onDragStart={() => onDragStart(idx)}
                    onDragOver={e => onDragOver(e, idx)}
                    onDrop={e => onDrop(e, idx)}
                    onDragEnd={onDragEnd}
                    onMouseEnter={() => setHoveredHref(`pin:${item.href}`)}
                    onMouseLeave={() => setHoveredHref(null)}
                    className={cn(
                      'relative rounded-md transition-all',
                      isDragOver && 'ring-1 ring-amber-500/40 bg-amber-500/5'
                    )}
                  >
                    <Link
                      href={item.href}
                      onClick={() => { trackPageVisit(item.href); onNavClick?.() }}
                      className={cn(
                        'flex items-center gap-2 rounded-md text-sm transition-colors group px-3 py-1.5 pl-8 pr-7',
                        active
                          ? 'bg-blue-600/20 text-blue-400'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      )}
                    >
                      <item.icon className={cn(
                        'flex-shrink-0 w-3.5 h-3.5',
                        active ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-400'
                      )} />
                      <span className="flex-1 truncate text-[13px]">{item.label}</span>
                      {item.badge && (
                        <Badge className="text-[10px] px-1 py-0 bg-blue-600 text-white border-0 flex-shrink-0">
                          {item.badge}
                        </Badge>
                      )}
                      {item.href === '/content' && contentDraftCount > 0 && (
                        <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none flex-shrink-0">
                          {contentDraftCount}
                        </span>
                      )}
                      {item.href === '/agent/inbox' && inboxCount > 0 && (
                        <span className="bg-violet-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none flex-shrink-0">
                          {inboxCount}
                        </span>
                      )}
                    </Link>

                    {/* Drag handle */}
                    <GripVertical className={cn(
                      'absolute left-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 cursor-grab active:cursor-grabbing transition-opacity',
                      isHovered ? 'opacity-100' : 'opacity-0'
                    )} />

                    {/* Unpin button */}
                    {isHovered && (
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePin(item.href) }}
                        title="Remove from favorites"
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-slate-600 hover:text-red-400 transition-colors"
                      >
                        <PinOff className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── ALL NAV GROUPS ── */}
        {navGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-3' : ''}>
            {group.label && (
              <p className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavLink key={item.href} item={item} showPinBtn />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Admin section */}
      {user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
        <div className="px-3 pb-1 border-t border-slate-800/60 pt-2">
          <p className="px-3 py-1 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Admin</p>
          <Link
            href="/admin"
            onClick={onNavClick}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group',
              pathname === '/admin'
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            )}
          >
            <Settings className="w-4 h-4 flex-shrink-0 text-slate-600 group-hover:text-slate-400" />
            <span>Admin Panel</span>
          </Link>
        </div>
      )}

      {/* Bottom: theme + user */}
      <div className="px-3 py-3 border-t border-slate-800 space-y-0.5">
        <ThemeToggle />
        <div className="flex items-center gap-2 px-3 py-2 mt-1">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white font-medium flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-300 truncate font-medium">{user?.name ?? 'User'}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email ?? ''}</p>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              title="Sign out"
              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
