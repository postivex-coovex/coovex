'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { RefreshCw, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DailyTask } from '@/types'

interface Task {
  id: string
  title: string
  description?: string
  source?: 'audit' | 'gtm' | 'content'
  priority?: 'critical' | 'high' | 'medium' | 'low'
  action_data?: { url?: string }
  completed: boolean
  auto_completed?: boolean
}

const SOURCE_META = {
  audit:   { label: '🔍 Audit',   color: 'text-blue-400 bg-blue-950/40 border-blue-800/40' },
  gtm:     { label: '🚀 GTM',     color: 'text-violet-400 bg-violet-950/40 border-violet-800/40' },
  content: { label: '✍️ Content', color: 'text-amber-400 bg-amber-950/40 border-amber-800/40' },
}

const STREAK_LABEL = (n: number) => {
  if (n >= 30) return '🏆 30-day legend!'
  if (n >= 14) return '⚡ 2-week streak!'
  if (n >= 7)  return '🔥 7-day warrior!'
  if (n >= 3)  return `🔥 ${n}-day streak`
  return `🔥 ${n} day${n > 1 ? 's' : ''} in a row`
}

interface DailyTasksCardProps {
  tasks: DailyTask | null
  businessId?: string
  initialStreak?: number
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export function DailyTasksCard({ tasks, businessId, initialStreak = 0 }: DailyTasksCardProps) {
  const [taskList, setTaskList] = useState<Task[]>((tasks?.tasks_json as Task[]) ?? [])
  const [generating, setGenerating] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [streak, setStreak] = useState(initialStreak)
  const [justFinished, setJustFinished] = useState(false)

  useEffect(() => { setLabel(todayLabel()) }, [])

  useEffect(() => {
    if (taskList.length === 0 && businessId) generateTasks()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generateTasks() {
    setGenerating(true)
    try {
      const res = await fetch('/api/agent/tasks/generate', { method: 'POST' })
      const data = await res.json()
      if (data.tasks?.tasks_json) setTaskList(data.tasks.tasks_json as Task[])
    } finally {
      setGenerating(false)
    }
  }

  async function toggleTask(task: Task) {
    const newCompleted = !task.completed
    setTaskList(prev => prev.map(t => t.id === task.id ? { ...t, completed: newCompleted } : t))
    setSavingId(task.id)
    try {
      const res = await fetch(`/api/agent/daily-tasks/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newCompleted }),
      })
      const data = await res.json()
      if (data.allDone && data.streak) {
        setStreak(data.streak)
        setJustFinished(true)
      }
    } finally {
      setSavingId(null)
    }
  }

  const completed = taskList.filter(t => t.completed).length
  const total = taskList.length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const allDone = total > 0 && completed === total

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden transition-all duration-500',
      allDone ? 'bg-emerald-950/20 border-emerald-700/30' : 'bg-slate-900 border-slate-800'
    )}>
      {/* Colored progress strip */}
      <div className="h-1 w-full bg-slate-800">
        <div
          className={cn('h-full transition-all duration-700 rounded-full', allDone ? 'bg-emerald-500' : 'bg-blue-500')}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5">{label}</p>
            <h3 className="text-sm font-bold text-white">Today&apos;s 3 Tasks</h3>
          </div>
          <div className="flex items-center gap-2">
            {streak > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-orange-400">
                <Flame className="w-3.5 h-3.5" />
                {streak}
              </span>
            )}
            {total > 0 && (
              <span className={cn('text-sm font-bold tabular-nums', allDone ? 'text-emerald-400' : 'text-slate-400')}>
                {completed}/{total}
              </span>
            )}
            <button
              onClick={generateTasks}
              disabled={generating}
              className="text-slate-600 hover:text-slate-400 transition-colors disabled:opacity-50"
              title="Refresh tasks"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', generating && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Tasks */}
        {generating ? (
          <div className="py-6 text-center space-y-2">
            <div className="w-5 h-5 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin mx-auto" />
            <p className="text-slate-500 text-xs">Building your tasks from real data…</p>
          </div>
        ) : total === 0 ? (
          <div className="py-5 text-center space-y-3">
            <div className="text-2xl">📋</div>
            <p className="text-slate-400 text-sm font-medium">No tasks yet for today</p>
            <button
              onClick={generateTasks}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Get Today&apos;s 3 Tasks
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {taskList.map(task => {
              const src = SOURCE_META[task.source ?? 'gtm']
              const link = task.action_data?.url
              return (
                <div
                  key={task.id}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-all',
                    task.completed
                      ? 'border-slate-800 bg-emerald-950/10 opacity-60'
                      : 'border-slate-800 bg-slate-800/30 hover:border-slate-700'
                  )}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleTask(task)}
                    disabled={savingId === task.id}
                    className="flex-shrink-0 mt-0.5"
                  >
                    {savingId === task.id ? (
                      <span className="w-4 h-4 block border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin" />
                    ) : task.completed ? (
                      <span className="w-4 h-4 flex items-center justify-center rounded-full bg-emerald-500 text-white text-[10px]">✓</span>
                    ) : (
                      <span className="w-4 h-4 block rounded-full border-2 border-slate-600 hover:border-slate-400 transition-colors" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    {/* Source badge */}
                    <span className={cn('inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded border mb-1', src.color)}>
                      {src.label}
                    </span>
                    <p className={cn('text-xs leading-snug', task.completed ? 'text-slate-500 line-through' : 'text-slate-200')}>
                      {task.title}
                    </p>
                    {task.description && !task.completed && (
                      <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed truncate">{task.description}</p>
                    )}
                  </div>

                  {/* Action link */}
                  {!task.completed && link && (
                    <Link
                      href={link}
                      className="flex-shrink-0 text-[10px] font-medium text-slate-500 hover:text-violet-400 transition-colors mt-0.5"
                    >
                      →
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        {total > 0 && (
          <div className={cn(
            'mt-3 pt-3 border-t text-center text-xs',
            allDone ? 'border-emerald-800/40 text-emerald-400' : 'border-slate-800 text-slate-600'
          )}>
            {allDone ? (
              <div className="space-y-0.5">
                <p className="font-semibold">🎉 All done! Come back tomorrow.</p>
                {streak > 0 && <p className="text-orange-400 font-medium">{STREAK_LABEL(streak)}</p>}
                {justFinished && streak >= 7 && (
                  <p className="text-emerald-400 text-[10px]">You&apos;re building a real habit 💪</p>
                )}
              </div>
            ) : (
              `${total - completed} task${total - completed !== 1 ? 's' : ''} left — small steps, big results`
            )}
          </div>
        )}
      </div>
    </div>
  )
}
