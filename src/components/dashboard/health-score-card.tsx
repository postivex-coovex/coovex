'use client'

import { getScoreGrade, getScoreColor, cn } from '@/lib/utils'

interface HealthScoreCardProps {
  score: number
}

export function HealthScoreCard({ score }: HealthScoreCardProps) {
  const grade = getScoreGrade(score)
  const color = getScoreColor(score)
  const circumference = 2 * Math.PI * 36
  const strokeDash = (score / 100) * circumference

  const gradeColors: Record<string, string> = {
    A: 'text-green-400', B: 'text-emerald-400', C: 'text-yellow-400', D: 'text-orange-400', F: 'text-red-400'
  }
  const ringColors: Record<string, string> = {
    A: '#22c55e', B: '#10b981', C: '#eab308', D: '#f97316', F: '#ef4444'
  }

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
      <h3 className="text-sm font-medium text-slate-400 mb-4">Business Health Score</h3>
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="#1e293b" strokeWidth="6" />
            <circle
              cx="40" cy="40" r="36"
              fill="none"
              stroke={ringColors[grade]}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${strokeDash} ${circumference}`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-xl font-bold', gradeColors[grade])}>{score}</span>
            <span className="text-slate-500 text-xs">/100</span>
          </div>
        </div>
        <div>
          <div className={cn('text-3xl font-bold', gradeColors[grade])}>{grade}</div>
          <div className="text-slate-400 text-sm">
            {score >= 75 ? 'Strong presence' : score >= 50 ? 'Room to improve' : 'Needs attention'}
          </div>
          <div className="text-slate-600 text-xs mt-1">Updated today</div>
        </div>
      </div>
    </div>
  )
}
