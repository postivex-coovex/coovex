'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export interface OnboardingSteps {
  hasProfile:      boolean
  hasProducts:     boolean
  hasGeoScan:      boolean
  hasCompetitors:  boolean
  hasIntelligence: boolean
  hasGenerators:   boolean
  hasGtm:          boolean
  hasLeads:        boolean
  hasProposal:     boolean
}

const PHASES = [
  {
    id: 'setup',
    label: 'Setup',
    emoji: '⚙️',
    steps: [
      {
        key: 'hasProfile' as const,
        icon: '🏢',
        title: 'Business Profile',
        desc: 'Add your business name, website, industry and target customer.',
        href: '/settings',
        cta: 'Complete Profile',
      },
      {
        key: 'hasProducts' as const,
        icon: '📦',
        title: 'Products & Services',
        desc: 'Tell AI what you sell — this makes every analysis far more accurate.',
        href: '/products',
        cta: 'Add Products',
      },
    ],
  },
  {
    id: 'understand',
    label: 'Understand',
    emoji: '🔍',
    steps: [
      {
        key: 'hasGeoScan' as const,
        icon: '🌐',
        title: 'Run GEO Scan',
        desc: "See your current AI visibility score and what's missing on your website.",
        href: '/geo',
        cta: 'Run Scan',
      },
      {
        key: 'hasCompetitors' as const,
        icon: '🕵️',
        title: 'Add Competitors',
        desc: 'AI tracks competitor pricing, content and features — gives you context.',
        href: '/competitors',
        cta: 'Add Competitors',
      },
      {
        key: 'hasIntelligence' as const,
        icon: '🧠',
        title: 'AI Intelligence Report',
        desc: 'See exactly how AI assistants like ChatGPT and Gemini describe your business.',
        href: '/geo?tab=intelligence',
        cta: 'Generate Report',
      },
    ],
  },
  {
    id: 'grow',
    label: 'Grow',
    emoji: '🚀',
    steps: [
      {
        key: 'hasGenerators' as const,
        icon: '🛠️',
        title: 'Fix AI Visibility',
        desc: 'Generate llms.txt and JSON-LD structured data — gets you into AI search results.',
        href: '/geo?tab=generators',
        cta: 'Fix Now',
      },
      {
        key: 'hasGtm' as const,
        icon: '🎯',
        title: 'GTM Strategy',
        desc: 'AI builds your go-to-market plan — which channels, what to post, and when.',
        href: '/tools/marketing-plan',
        cta: 'Build Strategy',
      },
      {
        key: 'hasLeads' as const,
        icon: '👥',
        title: 'Find Your First Leads',
        desc: 'AI discovers qualified prospects matching your ideal customer profile.',
        href: '/leads',
        cta: 'Find Leads',
      },
      {
        key: 'hasProposal' as const,
        icon: '📄',
        title: 'Send a Proposal',
        desc: 'AI writes a polished tracked proposal — close your first deal.',
        href: '/proposals',
        cta: 'Create Proposal',
      },
    ],
  },
]

const DISMISS_KEY = 'coovex_onboarding_v2_dismissed'

export function SetupGuide({ steps, userName }: { steps: OnboardingSteps; userName?: string }) {
  const [dismissed, setDismissed] = useState(false)
  const [mounted, setMounted]     = useState(false)

  useEffect(() => {
    setMounted(true)
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
  }, [])

  const allStepKeys = PHASES.flatMap(p => p.steps.map(s => s.key))
  const doneCount   = allStepKeys.filter(k => steps[k]).length
  const total       = allStepKeys.length
  const allDone     = doneCount === total

  if (!mounted || dismissed || allDone) return null

  // Find current active phase (first phase with incomplete steps)
  const activePhaseIdx = PHASES.findIndex(p => p.steps.some(s => !steps[s.key]))

  const firstName = userName?.split(' ')[0] || ''

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">
            {firstName ? `${firstName}'s ` : ''}Getting Started
          </span>
          <span className="text-xs text-slate-500">{doneCount}/{total} done</span>
        </div>
        <button
          onClick={() => { localStorage.setItem(DISMISS_KEY, '1'); setDismissed(true) }}
          className="text-slate-600 hover:text-slate-400 text-xs transition-colors"
          title="Hide"
        >
          ✕
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-3 pb-1">
        <div className="w-full bg-slate-800 rounded-full h-1">
          <div
            className="h-1 rounded-full bg-violet-500 transition-all duration-500"
            style={{ width: `${Math.round((doneCount / total) * 100)}%` }}
          />
        </div>
      </div>

      {/* Phase tabs */}
      <div className="flex px-5 pt-3 pb-3 gap-2">
        {PHASES.map((phase, idx) => {
          const phaseDone  = phase.steps.filter(s => steps[s.key]).length
          const phaseTotal = phase.steps.length
          const isActive   = idx === activePhaseIdx
          const isComplete = phaseDone === phaseTotal
          const isLocked   = idx > activePhaseIdx

          return (
            <div
              key={phase.id}
              className={`flex-1 rounded-xl px-3 py-2.5 border transition-colors ${
                isActive
                  ? 'bg-violet-950/40 border-violet-700/50'
                  : isComplete
                  ? 'bg-emerald-950/20 border-emerald-800/30'
                  : 'bg-slate-800/30 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{phase.emoji}</span>
                <span className={`text-[11px] font-semibold ${
                  isActive ? 'text-violet-300' : isComplete ? 'text-emerald-400' : 'text-slate-600'
                }`}>
                  {phase.label}
                </span>
                {isLocked && <span className="text-[10px] text-slate-700">🔒</span>}
              </div>
              <div className="flex gap-1">
                {phase.steps.map(s => (
                  <div
                    key={s.key}
                    className={`h-1 flex-1 rounded-full ${
                      steps[s.key]
                        ? isActive ? 'bg-violet-500' : 'bg-emerald-500'
                        : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
              <p className={`text-[10px] mt-1 ${isActive ? 'text-violet-400' : isComplete ? 'text-emerald-500' : 'text-slate-700'}`}>
                {isComplete ? 'Complete ✓' : `${phaseDone}/${phaseTotal} done`}
              </p>
            </div>
          )
        })}
      </div>

      {/* Active phase steps */}
      {PHASES[activePhaseIdx] && (
        <div className="border-t border-slate-800">
          {PHASES[activePhaseIdx].steps.map((step, i) => {
            const done = steps[step.key]
            const isNext = !done && PHASES[activePhaseIdx].steps.slice(0, i).every(s => steps[s.key])

            return (
              <div
                key={step.key}
                className={`flex items-center gap-4 px-5 py-3.5 border-b border-slate-800/60 last:border-0 ${
                  done ? 'opacity-50' : ''
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-base ${
                  done ? 'bg-emerald-900/60' : isNext ? 'bg-violet-900/60' : 'bg-slate-800'
                }`}>
                  {done ? '✅' : step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${done ? 'text-slate-400 line-through' : 'text-white'}`}>
                    {step.title}
                  </p>
                  {!done && (
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.desc}</p>
                  )}
                </div>
                {!done && (
                  <Link
                    href={step.href}
                    className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                      isNext
                        ? 'bg-violet-600 hover:bg-violet-500 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                    }`}
                  >
                    {step.cta} →
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
