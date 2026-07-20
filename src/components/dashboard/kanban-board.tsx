'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Plus, X, ExternalLink, ChevronDown, ChevronUp, Upload, Check, ArrowRight, Trash2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KanbanTask {
  id: string
  title: string
  description?: string
  category: string
  status: 'todo' | 'in_progress' | 'done'
  priority: string
  source: string
  source_id?: string
  href?: string
  cta?: string
  notes?: string
  proof_type?: string
  proof_value?: string
  proof_summary?: string
  due_date?: string
  created_at: string
}

const CAT = {
  audit:   { label: '🔍 Audit',   color: 'text-blue-400 bg-blue-950/40 border-blue-800/40' },
  gtm:     { label: '🚀 GTM',     color: 'text-violet-400 bg-violet-950/40 border-violet-800/40' },
  content: { label: '✍️ Content', color: 'text-amber-400 bg-amber-950/40 border-amber-800/40' },
  geo:     { label: '🌐 GEO',     color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40' },
  social:  { label: '📱 Social',  color: 'text-pink-400 bg-pink-950/40 border-pink-800/40' },
  setup:   { label: '⚙️ Setup',   color: 'text-orange-400 bg-orange-950/40 border-orange-800/40' },
  general: { label: '📋 Task',    color: 'text-slate-400 bg-slate-800/40 border-slate-700/40' },
} as const

const PROOF_LABELS: Record<string, string> = {
  content: 'Paste the URL where you published this',
  social:  'Paste the social media post URL',
  gtm:     'Paste the campaign or lead URL (optional)',
  audit:   'Paste URL or describe what you fixed',
  geo:     'Paste URL or describe the change (optional)',
  setup:   'Paste URL or describe what you set up (optional)',
  general: 'Add any note or URL as proof (optional)',
}

function proofRequired(category: string) {
  return category === 'content' || category === 'social'
}

// ── Proof Modal ───────────────────────────────────────────────────────────────

function ProofModal({
  task, onSubmit, onClose,
}: {
  task: KanbanTask
  onSubmit: (proof: { proof_value?: string; proof_type?: string; screenshot_base64?: string; screenshot_mime?: string }) => void
  onClose: () => void
}) {
  const [url, setUrl]       = useState('')
  const [note, setNote]     = useState('')
  const [imgData, setImg]   = useState<{ base64: string; mime: string; name: string } | null>(null)
  const [tab, setTab]       = useState<'url' | 'screenshot' | 'note'>('url')
  const fileRef             = useRef<HTMLInputElement>(null)
  const required            = proofRequired(task.category)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const base64 = ev.target?.result as string
      setImg({ base64, mime: file.type, name: file.name })
    }
    reader.readAsDataURL(file)
  }

  function submit() {
    if (tab === 'url') {
      const val = url.trim() || note.trim()
      onSubmit({ proof_value: val, proof_type: val.startsWith('http') ? 'url' : 'text' })
    } else if (tab === 'screenshot' && imgData) {
      onSubmit({ screenshot_base64: imgData.base64, screenshot_mime: imgData.mime })
    } else {
      onSubmit({ proof_value: note.trim(), proof_type: 'text' })
    }
  }

  const canSubmit = !required || tab === 'url' ? (url.trim() || note.trim()) : tab === 'screenshot' ? !!imgData : note.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-white font-semibold text-sm">Mark as Complete</h3>
            <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">{task.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-400 shrink-0 ml-3">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
          {(['url', 'screenshot', 'note'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('flex-1 py-1.5 text-xs font-medium rounded-md transition-colors capitalize', tab === t ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300')}>
              {t === 'url' ? '🔗 URL' : t === 'screenshot' ? '📸 Screenshot' : '📝 Note'}
            </button>
          ))}
        </div>

        <p className="text-slate-500 text-xs">{PROOF_LABELS[task.category] ?? PROOF_LABELS.general}</p>

        {tab === 'url' && (
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500" />
        )}

        {tab === 'screenshot' && (
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            {imgData ? (
              <div className="flex items-center gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700">
                <span className="text-emerald-400 text-xs">✓</span>
                <span className="text-slate-300 text-xs flex-1 truncate">{imgData.name}</span>
                <button onClick={() => setImg(null)} className="text-slate-600 hover:text-red-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-700 hover:border-violet-600 rounded-xl p-6 text-center transition-colors">
                <Upload className="w-5 h-5 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-xs">Click to upload screenshot</p>
                <p className="text-slate-600 text-[10px] mt-0.5">AI will extract and save the proof text</p>
              </button>
            )}
          </div>
        )}

        {(tab === 'note' || (tab === 'url' && !url.trim())) && (
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder={tab === 'note' ? 'What did you accomplish?' : 'Add a note (optional)'}
            rows={3}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 resize-none" />
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 text-xs font-medium hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button onClick={submit}
            disabled={required ? !canSubmit : false}
            className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5">
            <Check className="w-3.5 h-3.5" /> Mark Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Task Card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task, onMove, onDelete, onUpdateNotes,
}: {
  task: KanbanTask
  onMove: (id: string, status: KanbanTask['status'], proof?: Record<string, string>) => void
  onDelete: (id: string) => void
  onUpdateNotes: (id: string, notes: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes]       = useState(task.notes ?? '')
  const [notesDirty, setDirty]  = useState(false)
  const [showProof, setShowProof] = useState(false)
  const cat = CAT[task.category as keyof typeof CAT] ?? CAT.general

  function saveNotes() {
    if (notesDirty) {
      onUpdateNotes(task.id, notes)
      setDirty(false)
    }
  }

  function handleMoveToInProgress() {
    onMove(task.id, 'in_progress')
  }

  function handleMoveBack() {
    onMove(task.id, 'todo')
  }

  function handleCompleteTrigger() {
    setShowProof(true)
  }

  function handleProofSubmit(proof: { proof_value?: string; proof_type?: string; screenshot_base64?: string; screenshot_mime?: string }) {
    setShowProof(false)
    onMove(task.id, 'done', proof as Record<string, string>)
  }

  return (
    <>
      {showProof && (
        <ProofModal task={task} onSubmit={handleProofSubmit} onClose={() => setShowProof(false)} />
      )}
      <div className={cn(
        'rounded-xl border transition-all duration-200 group',
        task.status === 'done'
          ? 'border-emerald-800/30 bg-emerald-950/10'
          : 'border-slate-800 bg-slate-900 hover:border-slate-700',
      )}>
        {/* Card header */}
        <div className="p-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <span className={cn('inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded border mb-1.5', cat.color)}>
                {cat.label}
              </span>
              <p className={cn('text-xs font-medium leading-snug', task.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-200')}>
                {task.title}
              </p>
              {task.description && !expanded && task.status !== 'done' && (
                <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed line-clamp-2">{task.description}</p>
              )}
            </div>
            <button onClick={() => setExpanded(v => !v)} className="shrink-0 text-slate-700 hover:text-slate-400 transition-colors mt-0.5">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Proof badge for done tasks */}
          {task.status === 'done' && (task.proof_value || task.proof_summary) && (
            <div className="mt-2 p-2 bg-emerald-950/30 border border-emerald-800/30 rounded-lg">
              <p className="text-[9px] text-emerald-600 font-semibold uppercase tracking-wider mb-0.5">Proof</p>
              {task.proof_value?.startsWith('http') ? (
                <a href={task.proof_value} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 truncate">
                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  {task.proof_value}
                </a>
              ) : (
                <p className="text-[10px] text-slate-400 leading-relaxed">{task.proof_summary || task.proof_value}</p>
              )}
            </div>
          )}
        </div>

        {/* Expanded section */}
        {expanded && (
          <div className="px-3 pb-3 border-t border-slate-800/60 pt-3 space-y-2.5">
            {task.description && (
              <p className="text-[10px] text-slate-500 leading-relaxed">{task.description}</p>
            )}

            {/* Notes */}
            <div>
              <p className="text-[9px] text-slate-600 font-semibold uppercase tracking-wider mb-1">Notes</p>
              <textarea
                value={notes}
                onChange={e => { setNotes(e.target.value); setDirty(true) }}
                onBlur={saveNotes}
                placeholder="Add a note..."
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-[11px] text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 resize-none"
              />
              {notesDirty && (
                <button onClick={saveNotes} className="text-[10px] text-violet-400 hover:text-violet-300 mt-0.5 transition-colors">
                  Save note →
                </button>
              )}
            </div>

            {/* Action link */}
            {task.href && task.status !== 'done' && (
              <Link href={task.href}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-violet-600 border border-slate-700 hover:border-violet-500 rounded-lg text-slate-300 hover:text-white text-[11px] font-semibold transition-colors">
                ⚡ {task.cta ?? 'Open'} <ArrowRight className="w-2.5 h-2.5" />
              </Link>
            )}

            {/* Delete */}
            <button onClick={() => onDelete(task.id)}
              className="flex items-center gap-1 text-[10px] text-slate-700 hover:text-red-400 transition-colors">
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          </div>
        )}

        {/* Move buttons */}
        {task.status !== 'done' && (
          <div className="px-3 pb-3 flex gap-1.5">
            {task.status === 'todo' && (
              <button onClick={handleMoveToInProgress}
                className="flex-1 py-1.5 text-[10px] font-semibold text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition-colors">
                ▶ Start
              </button>
            )}
            {task.status === 'in_progress' && (
              <>
                <button onClick={handleMoveBack}
                  className="py-1.5 px-2 text-[10px] font-medium text-slate-600 hover:text-slate-400 rounded-lg border border-slate-800 transition-colors">
                  ← Back
                </button>
                <button onClick={handleCompleteTrigger}
                  className="flex-1 py-1.5 text-[10px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center justify-center gap-1">
                  <Check className="w-3 h-3" /> Done
                </button>
              </>
            )}
            {task.status === 'todo' && task.href && !expanded && (
              <Link href={task.href}
                className="py-1.5 px-2 text-[10px] font-medium text-violet-400 hover:text-violet-300 rounded-lg border border-slate-800 transition-colors flex items-center gap-1">
                Open <ArrowRight className="w-2.5 h-2.5" />
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── Add Task Form ─────────────────────────────────────────────────────────────

function AddTaskForm({ onAdd, onClose }: { onAdd: (t: Partial<KanbanTask>) => void; onClose: () => void }) {
  const [title, setTitle]   = useState('')
  const [cat, setCat]       = useState('general')
  const [href, setHref]     = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function submit() {
    if (!title.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), category: cat, href: href.trim() || undefined }),
      })
      const data = await res.json() as { task?: KanbanTask }
      if (data.task) onAdd(data.task)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-violet-700/50 bg-violet-950/20 p-3 space-y-2">
      <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
        placeholder="Task title..."
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500" />
      <div className="flex gap-2">
        <select value={cat} onChange={e => setCat(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none">
          {Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input value={href} onChange={e => setHref(e.target.value)}
          placeholder="Link (optional)"
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-400 placeholder-slate-700 focus:outline-none" />
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-1.5 rounded-lg border border-slate-700 text-slate-500 text-xs hover:bg-slate-800 transition-colors">Cancel</button>
        <button onClick={submit} disabled={!title.trim() || saving}
          className="flex-1 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors">
          {saving ? 'Adding…' : 'Add Task'}
        </button>
      </div>
    </div>
  )
}

// ── Column ────────────────────────────────────────────────────────────────────

function Column({ title, icon, tasks, emptyText, onMove, onDelete, onUpdateNotes, footer }: {
  title: string; icon: string; tasks: KanbanTask[]
  emptyText: string
  onMove: (id: string, status: KanbanTask['status'], proof?: Record<string, string>) => void
  onDelete: (id: string) => void
  onUpdateNotes: (id: string, notes: string) => void
  footer?: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-w-[260px] flex-1">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-semibold text-slate-300">{title}</span>
        <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded-full border border-slate-700">
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 space-y-2">
        {tasks.length === 0 && (
          <div className="border border-dashed border-slate-800 rounded-xl p-4 text-center">
            <p className="text-slate-700 text-xs">{emptyText}</p>
          </div>
        )}
        {tasks.map(t => (
          <TaskCard key={t.id} task={t} onMove={onMove} onDelete={onDelete} onUpdateNotes={onUpdateNotes} />
        ))}
        {footer}
      </div>
    </div>
  )
}

// ── Main Board ────────────────────────────────────────────────────────────────

export function KanbanBoard() {
  const [tasks, setTasks]         = useState<KanbanTask[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefresh]  = useState(false)
  const [generating, setGenerating] = useState(false)
  const [addingTask, setAdding]   = useState(false)
  const [movingId, setMovingId]   = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefresh(true)
    try {
      const res = await fetch('/api/tasks')
      const data = await res.json() as { tasks?: KanbanTask[]; hasDailyTasks?: boolean }
      setTasks(data.tasks ?? [])
      // Auto-generate daily tasks if AI hasn't produced any yet today
      if (!data.hasDailyTasks) {
        setGenerating(true)
        fetch('/api/agent/tasks/generate', { method: 'POST' })
          .then(() => fetch('/api/tasks'))
          .then(r => r.json())
          .then((d: { tasks?: KanbanTask[] }) => { setTasks(d.tasks ?? []) })
          .catch(() => {})
          .finally(() => setGenerating(false))
      }
    } finally {
      setLoading(false)
      setRefresh(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Returns the persisted UUID for a task (creates it if it's still a virtual source_id)
  async function persistTask(task: KanbanTask): Promise<string> {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRe.test(task.id)) return task.id
    // Virtual id — need to create a real tasks row first
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        href: task.href,
        cta: task.cta,
        due_date: task.due_date,
        source_id: task.source_id ?? task.id,
      }),
    })
    const data = await res.json() as { task?: { id: string } }
    const newId = data.task?.id ?? task.id
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, id: newId } : t))
    return newId
  }

  async function handleMove(id: string, status: KanbanTask['status'], proof?: Record<string, string>) {
    setMovingId(id)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    try {
      const task = tasks.find(t => t.id === id)
      if (!task) return
      const realId = await persistTask(task)
      await fetch(`/api/tasks/${realId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...proof }),
      })
      if (status === 'done') await load(true)
    } finally {
      setMovingId(null)
    }
  }

  async function handleDelete(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRe.test(id)) {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    }
  }

  async function handleUpdateNotes(id: string, notes: string) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, notes } : t))
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const realId = await persistTask(task)
    await fetch(`/api/tasks/${realId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
  }

  function handleAdd(t: Partial<KanbanTask>) {
    if (t && t.id) setTasks(prev => [t as KanbanTask, ...prev])
  }

  const todo       = tasks.filter(t => t.status === 'todo')
  const inProgress = tasks.filter(t => t.status === 'in_progress')
  const done       = tasks.filter(t => t.status === 'done')

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 animate-pulse">
        <div className="h-4 bg-slate-800 rounded w-32 mb-4" />
        <div className="flex gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="flex-1 space-y-2">
              <div className="h-3 bg-slate-800 rounded w-20 mb-3" />
              <div className="h-24 bg-slate-800 rounded-xl" />
              <div className="h-20 bg-slate-800 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            Task Board
            {generating && (
              <span className="flex items-center gap-1 text-[10px] font-normal text-violet-400">
                <span className="w-3 h-3 border border-violet-500 border-t-transparent rounded-full animate-spin inline-block" />
                AI generating tasks…
              </span>
            )}
          </h2>
          <p className="text-[10px] text-slate-600 mt-0.5">
            {todo.length + inProgress.length} active · {done.length} done
            {movingId && ' · saving…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(true)} disabled={refreshing}
            className="text-slate-600 hover:text-slate-400 transition-colors disabled:opacity-40">
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          </button>
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-semibold rounded-lg transition-colors">
            <Plus className="w-3 h-3" /> Add Task
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="overflow-x-auto">
        <div className="flex gap-4 p-5 min-w-[700px]">
          <Column
            title="Todo" icon="📌" tasks={todo}
            emptyText="No pending tasks"
            onMove={handleMove} onDelete={handleDelete} onUpdateNotes={handleUpdateNotes}
            footer={
              addingTask
                ? <AddTaskForm onAdd={handleAdd} onClose={() => setAdding(false)} />
                : (
                  <button onClick={() => setAdding(true)}
                    className="w-full py-2 border border-dashed border-slate-700 hover:border-slate-600 rounded-xl text-slate-700 hover:text-slate-500 text-xs transition-colors flex items-center justify-center gap-1">
                    <Plus className="w-3 h-3" /> Add task
                  </button>
                )
            }
          />
          <Column
            title="In Progress" icon="🔄" tasks={inProgress}
            emptyText="Move a task here to start"
            onMove={handleMove} onDelete={handleDelete} onUpdateNotes={handleUpdateNotes}
          />
          <Column
            title="Done" icon="✅" tasks={done}
            emptyText="Completed tasks appear here"
            onMove={handleMove} onDelete={handleDelete} onUpdateNotes={handleUpdateNotes}
          />
        </div>
      </div>
    </div>
  )
}
