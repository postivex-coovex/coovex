'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Circle, RefreshCw, Sparkles, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DailyTask, Task } from '@/types'

const PRIORITY_META = {
  critical: {
    label: 'P1 · Critical',
    border: 'border-l-red-500',
    bg: 'bg-red-950/30',
    badge: 'bg-red-500/20 text-red-400 border border-red-500/30',
    dot: 'bg-red-500',
    ring: 'ring-1 ring-red-500/20',
  },
  high: {
    label: 'P2 · High',
    border: 'border-l-amber-500',
    bg: 'bg-amber-950/20',
    badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    dot: 'bg-amber-500',
    ring: 'ring-1 ring-amber-500/10',
  },
  medium: {
    label: 'P3 · Medium',
    border: 'border-l-blue-500',
    bg: '',
    badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    dot: 'bg-blue-500',
    ring: '',
  },
  low: {
    label: 'P4 · Low',
    border: 'border-l-slate-600',
    bg: '',
    badge: 'bg-slate-800 text-slate-500 border border-slate-700',
    dot: 'bg-slate-600',
    ring: '',
  },
} as const

interface DailyTasksCardProps {
  tasks: DailyTask | null
  businessId?: string
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export function DailyTasksCard({ tasks, businessId }: DailyTasksCardProps) {
  const [taskList, setTaskList] = useState<Task[]>(tasks?.tasks_json ?? [])
  const [generating, setGenerating] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    if (taskList.length === 0 && businessId) {
      generateTasks()
    } else if (taskList.some(t => !t.completed && t.verify_via)) {
      autoVerify()
    }
  }, [])

  async function autoVerify() {
    try {
      const res = await fetch('/api/agent/tasks/auto-verify', { method: 'POST' })
      const data = await res.json()
      if (data.tasks?.tasks_json) setTaskList(data.tasks.tasks_json)
    } catch {
      // silent fail — manual state stays
    }
  }

  async function generateTasks() {
    setGenerating(true)
    try {
      const res = await fetch('/api/agent/tasks/generate', { method: 'POST' })
      const data = await res.json()
      if (data.tasks?.tasks_json) setTaskList(data.tasks.tasks_json)
    } finally {
      setGenerating(false)
    }
  }

  async function toggleTask(task: Task) {
    const newCompleted = !task.completed
    // Optimistic update
    setTaskList(prev => prev.map(t => t.id === task.id ? { ...t, completed: newCompleted } : t))
    setSavingId(task.id)
    try {
      await fetch(`/api/agent/daily-tasks/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newCompleted }),
      })
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
      'rounded-2xl border overflow-hidden transition-all duration-300',
      allDone
        ? 'bg-emerald-950/20 border-emerald-700/40'
        : 'bg-slate-900 border-blue-500/30'
    )}>
      {/* Colored top bar */}
      <div className={cn(
        'h-1 w-full transition-all duration-500',
        allDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-600 to-blue-400'
      )} style={{ width: '100%' }}>
        <div
          className={cn('h-full transition-all duration-700', allDone ? 'bg-emerald-500' : 'bg-blue-500')}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Today&apos;s Focus</h3>
            </div>
            <p className="text-[11px] text-slate-500">{todayLabel()}</p>
          </div>
          <div className="flex items-center gap-2">
            {total > 0 && (
              <div className="text-right">
                <span className={cn(
                  'text-lg font-bold tabular-nums',
                  allDone ? 'text-emerald-400' : 'text-blue-400'
                )}>{completed}</span>
                <span className="text-slate-600 text-sm">/{total}</span>
              </div>
            )}
            <button
              onClick={generateTasks}
              disabled={generating}
              className="text-slate-600 hover:text-blue-400 transition-colors disabled:opacity-50 mt-0.5"
              title="Regenerate tasks"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', generating && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="mb-4">
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  allDone ? 'bg-emerald-500' : 'bg-blue-500'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-600 mt-1 text-right">{pct}% complete</p>
          </div>
        )}

        {/* Task list */}
        {generating ? (
          <div className="py-6 text-center space-y-2">
            <div className="w-6 h-6 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin mx-auto" />
            <p className="text-slate-500 text-xs">AI is creating your tasks…</p>
          </div>
        ) : total === 0 ? (
          <div className="py-5 text-center space-y-3">
            <div className="text-2xl">📋</div>
            <p className="text-slate-400 text-sm font-medium">No tasks yet for today</p>
            <p className="text-slate-600 text-xs">AI will generate 5 high-impact tasks personalized for your business</p>
            <button
              onClick={generateTasks}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate Today&apos;s Tasks
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {taskList.map((task) => {
              const p = PRIORITY_META[task.priority ?? 'medium']
              return (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task)}
                  disabled={savingId === task.id}
                  className={cn(
                    'w-full flex items-start gap-3 text-left rounded-lg border-l-2 px-3 py-2.5 transition-all group',
                    task.completed
                      ? 'border-l-slate-700 bg-emerald-950/10 opacity-60'
                      : [p.border, p.bg, p.ring].join(' '),
                    savingId === task.id && 'opacity-50'
                  )}
                >
                  <span className="shrink-0 mt-0.5">
                    {savingId === task.id ? (
                      <span className="w-4 h-4 block border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin" />
                    ) : task.completed ? (
                      task.auto_completed
                        ? <Bot className="w-4 h-4 text-violet-400" />
                        : <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    {!task.completed && (
                      <span className={cn(
                        'inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mb-1',
                        p.badge
                      )}>
                        {p.label}
                      </span>
                    )}
                    <span className={cn(
                      'text-sm leading-snug block',
                      task.completed ? 'text-slate-500 line-through decoration-slate-700' : 'text-slate-200'
                    )}>
                      {task.title}
                    </span>
                    {task.auto_completed && (
                      <span className="text-[10px] text-violet-500 font-medium mt-0.5 block">AI verified</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Footer */}
        {total > 0 && (
          <div className={cn(
            'mt-4 pt-3 border-t text-center text-xs',
            allDone ? 'border-emerald-800/40 text-emerald-400' : 'border-slate-800 text-slate-600'
          )}>
            {allDone
              ? '🎉 All done! Great work today.'
              : `${total - completed} task${total - completed !== 1 ? 's' : ''} remaining — you can do this!`
            }
          </div>
        )}
      </div>
    </div>
  )
}
