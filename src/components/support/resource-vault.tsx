'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Key, FileText, Link2, File, Plus, Trash2, Eye, EyeOff, Pencil, Check, X } from 'lucide-react'
import type { SupportResource } from '@/lib/support/types'

const CATEGORY_CONFIG = {
  credential: { label: 'Credential', icon: Key,      color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' },
  note:       { label: 'Note',       icon: FileText,  color: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  link:       { label: 'Link',       icon: Link2,     color: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' },
  document:   { label: 'Document',   icon: File,      color: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  api_key:    { label: 'API Key',    icon: Key,       color: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
  other:      { label: 'Other',      icon: FileText,  color: 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
}

interface Props {
  propertyId: string
  initial: SupportResource[]
}

function ResourceRow({
  resource, propertyId, onDelete, onUpdate,
}: {
  resource: SupportResource
  propertyId: string
  onDelete: (id: string) => void
  onUpdate: (r: SupportResource) => void
}) {
  const [revealed, setRevealed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(resource.content || '')
  const [saving, setSaving] = useState(false)
  const cfg = CATEGORY_CONFIG[resource.category] || CATEGORY_CONFIG.other
  const Icon = cfg.icon
  const isSensitive = resource.category === 'credential' || resource.category === 'api_key'

  async function saveEdit() {
    setSaving(true)
    try {
      const res = await fetch(`/api/support/properties/${propertyId}/resources`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_id: resource.id, content: editContent }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onUpdate(data)
      setEditing(false)
      toast.success('Resource updated')
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function del() {
    if (!confirm('Delete this resource?')) return
    const res = await fetch(`/api/support/properties/${propertyId}/resources?resource_id=${resource.id}`, { method: 'DELETE' })
    if (res.ok) { onDelete(resource.id); toast.success('Deleted') }
    else toast.error('Failed to delete')
  }

  const displayContent = isSensitive && !revealed
    ? '•'.repeat(Math.min(resource.content?.length || 8, 24))
    : (resource.content || '—')

  return (
    <div className="flex items-start gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 last:border-0 group">
      <div className={`flex-shrink-0 mt-0.5 p-1.5 rounded-lg ${cfg.color}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{resource.name}</p>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
        </div>
        {editing ? (
          <div className="flex items-center gap-2 mt-1">
            <input value={editContent} onChange={e => setEditContent(e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              autoFocus
            />
            <button onClick={saveEdit} disabled={saving}
              className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-950 rounded-lg"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => { setEditing(false); setEditContent(resource.content || '') }}
              className="p-1.5 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <p className={`text-xs font-mono break-all ${isSensitive && !revealed ? 'tracking-widest text-slate-400' : 'text-slate-600 dark:text-slate-400'}`}>
            {displayContent}
          </p>
        )}
        {resource.metadata && Object.keys(resource.metadata).length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
            {Object.entries(resource.metadata).map(([k, v]) => (
              <span key={k} className="text-[10px] text-slate-400">
                <span className="text-slate-500">{k}:</span> {String(v)}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {isSensitive && (
          <button onClick={() => setRevealed(v => !v)}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
        <button onClick={() => setEditing(true)}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={del}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-500 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

export function ResourceVault({ propertyId, initial }: Props) {
  const [resources, setResources] = useState<SupportResource[]>(initial)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newForm, setNewForm] = useState({
    name: '', category: 'credential', content: '', metadata_key: '', metadata_val: '',
  })

  async function addResource(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const metadata: Record<string, string> = {}
      if (newForm.metadata_key && newForm.metadata_val) {
        metadata[newForm.metadata_key] = newForm.metadata_val
      }
      const res = await fetch(`/api/support/properties/${propertyId}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newForm.name, category: newForm.category,
          content: newForm.content || null, metadata,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResources(r => [data, ...r])
      setAdding(false)
      setNewForm({ name: '', category: 'credential', content: '', metadata_key: '', metadata_val: '' })
      toast.success('Resource added')
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Key className="w-4 h-4 text-blue-600" />
          Resource Vault
          <span className="text-xs text-slate-400 font-normal">({resources.length})</span>
        </h3>
        <button onClick={() => setAdding(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {adding && (
        <form onSubmit={addResource} className="px-4 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Name *</label>
              <input required value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} placeholder="Gmail App Password"
                className="w-full px-2.5 py-2 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Category</label>
              <select value={newForm.category} onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-2.5 py-2 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Content / Value</label>
            <input value={newForm.content} onChange={e => setNewForm(f => ({ ...f, content: e.target.value }))} placeholder="Paste your credential here"
              className="w-full px-2.5 py-2 text-xs font-mono border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Metadata key (optional)</label>
              <input value={newForm.metadata_key} onChange={e => setNewForm(f => ({ ...f, metadata_key: e.target.value }))} placeholder="username"
                className="w-full px-2.5 py-2 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Metadata value</label>
              <input value={newForm.metadata_val} onChange={e => setNewForm(f => ({ ...f, metadata_val: e.target.value }))} placeholder="you@gmail.com"
                className="w-full px-2.5 py-2 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdding(false)}
              className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      )}

      {resources.length === 0 && !adding ? (
        <div className="py-10 text-center">
          <Key className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-400">No resources yet. Store credentials, notes, and API keys here.</p>
        </div>
      ) : (
        <div>
          {resources.map(r => (
            <ResourceRow key={r.id} resource={r} propertyId={propertyId}
              onDelete={id => setResources(rs => rs.filter(x => x.id !== id))}
              onUpdate={updated => setResources(rs => rs.map(x => x.id === updated.id ? updated : x))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
