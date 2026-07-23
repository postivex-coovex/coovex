'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Lightbulb, Package, Inbox,
  ClipboardCheck, Zap, Globe2, Users,
  Target, TrendingUp, Calendar,
  Settings, ChevronDown, Search, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BrandLogo } from './brand-logo'
import { ThemeToggle } from './theme-toggle'
import { WorkspaceSwitcher } from './workspace-switcher'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubItem {
  label: string
  href: string
  badge?: string
}

interface NavGroup {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  items: SubItem[]
}

interface FlatItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

// ── Navigation definition ─────────────────────────────────────────────────────

const FLAT_ITEMS: FlatItem[] = [
  { label: 'Dashboard',          href: '/dashboard',       icon: LayoutDashboard },
  { label: 'Getting Started',    href: '/getting-started', icon: Lightbulb },
  { label: 'Products & Service', href: '/products',        icon: Package },
  { label: 'Agent Tasks',        href: '/agent/inbox',     icon: Inbox },
]

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'audit',
    label: 'Audit',
    icon: ClipboardCheck,
    items: [
      { label: 'Overview',              href: '/audit' },
      { label: 'GEO Audit',             href: '/audit/geo' },
      { label: 'Intelligence Summary',  href: '/audit/intelligence' },
    ],
  },
  {
    id: 'gtm',
    label: 'GTM Autopilot',
    icon: Zap,
    badge: 'new',
    items: [
      { label: 'GTM Analyser',           href: '/gtm-agent' },
      { label: 'Platform Launch Tracker',href: '/gtm-agent/platform-launch' },
    ],
  },
  {
    id: 'geo',
    label: 'GEO Autopilot',
    icon: Globe2,
    badge: 'hot',
    items: [
      { label: 'Overview',          href: '/geo' },
      { label: 'AI Visibility Check', href: '/geo/ai-visibility' },
      { label: 'Topic Coverage',    href: '/geo/topics' },
      { label: 'Content to Create', href: '/geo/content' },
      { label: 'Dev Assistant',     href: '/geo/dev' },
    ],
  },
  {
    id: 'content',
    label: 'Content Autopilot',
    icon: Calendar,
    items: [
      { label: 'Overview',              href: '/content' },
      { label: 'AI Content Generator',  href: '/content/generator' },
      { label: 'Need To Create',        href: '/content/needs' },
      { label: 'Calendar',              href: '/content/calendar' },
      { label: 'Integration Agent',     href: '/content/integrations' },
    ],
  },
  {
    id: 'leads',
    label: 'Leads Automation',
    icon: Users,
    items: [
      { label: 'Overview',              href: '/leads' },
      { label: 'ICP Builder',           href: '/leads/icp' },
      { label: 'AI Leads Finder',       href: '/leads/find' },
      { label: 'Integrations & Import', href: '/leads/integrations' },
    ],
  },
  {
    id: 'business',
    label: 'Business Autopilot',
    icon: Target,
    items: [
      { label: 'Competitors',       href: '/competitors' },
      { label: 'Execution Roadmap', href: '/execution-roadmap', badge: 'new' },
      { label: 'Industry Trends',   href: '/trends' },
      { label: 'Progress Report',   href: '/agent/report' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing AI Agent',
    icon: TrendingUp,
    items: [
      { label: 'Proposal',            href: '/proposals' },
      { label: 'AI Marketing Plan',   href: '/tools/marketing-plan', badge: 'new' },
      { label: 'Email Configurations',href: '/settings/email' },
      { label: 'Email Campaigns',     href: '/campaigns' },
      { label: 'Leads Funnel',        href: '/leads/funnel' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    items: [
      { label: 'Teams',                  href: '/settings/team' },
      { label: 'Integrations',           href: '/integrations' },
      { label: 'Documentation & Guide',  href: '/docs' },
      { label: 'Coming Soon Features',   href: '/coming-soon' },
    ],
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

interface AppSidebarProps {
  user: { name?: string; email?: string } | null
  currentBusinessName?: string
  onNavClick?: () => void
  onSearchClick?: () => void
}

function groupContainsPath(group: NavGroup, pathname: string): boolean {
  return group.items.some(item =>
    pathname === item.href || pathname.startsWith(item.href + '/')
  )
}

export function AppSidebar({ user, currentBusinessName = 'My Business', onNavClick, onSearchClick }: AppSidebarProps) {
  const pathname = usePathname()
  const [inboxCount, setInboxCount] = useState(0)
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const active = new Set<string>()
    NAV_GROUPS.forEach(g => { if (groupContainsPath(g, pathname || '')) active.add(g.id) })
    return active
  })

  useEffect(() => {
    const t = setTimeout(() => {
      fetch('/api/agent/inbox-count')
        .then(r => r.json())
        .then(d => setInboxCount(d.count ?? 0))
        .catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [currentBusinessName])

  // Auto-expand group when navigating to one of its sub-items
  useEffect(() => {
    setOpenGroups(prev => {
      const next = new Set(prev)
      NAV_GROUPS.forEach(g => { if (groupContainsPath(g, pathname || '')) next.add(g.id) })
      return next
    })
  }, [pathname])

  function toggleGroup(id: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
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
      <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-0.5">

        {/* ── Flat items ── */}
        {FLAT_ITEMS.map(item => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                item.href === '/dashboard'
                  ? active
                    ? 'bg-blue-600/20 text-white ring-1 ring-blue-500/40'
                    : 'text-slate-100 hover:bg-slate-800'
                  : active
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )}
            >
              <item.icon className={cn(
                'w-4 h-4 flex-shrink-0',
                active ? 'text-blue-400' : 'text-slate-500'
              )} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.href === '/agent/inbox' && inboxCount > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none flex-shrink-0">
                  {inboxCount}
                </span>
              )}
            </Link>
          )
        })}

        {/* ── Divider ── */}
        <div className="my-2 border-t border-slate-800/60" />

        {/* ── Accordion groups ── */}
        {NAV_GROUPS.map(group => {
          const isOpen = openGroups.has(group.id)
          const groupActive = groupContainsPath(group, pathname || '')

          return (
            <div key={group.id}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left',
                  groupActive
                    ? 'text-blue-400 bg-blue-600/10'
                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800'
                )}
              >
                <group.icon className={cn(
                  'w-4 h-4 flex-shrink-0',
                  groupActive ? 'text-blue-400' : 'text-slate-500'
                )} />
                <span className="flex-1 truncate font-medium">{group.label}</span>
                {group.badge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white flex-shrink-0">
                    {group.badge}
                  </span>
                )}
                <ChevronDown className={cn(
                  'w-3.5 h-3.5 flex-shrink-0 transition-transform text-slate-500',
                  isOpen && 'rotate-180'
                )} />
              </button>

              {/* Sub-items */}
              {isOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-800 pl-2">
                  {group.items.map(item => {
                    const active = isActive(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavClick}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors',
                          active
                            ? 'bg-blue-600/20 text-blue-400'
                            : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
                        )}
                      >
                        <span className={cn(
                          'w-1 h-1 rounded-full flex-shrink-0',
                          active ? 'bg-blue-400' : 'bg-slate-700'
                        )} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white flex-shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
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
