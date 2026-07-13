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
    title: 'Run Website Audit',
    desc: 'AI learns your brand, SEO gaps, and GEO visibility in ~30 seconds.',
    href: '/audit',
    doneKey: 'hasAudit' as const,
  },
  {
    id: 'products',
    icon: '📦',
    title: 'Add Products & Services',
    desc: 'Help AI know what you sell — enables better lead targeting and proposals.',
    href: '/products',
    doneKey: 'hasProducts' as const,
  },
  {
    id: 'social',
    icon: '🔗',
    title: 'Connect Social Profiles',
    desc: 'AI monitors and auto-generates social content daily.',
    href: '/integrations',
    doneKey: 'hasSocial' as const,
  },
  {
    id: 'competitors',
    icon: '🕵️',
    title: 'Add Competitors',
    desc: 'AI tracks rival pricing, content, and feature changes in real-time.',
    href: '/competitors',
    doneKey: 'hasCompetitors' as const,
  },
  {
    id: 'leads',
    icon: '👥',
    title: 'Find Your First Leads',
    desc: 'AI discovers 10–20 qualified leads matching your ideal customer profile.',
    href: '/leads',
    doneKey: 'hasLeads' as const,
  },
  {
    id: 'email',
    icon: '📧',
    title: 'Connect Email SMTP',
    desc: 'Set up your email so AI runs outreach campaigns from your own domain.',
    href: '/settings',
    doneKey: 'hasEmail' as const,
  },
  {
    id: 'campaign',
    icon: '📋',
    title: 'Create a Campaign',
    desc: 'AI writes personalised outreach emails for your lead pipeline.',
    href: '/campaigns',
    doneKey: 'hasCampaign' as const,
  },
  {
    id: 'proposal',
    icon: '📄',
    title: 'Send a Proposal',
    desc: 'AI generates a polished tracked proposal — impress your first client.',
    href: '/proposals',
    doneKey: 'hasProposal' as const,
  },
  {
    id: 'crm',
    icon: '🔄',
    title: 'Integrate Your CRM',
    desc: 'AI learns from every deal and improves its daily advice.',
    href: '/integrations',
    doneKey: 'hasCrm' as const,
  },
]

export function SetupGuide({ steps, userName }: SetupGuideProps) {
  const [dismissed, setDismissed] = useState(false)
  const [mounted, setMounted]     = useState(false)
  const [showAll, setShowAll]     = useState(false)

  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
    }
  }, [])

  const tasks     = TASK_LIST.map(t => ({ ...t, done: steps[t.doneKey] }))
  const doneCount = tasks.filter(t => t.done).length
  const total     = tasks.length
  const pct       = Math.round((doneCount / total) * 100)
  const allDone   = doneCount === total
  const nextTask  = tasks.find(t => !t.done)

  if (!mounted || dismissed || allDone || !nextTask) return null

  const firstName = userName?.split(' ')[0] || ''

  return (
    <div className="bg-slate-900 border border-violet-800/30 rounded-2xl overflow-hidden">
      {/* Next step banner */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">
            {firstName ? `${firstName}'s next step` : 'Your next step'} · {doneCount}/{total} done
          </p>
          <button
            onClick={() => { localStorage.setItem(DISMISS_KEY, '1'); setDismissed(true) }}
            className="text-slate-600 hover:text-slate-400 text-xs transition-colors flex-shrink-0 -mt-0.5"
            title="Dismiss"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-full bg-slate-800 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-violet-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 flex-shrink-0">{pct}%</span>
        </div>

        <div className="flex items-start gap-4">
          <span className="text-2xl flex-shrink-0 mt-0.5">{nextTask.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm mb-0.5">{nextTask.title}</p>
            <p className="text-slate-400 text-xs leading-relaxed mb-3">{nextTask.desc}</p>
            <div className="flex items-center gap-3">
              <Link
                href={nextTask.href}
                className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Start Now →
              </Link>
              <button
                onClick={() => setShowAll(v => !v)}
                className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
              >
                {showAll ? '↑ Hide checklist' : `↓ See all ${total - doneCount} remaining`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable checklist */}
      {showAll && (
        <div className="border-t border-slate-800 divide-y divide-slate-800/50">
          {tasks.filter(t => !t.done).map(task => (
            <Link
              key={task.id}
              href={task.href}
              className="flex items-center gap-3 px-5 py-3 hover:bg-slate-800/40 transition-colors group"
            >
              <span className="text-base flex-shrink-0">{task.icon}</span>
              <p className="text-xs text-slate-300 group-hover:text-white flex-1">{task.title}</p>
              <span className="text-slate-600 group-hover:text-slate-400 text-xs">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
