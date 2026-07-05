'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { POSTS as STATIC_POSTS } from '@/app/blog/content'

// ─── Markdown toolbar ─────────────────────────────────────────────────────────

function insertMarkdown(
  ta: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder: string,
  setValue: (v: string) => void,
) {
  const { selectionStart: s, selectionEnd: e, value } = ta
  const selected = value.slice(s, e) || placeholder
  const next = value.slice(0, s) + before + selected + after + value.slice(e)
  setValue(next)
  requestAnimationFrame(() => {
    ta.focus()
    ta.setSelectionRange(s + before.length, s + before.length + selected.length)
  })
}

type ToolbarProps = {
  taRef: React.RefObject<HTMLTextAreaElement | null>
  onChange: (v: string) => void
}

function MdToolbar({ taRef, onChange }: ToolbarProps) {
  const wrap = (before: string, after: string, placeholder: string) => {
    const ta = taRef.current
    if (!ta) return
    insertMarkdown(ta, before, after, placeholder, (v) => {
      onChange(v)
      // Fire synthetic change so React state updates
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set
      nativeInputValueSetter!.call(ta, v)
      ta.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  const insertLink = () => {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const selected = value.slice(s, e) || 'link text'
    const insert = `[${selected}](https://)`
    const next = value.slice(0, s) + insert + value.slice(e)
    onChange(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(s + selected.length + 3, s + insert.length - 1)
    })
  }

  const btns = [
    { label: 'B', title: 'Bold', action: () => wrap('**', '**', 'bold text'), cls: 'font-bold' },
    { label: 'I', title: 'Italic', action: () => wrap('*', '*', 'italic text'), cls: 'italic' },
    { label: '<>', title: 'Inline code', action: () => wrap('`', '`', 'code'), cls: 'font-mono text-xs' },
    { label: '{}', title: 'Code block', action: () => wrap('```\n', '\n```', 'code here'), cls: 'font-mono text-xs' },
    { label: '🔗', title: 'Link', action: insertLink, cls: '' },
  ]

  return (
    <div className="flex gap-1 px-2 py-1.5 bg-slate-700/60 border border-slate-600 border-b-0 rounded-t-lg">
      {btns.map(b => (
        <button
          key={b.label}
          type="button"
          title={b.title}
          onClick={b.action}
          className={`px-2 py-0.5 rounded text-slate-300 hover:text-white hover:bg-slate-600 text-xs transition-colors ${b.cls}`}
        >
          {b.label}
        </button>
      ))}
      <span className="ml-auto text-slate-600 text-xs self-center">Markdown</span>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = {
  title: string
  content: string
  tip?: string
  warning?: string
  image?: string
}

type DbPost = {
  id: string
  slug: string
  title: string
  subtitle: string
  category: string
  icon: string
  read_time: number
  description: string
  tags: string[]
  content: Step[]
  published: boolean
  created_at: string
  updated_at: string
}

const EMPTY_STEP: Step = { title: '', content: '', tip: '', warning: '' }

const EMPTY_FORM = {
  slug: '',
  title: '',
  subtitle: '',
  category: 'Core Features',
  icon: '📄',
  read_time: 5,
  description: '',
  tags: '',
  content: [{ ...EMPTY_STEP }] as Step[],
  published: false,
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ published }: { published: boolean }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${published ? 'bg-emerald-900/40 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
      {published ? 'Published' : 'Draft'}
    </span>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({
  post,
  onClose,
  onSave,
}: {
  post: DbPost | null
  prefill?: Partial<typeof EMPTY_FORM>
  onClose: () => void
  onSave: (data: Partial<DbPost>) => Promise<void>
}) {
  const [form, setForm] = useState<typeof EMPTY_FORM>(() => {
    if (!post) return EMPTY_FORM
    return {
      slug:        post.slug,
      title:       post.title,
      subtitle:    post.subtitle,
      category:    post.category,
      icon:        post.icon,
      read_time:   post.read_time,
      description: post.description,
      tags:        post.tags?.join(', ') ?? '',
      content:     post.content?.length ? post.content : [{ ...EMPTY_STEP }],
      published:   post.published,
    }
  })
  const [saving, setSaving]           = useState(false)
  const [uploading, setUploading]     = useState<number | null>(null)
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([])

  const handleImageUpload = async (stepIdx: number, file: File) => {
    setUploading(stepIdx)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/admin/blog/upload', { method: 'POST', body: fd })
    if (res.ok) {
      const { url } = await res.json()
      setStep(stepIdx, 'image', url)
    }
    setUploading(null)
  }

  const setField = (k: keyof typeof EMPTY_FORM, v: unknown) =>
    setForm(f => ({ ...f, [k]: v }))

  const setStep = (i: number, k: keyof Step, v: string) =>
    setForm(f => {
      const steps = [...f.content]
      steps[i] = { ...steps[i], [k]: v }
      return { ...f, content: steps }
    })

  const addStep = () =>
    setForm(f => ({ ...f, content: [...f.content, { ...EMPTY_STEP }] }))

  const removeStep = (i: number) =>
    setForm(f => ({ ...f, content: f.content.filter((_, idx) => idx !== i) }))

  const moveStep = (i: number, dir: -1 | 1) =>
    setForm(f => {
      const steps = [...f.content]
      const j = i + dir
      if (j < 0 || j >= steps.length) return f
      ;[steps[i], steps[j]] = [steps[j], steps[i]]
      return { ...f, content: steps }
    })

  const handleSave = async () => {
    setSaving(true)
    await onSave({
      slug:        form.slug.trim().toLowerCase().replace(/\s+/g, '-'),
      title:       form.title,
      subtitle:    form.subtitle,
      category:    form.category,
      icon:        form.icon,
      read_time:   form.read_time,
      description: form.description,
      tags:        form.tags.split(',').map(t => t.trim()).filter(Boolean),
      content:     form.content,
      published:   form.published,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-white font-bold text-lg">
            {post ? 'Edit Post' : 'New Blog Post'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 text-xs mb-1">Slug <span className="text-red-400">*</span></label>
              <input
                value={form.slug}
                onChange={e => setField('slug', e.target.value)}
                placeholder="e.g. getting-started"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-600"
                disabled={!!post}
              />
              {!!post && <p className="text-slate-600 text-xs mt-0.5">Slug cannot be changed after creation</p>}
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Icon (emoji)</label>
              <input
                value={form.icon}
                onChange={e => setField('icon', e.target.value)}
                placeholder="📄"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-xs mb-1">Title <span className="text-red-400">*</span></label>
            <input
              value={form.title}
              onChange={e => setField('title', e.target.value)}
              placeholder="Getting Started with CooVex"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-600"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-xs mb-1">Subtitle</label>
            <input
              value={form.subtitle}
              onChange={e => setField('subtitle', e.target.value)}
              placeholder="One-line description shown below the title"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-600"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-xs mb-1">Description (card preview)</label>
            <textarea
              value={form.description}
              onChange={e => setField('description', e.target.value)}
              rows={2}
              placeholder="Short description shown on the blog index card"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-600 resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-400 text-xs mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setField('category', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-600"
              >
                {['Getting Started', 'Core Features', 'AI Tools', 'Growth', 'Analytics & Reports', 'Settings & Config', 'Agency'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Read Time (min)</label>
              <input
                type="number"
                value={form.read_time}
                onChange={e => setField('read_time', parseInt(e.target.value) || 5)}
                min={1}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-600"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Tags (comma-separated)</label>
              <input
                value={form.tags}
                onChange={e => setField('tags', e.target.value)}
                placeholder="seo, leads, analytics"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-600"
              />
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-slate-300 text-sm font-medium">Tutorial Steps</label>
              <button
                onClick={addStep}
                className="text-xs text-violet-400 border border-violet-800/50 px-3 py-1 rounded-lg hover:bg-violet-900/20"
              >
                + Add Step
              </button>
            </div>

            <div className="space-y-4">
              {form.content.map((step, i) => (
                <div key={i} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <input
                        value={step.title}
                        onChange={e => setStep(i, 'title', e.target.value)}
                        placeholder={`Step ${i + 1} title`}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-violet-600"
                      />
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="text-slate-500 hover:text-white disabled:opacity-30 px-1">↑</button>
                      <button onClick={() => moveStep(i, 1)} disabled={i === form.content.length - 1} className="text-slate-500 hover:text-white disabled:opacity-30 px-1">↓</button>
                      <button onClick={() => removeStep(i)} className="text-red-500 hover:text-red-400 px-1 ml-1">✕</button>
                    </div>
                  </div>

                  <div className="mb-2">
                    <MdToolbar
                      taRef={{ current: textareaRefs.current[i] ?? null }}
                      onChange={v => setStep(i, 'content', v)}
                    />
                    <textarea
                      ref={el => { textareaRefs.current[i] = el }}
                      value={step.content}
                      onChange={e => setStep(i, 'content', e.target.value)}
                      rows={5}
                      placeholder="Explain this step in detail. **Bold**, *italic*, `code`, [link](url) supported."
                      className="w-full bg-slate-700 border border-slate-600 rounded-b-lg rounded-t-none px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-600 resize-y font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-500 text-xs mb-1 block">💡 Tip (optional)</label>
                      <input
                        value={step.tip ?? ''}
                        onChange={e => setStep(i, 'tip', e.target.value)}
                        placeholder="Pro tip for this step"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-violet-600"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 text-xs mb-1 block">⚠️ Warning (optional)</label>
                      <input
                        value={step.warning ?? ''}
                        onChange={e => setStep(i, 'warning', e.target.value)}
                        placeholder="Common mistake to avoid"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-violet-600"
                      />
                    </div>
                  </div>

                  {/* Screenshot upload */}
                  <div className="mt-2">
                    <label className="text-slate-500 text-xs mb-1 block">📸 Screenshot (optional)</label>
                    {step.image ? (
                      <div className="relative">
                        <img src={step.image} alt="step screenshot" className="w-full rounded-lg border border-slate-600 max-h-48 object-cover" />
                        <button
                          onClick={() => setStep(i, 'image', '')}
                          className="absolute top-1.5 right-1.5 bg-red-700 hover:bg-red-600 text-white text-xs px-2 py-0.5 rounded"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className={`flex items-center justify-center gap-2 w-full border border-dashed border-slate-600 rounded-lg py-3 cursor-pointer hover:border-violet-600 transition-colors ${uploading === i ? 'opacity-60 cursor-wait' : ''}`}>
                        <span className="text-slate-500 text-xs">
                          {uploading === i ? 'Uploading…' : '+ Upload image'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploading === i}
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) handleImageUpload(i, file)
                            e.target.value = ''
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              ))}

              {form.content.length === 0 && (
                <button
                  onClick={addStep}
                  className="w-full border border-dashed border-slate-600 text-slate-500 hover:text-violet-400 hover:border-violet-700 rounded-xl py-4 text-sm transition-colors"
                >
                  + Add your first step
                </button>
              )}
            </div>
          </div>

          {/* Publish toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
            <div>
              <div className="text-white text-sm font-medium">Published</div>
              <div className="text-slate-500 text-xs">Published posts are visible on the public blog</div>
            </div>
            <button
              onClick={() => setField('published', !form.published)}
              className={`w-12 h-6 rounded-full transition-colors relative ${form.published ? 'bg-emerald-600' : 'bg-slate-600'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${form.published ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm px-4 py-2 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title || !form.slug}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : post ? 'Save Changes' : 'Create Post'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminBlogPage() {
  const [dbPosts, setDbPosts]     = useState<DbPost[]>([])
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState<DbPost | null | 'new'>()
  const [prefillSlug, setPrefill] = useState<string>('')
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState<'all' | 'db' | 'static'>('all')
  const [deleting, setDeleting]   = useState<string | null>(null)

  const fetchPosts = useCallback(async () => {
    const res = await fetch('/api/admin/blog')
    if (res.ok) setDbPosts(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const dbSlugSet = new Set(dbPosts.map(p => p.slug))

  // Static posts that don't have a DB override
  const staticOnlyPosts = STATIC_POSTS.filter(p => !dbSlugSet.has(p.slug))

  // Merged list for display
  type Row = { source: 'db'; post: DbPost } | { source: 'static'; post: typeof STATIC_POSTS[number] }
  const allRows: Row[] = [
    ...dbPosts.map(p => ({ source: 'db' as const, post: p })),
    ...staticOnlyPosts.map(p => ({ source: 'static' as const, post: p })),
  ]

  const q = search.toLowerCase()
  const filtered = allRows.filter(r => {
    if (filter === 'db' && r.source !== 'db') return false
    if (filter === 'static' && r.source !== 'static') return false
    if (q) {
      return r.post.title.toLowerCase().includes(q) ||
             r.post.slug.toLowerCase().includes(q) ||
             r.post.category.toLowerCase().includes(q)
    }
    return true
  })

  const handleSave = async (data: Partial<DbPost>) => {
    if (editing === 'new') {
      await fetch('/api/admin/blog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    } else if (editing != null) {
      const ep = editing as DbPost
      await fetch('/api/admin/blog', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ep.id, ...data }) })
    }
    setEditing(undefined)
    setPrefill('')
    await fetchPosts()
  }

  const handleTogglePublish = async (post: DbPost) => {
    await fetch('/api/admin/blog', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: post.id, published: !post.published }) })
    await fetchPosts()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return
    setDeleting(id)
    await fetch('/api/admin/blog', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setDeleting(null)
    await fetchPosts()
  }

  const openEditStatic = (slug: string) => {
    setPrefill(slug)
    setEditing('new')
  }

  const dbPublished = dbPosts.filter(p => p.published).length
  const dbDrafts    = dbPosts.filter(p => !p.published).length

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Modal */}
      {editing !== undefined && (
        <EditModal
          post={editing === 'new' ? null : editing}
          onClose={() => { setEditing(undefined); setPrefill('') }}
          onSave={handleSave}
          prefill={editing === 'new' ? { slug: prefillSlug } : undefined}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Blog CMS</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage blog posts and feature guides</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + New Post
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Posts',    value: STATIC_POSTS.length + dbPosts.length, color: 'text-white' },
          { label: 'DB / Custom',    value: dbPosts.length,  color: 'text-violet-400' },
          { label: 'Published',      value: dbPublished,     color: 'text-emerald-400' },
          { label: 'Static (built-in)', value: STATIC_POSTS.length, color: 'text-slate-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="bg-blue-950/30 border border-blue-800/30 rounded-xl p-4 mb-5 flex gap-3">
        <span className="text-blue-400 text-lg flex-shrink-0">ℹ️</span>
        <div className="text-blue-200 text-sm">
          <strong>Static posts</strong> are built into the app code with interactive UI mockups. Create a <strong>DB override</strong> for any static post to customize its text content — the DB version will display on the public blog instead.
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search posts…"
          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-600"
        />
        <div className="flex gap-1">
          {(['all', 'db', 'static'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-2 rounded-lg capitalize transition-colors ${filter === f ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'}`}
            >
              {f === 'db' ? 'DB / Custom' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Posts table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_100px_120px] text-xs text-slate-500 font-medium uppercase tracking-wider px-5 py-3 border-b border-slate-800">
          <span>Title</span>
          <span>Category</span>
          <span>Source</span>
          <span className="text-center">Status</span>
          <span className="text-right">Actions</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-600 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-600 text-sm">No posts found</div>
        ) : (
          filtered.map((row, i) => {
            const isDb = row.source === 'db'
            const p = row.post
            const dbPost = isDb ? (p as DbPost) : null

            return (
              <div
                key={`${row.source}-${p.slug}`}
                className={`grid grid-cols-[2fr_1fr_1fr_100px_120px] items-center px-5 py-3.5 border-b border-slate-800/50 ${i % 2 === 0 ? '' : 'bg-slate-800/10'} hover:bg-slate-800/30 transition-colors`}
              >
                {/* Title */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg flex-shrink-0">{p.icon}</span>
                  <div className="min-w-0">
                    <div className="text-slate-200 text-sm font-medium truncate">{p.title}</div>
                    <div className="text-slate-600 text-xs font-mono truncate">/{p.slug}</div>
                  </div>
                </div>

                {/* Category */}
                <div className="text-slate-400 text-xs">{p.category}</div>

                {/* Source */}
                <div>
                  {isDb ? (
                    <span className="text-xs bg-violet-900/40 text-violet-300 px-2 py-0.5 rounded-full">DB / Custom</span>
                  ) : (
                    <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">Static (built-in)</span>
                  )}
                </div>

                {/* Status */}
                <div className="text-center">
                  {isDb ? (
                    <Badge published={(p as DbPost).published} />
                  ) : (
                    <span className="text-xs text-slate-600">—</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 justify-end">
                  <Link
                    href={`/blog/${p.slug}`}
                    target="_blank"
                    className="text-xs text-slate-500 hover:text-white border border-slate-700 px-2 py-1 rounded"
                    title="View on blog"
                  >
                    View
                  </Link>

                  {isDb && dbPost ? (
                    <>
                      <button
                        onClick={() => setEditing(dbPost)}
                        className="text-xs text-violet-400 hover:text-violet-300 border border-violet-800/50 px-2 py-1 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleTogglePublish(dbPost)}
                        className={`text-xs px-2 py-1 rounded border ${dbPost.published ? 'border-amber-800/50 text-amber-400 hover:text-amber-300' : 'border-emerald-800/50 text-emerald-400 hover:text-emerald-300'}`}
                        title={dbPost.published ? 'Unpublish' : 'Publish'}
                      >
                        {dbPost.published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => handleDelete(dbPost.id)}
                        disabled={deleting === dbPost.id}
                        className="text-xs text-red-500 hover:text-red-400 border border-red-900/50 px-2 py-1 rounded disabled:opacity-50"
                      >
                        {deleting === dbPost.id ? '…' : 'Del'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => openEditStatic(p.slug)}
                      className="text-xs text-blue-400 hover:text-blue-300 border border-blue-800/50 px-2 py-1 rounded"
                      title="Create editable DB version of this static post"
                    >
                      Override
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <p className="text-slate-700 text-xs mt-3 text-center">
        {filtered.length} of {allRows.length} posts shown
        {dbDrafts > 0 && ` · ${dbDrafts} unpublished draft${dbDrafts > 1 ? 's' : ''}`}
      </p>
    </div>
  )
}
