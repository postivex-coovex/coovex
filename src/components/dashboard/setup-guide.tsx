'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface SetupGuideProps {
  steps: {
    hasAudit:       boolean
    hasProducts:    boolean
    hasSocial:      boolean
    hasCompetitors: boolean
    knowsIcp:       boolean
    hasCampaign:    boolean
    hasLeads:       boolean
    hasEmail:       boolean
    hasProposal:    boolean
    hasCrm:        boolean
  }
  userName?: string
}

const DISMISS_KEY = 'coovex_setup_dismissed'

const TASK_LIST = [
  {
    id: 'audit',
    icon: '🔍',
    title: 'Website Analysis',
    desc: 'AI learns your brand voice, positioning, and site structure.',
    href: '/audit',
    ai: true,
    doneKey: 'hasAudit' as const,
    prereq: false,
  },
  {
    id: 'products',
    icon: '📦',
    title: 'Add Products & Services',
    desc: 'Help AI know what you sell for better targeting and proposals.',
    href: '/products',
    ai: false,
    doneKey: 'hasProducts' as const,
    prereq: false,
  },
  {
    id: 'social',
    icon: '🔗',
    title: 'Connect Social Profiles',
    desc: 'AI monitors & auto-generates social content daily.',
    href: '/integrations',
    ai: true,
    doneKey: 'hasSocial' as const,
    prereq: false,
  },
  {
    id: 'competitors',
    icon: '🕵️',
    title: 'Competitor Analysis',
    desc: 'AI tracks rivals, pricing changes & new content in real-time.',
    href: '/competitors',
    ai: true,
    doneKey: 'hasCompetitors' as const,
    prereq: true,
  },
  {
    id: 'icp',
    icon: '🎯',
    title: 'ICP Building with AI',
    desc: 'Define your Ideal Customer Profile for precision targeting.',
    href: '/leads',
    ai: true,
    doneKey: 'knowsIcp' as const,
    prereq: true,
  },
  {
    id: 'campaign',
    icon: '📋',
    title: 'Create Marketing Plan',
    desc: 'AI builds a growth plan based on your goals and target market.',
    href: '/campaigns',
    ai: true,
    doneKey: 'hasCampaign' as const,
    prereq: true,
  },
  {
    id: 'leads',
    icon: '👥',
    title: 'Find 10–20 Leads',
    desc: 'AI discovers qualified leads from your target market right now.',
    href: '/leads',
    ai: true,
    doneKey: 'hasLeads' as const,
    prereq: true,
  },
  {
    id: 'email',
    icon: '📧',
    title: 'Connect Email SMTP',
    desc: 'Set up your email so AI runs campaigns from your own domain.',
    href: '/settings',
    ai: false,
    doneKey: 'hasEmail' as const,
    prereq: true,
  },
  {
    id: 'proposal',
    icon: '📄',
    title: 'Send First Proposal',
    desc: 'AI generates a polished tracked proposal — impress your first client.',
    href: '/proposals',
    ai: true,
    doneKey: 'hasProposal' as const,
    prereq: true,
  },
  {
    id: 'crm',
    icon: '🔄',
    title: 'Integrate Your CRM',
    desc: 'AI learns from every deal and improves its daily advice.',
    href: '/integrations',
    ai: false,
    doneKey: 'hasCrm' as const,
    prereq: true,
  },
]

const PREREQ_TASKS = TASK_LIST.filter(t => !t.prereq)

