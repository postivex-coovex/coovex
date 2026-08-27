'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Zap, AlertTriangle, CheckCircle, Clock, X, Loader2, MessageSquare, Trash2, ChevronDown } from 'lucide-react'

interface Task {
  id: string
  title: string
  description: string | null
  status: 'open' | 'in_progress' | 'done' | 'cancelled'
  level: 'normal' | 'emergency'
  department: 'technical' | 'general' | 'finance' | 'marketing'
  source: 'manual' | 'chat' | 'email'
  source_label: string | null
  assigned_to_email: string | null
  due_date: string | null
  created_at: string
}

const LEVELS = { normal: { label: 'Normal', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' }, emergency: { label: 'Emergency', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' } }
const DEPTS  = { technical: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', general: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', finance: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', marketing: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' }
const STATUSES = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open', icon: Clock },
  { value: 'in_progress', label: 'In Progress', icon: Zap },
  { value: 'done', label: 'Done', icon: CheckCircle },
  { value: 'cancelled', label: 'Cancelled', icon: X },
]

function fmt(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }

interface CreateFormProps { onCreated?: (t: Task) => void; onClose: () => void; conversationId?: string; conversationLabel?: string }

export function CreateTaskForm({ onCreated, onClose, conversationId, conversationLabel }: CreateFormProps) {
  const [title, setTitle]             = useState('')
  const [desc, setDesc]               = useState('')
  const [level, setLevel]             = useState('normal')
  const [dept, setDept]               = useState('general')
  const [assignTo, setAssignTo]       = useState('')
  const [dueDate, setDueDate]         = useState('')
  const [saving, setSaving]           = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description: desc || undefined,
          level, department: dept,
          source: conversationId ? 'chat' : 'manual',
          source_conversation_id: conversationId || undefined,
          source_label: conversationLabel || undefined,
          assigned_to_email: assignTo || undefined,
          due_date: dueDate || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Task created')
      onCreated?.(data.task)
      onClose()
    } catch (err: unknown) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">New Task</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        {conversationLabel && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
            <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
            From chat: {conversationLabel}
          </div>
        )}
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title *" required
          className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" rows={2}
          className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Level</label>
            <select value={level} onChange={e => setLevel(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-sm focus:outline-none">
              <option value="normal">Normal</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Department</label>
            <select value={dept} onChange={e => setDept(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-sm focus:outline-none">
              <option value="general">General</option>
              <option value="technical">Technical</option>
              <option value="finance">Finance</option>
              <option value="marketing">Marketing</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Assign to (email)</label>
            <input value={assignTo} onChange={e => setAssignTo(e.target.value)} type="email" placeholder="teammate@email.com"
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-sm focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Due date</label>
            <input value={dueDate} onChange={e => setDueDate(e.target.value)} type="date"
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-sm focus:outline-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
          <button type="submit" disabled={saving || !title.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Task
          </button>
        </div>
      </form>
    </div>
  )
}

export function TasksClient({ conversationId, conversationLabel, compact }: { conversationId?: string; conversationLabel?: string; compact?: boolean }) {
  const [tasks, setTasks]         = useState<Task[]>([])
  const [loading, setLoading]     = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterLevel, setFilterLevel]   = useState('')
  const [filterDept, setFilterDept]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    if (filterLevel)  params.set('level', filterLevel)
    if (filterDept)   params.set('department', filterDept)
    const res  = await fetch(`/api/tasks?${params}`)
    const data = await res.json()
    setTasks(data.tasks || [])
    setLoading(false)
  }, [filterStatus, filterLevel, filterDept])

  useEffect(() => { load() }, [load])

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status: status as Task['status'] } : t))
  }

  async function deleteTask(id: string) {
    if (!confirm('Delete this task?')) return
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setTasks(ts => ts.filter(t => t.id !== id))
    toast.success('Task deleted')
  }

  const statusCycle: Record<string, Task['status']> = { open: 'in_progress', in_progress: 'done', done: 'open', cancelled: 'open' }

  if (compact) {
    return (
      <>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Create Task
        </button>
        {showCreate && <CreateTaskForm conversationId={conversationId} conversationLabel={conversationLabel} onCreated={t => setTasks(ts => [t, ...ts])} onClose={() => setShowCreate(false)} />}
      </>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {showCreate && <CreateTaskForm conversationId={conversationId} conversationLabel={conversationLabel} onCreated={t => { setTasks(ts => [t, ...ts]); }} onClose={() => setShowCreate(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Tasks Manager</h1>
          <p className="text-sm text-slate-500 mt-0.5">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors">
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map(s => (
          <button key={s.value} onClick={() => setFilterStatus(filterStatus === s.value ? '' : s.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s.value ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
            {s.label}
          </button>
        ))}
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 self-center mx-1" />
        {(['normal','emergency'] as const).map(l => (
          <button key={l} onClick={() => setFilterLevel(filterLevel === l ? '' : l)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterLevel === l ? (l === 'emergency' ? 'bg-red-600 text-white' : 'bg-slate-600 text-white') : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
            {l === 'emergency' ? '⚡ Emergency' : 'Normal'}
          </button>
        ))}
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 self-center mx-1" />
        {(['general','technical','finance','marketing'] as const).map(d => (
          <button key={d} onClick={() => setFilterDept(filterDept === d ? '' : d)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filterDept === d ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
            {d}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No tasks yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <div key={task.id} className={`bg-white dark:bg-slate-900 border rounded-xl p-4 flex items-start gap-3 group ${task.level === 'emergency' ? 'border-red-200 dark:border-red-900' : 'border-slate-200 dark:border-slate-800'}`}>
              {/* Status toggle */}
              <button onClick={() => updateStatus(task.id, statusCycle[task.status])}
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  task.status === 'done' ? 'bg-green-500 border-green-500 text-white' :
                  task.status === 'in_progress' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' :
                  task.status === 'cancelled' ? 'border-slate-300 bg-slate-100 dark:bg-slate-800' :
                  'border-slate-300 dark:border-slate-600 hover:border-blue-500'
                }`} title={`Status: ${task.status} — click to advance`}>
                {task.status === 'done' && <CheckCircle className="w-3 h-3" />}
                {task.status === 'in_progress' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-medium text-slate-900 dark:text-slate-100 ${task.status === 'done' ? 'line-through opacity-50' : ''}`}>
                    {task.level === 'emergency' && <AlertTriangle className="w-3.5 h-3.5 text-red-500 inline mr-1 mb-0.5" />}
                    {task.title}
                  </p>
                  <button onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 flex-shrink-0 transition-opacity">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {task.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${LEVELS[task.level].color}`}>{LEVELS[task.level].label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${DEPTS[task.department]}`}>{task.department}</span>
                  {task.source !== 'manual' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center gap-1">
                      <MessageSquare className="w-2.5 h-2.5" />
                      {task.source_label || task.source}
                    </span>
                  )}
                  {task.assigned_to_email && <span className="text-[10px] text-slate-400">→ {task.assigned_to_email}</span>}
                  {task.due_date && <span className="text-[10px] text-slate-400">Due {fmt(task.due_date)}</span>}
                  <span className="text-[10px] text-slate-300">{fmt(task.created_at)}</span>
                </div>
              </div>

              {/* Quick status dropdown */}
              <div className="relative flex-shrink-0">
                <select value={task.status} onChange={e => updateStatus(task.id, e.target.value)}
                  className="text-[10px] px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer">
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
