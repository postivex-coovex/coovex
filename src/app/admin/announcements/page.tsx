'use client'

import { useEffect, useState } from 'react'

interface Announcement {
  id: string
  title: string
  body: string
  type: string
  target: string
  status: string
  sent_count: number
  sent_at: string | null
  created_at: string
}

const TYPE_OPTIONS = [
  { value: 'info',    label: '📢 Info' },
  { value: 'feature', label: '✨ New Feature' },
  { value: 'warning', label: '⚠️ Warning' },
  { value: 'promo',   label: '🎁 Promo' },
]

const TARGET_OPTIONS = [
  { value: 'all',      label: 'All users' },
  { value: 'trialing', label: 'Trial users only' },
  { value: 'paid',     label: 'Paid users only' },
  { value: 'inactive', label: 'Inactive users (30+ days)' },
]

export default function AdminAnnouncementsPage() {
  const [list, setList] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', type: 'info', target: 'all' })
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => { loadList() }, [])

  async function loadList() {
    const res = await fetch('/api/admin/announcements')
    const d = await res.json()
    setList(d.announcements || [])
    setLoading(false)
  }

  async function createAnnouncement() {
    if (!form.title.trim() || !form.body.trim()) return
    setSubmitting(true)
    const res = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await res.json()
    if (d.error) {
      setMsg({ ok: false, text: d.error })
    } else {
      setShowForm(false)
      setForm({ title: '', body: '', type: 'info', target: 'all' })
      await loadList()
      setMsg({ ok: true, text: 'Announcement saved as draft' })
    }
    setSubmitting(false)
    setTimeout(() => setMsg(null), 4000)
  }

  async function send(id: string) {
    setSending(id)
    const res = await fetch('/api/admin/announcements', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'send' }),
    })
    const d = await res.json()
    if (d.error) {
      setMsg({ ok: false, text: d.error })
    } else {
      setMsg({ ok: true, text: `Sent to ${d.sent_count} users` })
      await loadList()
    }
    setSending(null)
    setTimeout(() => setMsg(null), 4000)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Announcements</h1>
          <p className="text-slate-400 text-sm">Push notifications and messages to users</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
        >
          + New Announcement
        </button>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.ok ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900' : 'bg-red-950/50 text-red-400 border border-red-900'}`}>
          {msg.text}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
          <h2 className="text-white font-semibold mb-4">New Announcement</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
                >
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Target Audience</label>
                <select
                  value={form.target}
                  onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
                >
                  {TARGET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">Title</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Announcement title…"
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder:text-slate-600"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">Message Body</label>
              <textarea
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Write your message…"
                rows={4}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder:text-slate-600 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={createAnnouncement}
                disabled={submitting || !form.title.trim() || !form.body.trim()}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
              >
                {submitting ? 'Saving…' : 'Save as Draft'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-600 text-sm">Loading…</div>
        ) : list.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-600 text-sm">No announcements yet</p>
            <p className="text-slate-700 text-xs mt-1">Create one above to notify your users</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {list.map(a => (
              <div key={a.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 capitalize">{a.type}</span>
                      <span className="text-xs text-slate-500 capitalize">→ {a.target}</span>
                      {a.status === 'sent' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400">
                          ✓ Sent to {a.sent_count}
                        </span>
                      )}
                      {a.status === 'draft' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-500">Draft</span>
                      )}
                    </div>
                    <p className="text-white font-medium text-sm">{a.title}</p>
                    <p className="text-slate-400 text-xs mt-1 line-clamp-2">{a.body}</p>
                    <p className="text-slate-600 text-xs mt-2">
                      {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {a.status === 'draft' && (
                    <button
                      onClick={() => send(a.id)}
                      disabled={sending === a.id}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs rounded-lg transition-colors flex-shrink-0"
                    >
                      {sending === a.id ? 'Sending…' : 'Send Now'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