export function SetupGuide({ steps, userName }: SetupGuideProps) {
  const [dismissed, setDismissed] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mounted,   setMounted]   = useState(false)
  const [lockedAlert, setLockedAlert] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
    }
  }, [])

  const tasks = TASK_LIST.map(t => ({ ...t, done: steps[t.doneKey] }))
  const doneCount = tasks.filter(t => t.done).length
  const total     = tasks.length
  const pct       = Math.round((doneCount / total) * 100)
  const allDone   = doneCount === total

  // Prerequisites: first 3 tasks must all be done
  const pendingPrereqs = PREREQ_TASKS.filter(t => !steps[t.doneKey])
  const prereqsDone = pendingPrereqs.length === 0

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  if (!mounted || dismissed || allDone) return null

  return (
    <>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="text-base">🚀</span>
            <div className="flex items-center gap-3">
              <h2 className="text-white font-semibold text-sm">
                AI Setup{userName ? `, ${userName.split(' ')[0]}` : ''}
              </h2>
              <div className="hidden sm:flex items-center gap-1.5">
                <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-slate-500">{doneCount}/{total}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed(c => !c)}
              className="text-slate-600 hover:text-slate-400 text-[10px] transition-colors px-1.5 py-1 rounded hover:bg-slate-800"
            >
              {collapsed ? '▼' : '▲'}
            </button>
            <button
              onClick={dismiss}
              className="text-slate-600 hover:text-slate-400 text-[10px] transition-colors px-1.5 py-1 rounded hover:bg-slate-800"
              title="Dismiss forever"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Task grid */}
        {!collapsed && (
          <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {tasks.map(task => {
              const isLocked = task.prereq && !prereqsDone && !task.done

              if (task.done) {
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 px-3 py-3 rounded-xl border border-emerald-800/30 bg-emerald-950/10"
                  >
                    <span className="text-lg leading-none shrink-0">{task.icon}</span>
                    <span className="text-xs text-slate-500 line-through truncate flex-1 font-medium">{task.title}</span>
                    <span className="text-emerald-500 text-sm shrink-0">✓</span>
                  </div>
                )
              }

              if (isLocked) {
                return (
                  <button
                    key={task.id}
                    onClick={() => setLockedAlert(true)}
                    className="relative flex items-center gap-2.5 px-3 py-3 rounded-xl border border-slate-800 bg-slate-800/20 cursor-not-allowed text-left w-full"
                  >
                    <span className="text-lg leading-none shrink-0 opacity-40">{task.icon}</span>
                    <span className="text-xs font-semibold text-slate-600 truncate flex-1 leading-tight">{task.title}</span>
                    <span className="absolute top-1.5 right-1.5 text-slate-600 text-[11px] leading-none">🔒</span>
                  </button>
                )
              }

              return (
                <Link
                  key={task.id}
                  href={task.href}
                  className="relative flex items-center gap-2.5 px-3 py-3 rounded-xl border border-slate-700/60 bg-slate-800/30 hover:border-violet-500/50 hover:bg-violet-500/5 transition-colors group"
                >
                  <span className="text-lg leading-none shrink-0">{task.icon}</span>
                  <span className="text-xs font-semibold text-slate-300 truncate flex-1 group-hover:text-white leading-tight">{task.title}</span>
                  {task.ai && (
                    <span className="absolute top-1.5 right-1.5 text-[9px] font-bold bg-violet-600 text-white px-1.5 py-0.5 rounded uppercase leading-none tracking-wide">AI</span>
                  )}
                </Link>
              )
            })}
          </div>
        )}

        {/* Prereq hint bar */}
        {!collapsed && !prereqsDone && (
          <div className="mx-4 mb-3 flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: '#92400e', border: '1px solid #b45309' }}>
            <span className="text-lg shrink-0">🔒</span>
            <p className="text-xs leading-snug" style={{ color: '#ffffff' }}>
              <span className="font-bold">Unlock the rest:</span> Complete{' '}
              <span className="font-bold" style={{ color: '#fde68a' }}>
                {pendingPrereqs.map(t => t.title).join(', ')}
              </span>
              {' '}first.
            </p>
          </div>
        )}
      </div>

      {/* Lock alert modal */}
      {lockedAlert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setLockedAlert(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🔒</span>
              <h3 className="text-white font-semibold text-base">Complete setup first</h3>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Finish these 3 foundation steps before unlocking the rest of CooVex AI:
            </p>
            <div className="space-y-2 mb-5">
              {pendingPrereqs.map(t => (
                <div key={t.id} className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full border-2 border-amber-500/60 flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-amber-500/60" />
                  </span>
                  <span className="text-sm text-slate-300">
                    {t.icon} {t.title}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              {pendingPrereqs.length === 1 ? (
                <Link
                  href={pendingPrereqs[0].href}
                  onClick={() => setLockedAlert(false)}
                  className="flex-1 text-center py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
                >
                  Go to {pendingPrereqs[0].title}
                </Link>
              ) : (
                <button
                  onClick={() => setLockedAlert(false)}
                  className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
                >
                  Got it
                </button>
              )}
              <button
                onClick={() => setLockedAlert(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
