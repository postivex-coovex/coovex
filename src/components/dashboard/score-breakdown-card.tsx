'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

interface ScoreBreakdownCardProps {
  scores: {
    website:   number | null
    seo:       number | null
    geo:       number | null
    linkedin:  number | null
    facebook:  number | null
    twitter:   number | null
    community: number | null
  }
}

const ITEMS = [
  { key: 'website',   label: 'Website',          icon: '🌐', href: '/audit' },
  { key: 'seo',       label: 'SEO',              icon: '🔍', href: '/audit' },
  { key: 'geo',       label: 'GEO / AI',         icon: '🤖', href: '/audit' },
  { key: 'linkedin',  label: 'LinkedIn',         icon: '💼', href: '/integrations' },
  { key: 'facebook',  label: 'Facebook',         icon: '📘', href: '/integrations' },
  { key: 'twitter',   label: 'Twitter / X',      icon: '🐦', href: '/integrations' },
  { key: 'community', label: 'Community / Dir.', icon: '📍', href: '/integrations' },
] as const

function scoreColor(s: number | null) {
  if (s === null) return { bar: 'bg-slate-700', text: 'text-slate-600' }
  if (s >= 75)   return { bar: 'bg-emerald-500', text: 'text-emerald-400' }
  if (s >= 50)   return { bar: 'bg-amber-500',   text: 'text-amber-400' }
  return           { bar: 'bg-red-500',           text: 'text-red-400' }
}

function ScoreRow({ label, icon, href, score }: { label: string; icon: string; href: string; score: number | null }) {
  const { bar, text } = scoreColor(score)

  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-slate-800/60 last:border-0">
      <span className="text-base w-5 text-center leading-none shrink-0">{icon}</span>
      <span className="text-xs text-slate-400 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', bar)}
          style={{ width: score !== null ? `${score}%` : '0%' }}
        />
      </div>
      {score !== null ? (
        <span className={cn('text-xs font-bold w-8 text-right shrink-0', text)}>{score}</span>
      ) : (
        <Link
          href={href}
          className="text-[10px] text-violet-400 hover:text-violet-300 font-medium w-8 text-right shrink-0 whitespace-nowrap"
        >
          Scan →
        </Link>
      )}
    </div>
  )
}

export function ScoreBreakdownCard({ scores }: ScoreBreakdownCardProps) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
      <h3 className="text-sm font-medium text-slate-400 mb-3">Score Breakdown</h3>
      <div>
        {ITEMS.map(item => (
          <ScoreRow
            key={item.key}
            label={item.label}
            icon={item.icon}
            href={item.href}
            score={scores[item.key]}
          />
        ))}
      </div>
    </div>
  )
}
