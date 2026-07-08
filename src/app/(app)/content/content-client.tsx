'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { AIPageContext } from '@/components/ui/ai-page-context'
import { RichTextEditor } from '@/components/ui/rich-text-editor'

type PostChannel = 'linkedin' | 'facebook' | 'instagram' | 'tiktok' | 'wordpress'
type PostStatus = 'draft' | 'pending_approval' | 'scheduled' | 'published' | 'failed'

interface Post {
  id: string
  channel: PostChannel
  content: string
  status: PostStatus
  scheduled_at: string | null
  published_at: string | null
  created_at: string
}

interface AuditOption {
  id: string
  score: number
  url: string
  created_at: string
  hasIntel: boolean
}

interface Product {
  id: string
  name: string
  type: 'product' | 'service'
  tagline: string | null
  status: string
}

interface ContentGap {
  type: string
  suggestion: string
  impact: 'high' | 'medium' | 'low'
}

interface ContentClientProps {
  initialPosts: Post[]
  businessName: string
  industry: string
  auditOptions?: AuditOption[]
  connectedChannels?: string[]
  hasWebhook?: boolean
  contentGaps?: ContentGap[]
}

const CHANNEL_META: Record<PostChannel, { label: string; icon: string; color: string }> = {
  linkedin: { label: 'LinkedIn', icon: '💼', color: 'bg-blue-950/40 border-blue-700/40 text-blue-300' },
  facebook: { label: 'Facebook', icon: '📘', color: 'bg-indigo-950/40 border-indigo-700/40 text-indigo-300' },
  instagram: { label: 'Instagram', icon: '📸', color: 'bg-pink-950/40 border-pink-700/40 text-pink-300' },
  tiktok: { label: 'TikTok', icon: '🎵', color: 'bg-slate-800/60 border-slate-600/40 text-slate-300' },
  wordpress: { label: 'Blog', icon: '📝', color: 'bg-orange-950/40 border-orange-700/40 text-orange-300' },
}

const STATUS_META: Record<PostStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-slate-800 text-slate-400' },
  pending_approval: { label: 'Pending', color: 'bg-amber-950/60 text-amber-400' },
  scheduled: { label: 'Scheduled', color: 'bg-violet-950/60 text-violet-400' },
  published: { label: 'Published', color: 'bg-emerald-950/60 text-emerald-400' },
  failed: { label: 'Failed', color: 'bg-red-950/60 text-red-400' },
}

const TONES = ['professional', 'casual', 'enthusiastic', 'educational', 'inspirational']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatScheduled(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const IMPACT_STYLE = {
  high:   'bg-rose-500/15 text-rose-400 border-rose-500/25',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  low:    'bg-slate-700/50 text-slate-400 border-slate-600/25',
}

function GeoIdeaRow({ gap, onGenerated }: { gap: ContentGap; onGenerated: () => Promise<void> }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/geo/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestion: gap.suggestion, type: gap.type }),
      })
      if (res.ok) { setDone(true); await onGenerated() }
    } finally { setLoading(false) }
  }

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-violet-700/40 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[10px] uppercase tracking-wide font-bold text-slate-500">{gap.type}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${IMPACT_STYLE[gap.impact]}`}>
            {gap.impact} impact
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">{gap.suggestion}</p>
      </div>
      <button
        onClick={generate}
        disabled={loading || done}
        className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
          done ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/40 cursor-default'
               : 'bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50'
        }`}
      >
        {loading ? <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> : null}
        {done ? '✓ Saved' : loading ? 'Generating…' : '✨ Generate · 8 credits'}
      </button>
    </div>
  )
}

export default function ContentClient({ initialPosts, businessName, industry, auditOptions = [], connectedChannels = [], hasWebhook = false, contentGaps = [] }: ContentClientProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [filter, setFilter] = useState<PostStatus | 'all' | 'need_to_create'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editPost, setEditPost] = useState<Post | null>(null)
  const [isPending, startTransition] = useTransition()

  // Form state
  const [channel, setChannel] = useState<PostChannel>('linkedin')
  const [content, setContent] = useState('')
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState('professional')
  const [postStatus, setPostStatus] = useState<PostStatus>('draft')
  const [scheduledAt, setScheduledAt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isFilling, setIsFilling] = useState(false)
  const [pushAlertDismissed, setPushAlertDismissed] = useState(false)
  const [suggestedTopics, setSuggestedTopics] = useState<{ title: string; angle: string; why: string }[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const defaultAuditId = auditOptions.find(a => a.hasIntel)?.id ?? auditOptions[0]?.id ?? ''
  const [selectedAuditId, setSelectedAuditId] = useState(defaultAuditId)
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')

  const postsSectionRef = useRef<HTMLDivElement>(null)

  const searchParams = useSearchParams()

  useEffect(() => {
    const trendTopic = searchParams.get('trend')
    const trendTip = searchParams.get('tip')
    const productName = searchParams.get('product')
    const productTopic = searchParams.get('topic')
    if (trendTopic || productName) {
      setEditPost(null)
      setChannel('linkedin')
      setContent('')
      setTopic(productTopic ?? (trendTip ? `${trendTopic}: ${trendTip}` : trendTopic ?? ''))
      setTone('professional')
      setPostStatus('draft')
      setScheduledAt('')
      setSelectedProductId('')
      setShowModal(true)
      fetchSuggestions('linkedin')
    }
    if (productName) {
      fetch('/api/products').then(r => r.json()).then(d => {
        const prods: Product[] = d.products ?? []
        setProducts(prods)
        const match = prods.find(p => p.name === productName)
        if (match) setSelectedProductId(match.id)
      }).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchSuggestions = async (ch: string, auditId?: string) => {
    setLoadingSuggestions(true)
    try {
      const res = await fetch('/api/posts/suggest-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: ch, audit_id: (auditId ?? selectedAuditId) || undefined }),
      })
      const data = await res.json()
      setSuggestedTopics(data.topics ?? [])
    } catch {
      setSuggestedTopics([])
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const openNewModal = () => {
    setEditPost(null)
    setChannel('linkedin')
    setContent('')
    setTopic('')
    setTone('professional')
    setPostStatus('draft')
    setScheduledAt('')
    setSelectedProductId('')
    setSuggestedTopics([])
    setShowModal(true)
    fetchSuggestions('linkedin')
    fetch('/api/products').then(r => r.json()).then(d => setProducts(d.products ?? [])).catch(() => {})
  }

  const openEditModal = (post: Post) => {
    setEditPost(post)
    setChannel(post.channel)
    setContent(post.content)
    setTopic('')
    setTone('professional')
    setPostStatus(post.status)
    setScheduledAt(post.scheduled_at ? post.scheduled_at.slice(0, 16) : '')
    setSelectedProductId('')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditPost(null)
  }

  const handleChannelChange = (ch: PostChannel) => {
    setChannel(ch)
    if (!editPost) fetchSuggestions(ch)
  }

  const handleGenerate = async (overrideTopic?: string) => {
    const useTopic = overrideTopic ?? topic
    setIsGenerating(true)
    try {
      const res = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, topic: useTopic, tone, businessName, industry, audit_id: selectedAuditId || undefined, product_id: selectedProductId || undefined }),
      })
      const data = await res.json()
      if (data.content) setContent(data.content)
    } catch {
      // silently fail
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!content.trim()) return
    setIsSaving(true)
    try {
      if (editPost) {
        const res = await fetch(`/api/posts/${editPost.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel, content, status: postStatus, scheduled_at: scheduledAt || null }),
        })
        const data = await res.json()
        if (data.post) {
          setPosts(prev => prev.map(p => p.id === editPost.id ? data.post : p))
        }
      } else {
        const res = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel, content, status: postStatus, scheduled_at: scheduledAt || null }),
        })
        const data = await res.json()
        if (data.post) {
          setPosts(prev => [data.post, ...prev])
        }
      }
      closeModal()
    } catch {
      // silently fail
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await fetch(`/api/posts/${id}`, { method: 'DELETE' })
      setPosts(prev => prev.filter(p => p.id !== id))
    })
  }

  const handleStatusChange = (id: string, newStatus: PostStatus) => {
    startTransition(async () => {
      const res = await fetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (data.post) setPosts(prev => prev.map(p => p.id === id ? data.post : p))
    })
  }

  const scheduled = posts.filter(p => p.status === 'scheduled').length
  const drafts = posts.filter(p => p.status === 'draft').length
  const pendingApproval = posts.filter(p => p.status === 'pending_approval').length
  const publishedThisMonth = posts.filter(p => {
    if (p.status !== 'published' || !p.published_at) return false
    const d = new Date(p.published_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const filtered = filter === 'all' ? posts : posts.filter(p => p.status === filter)

  // Calendar view: group posts by date
  const calendarDates: Record<string, Post[]> = {}
  posts.forEach(post => {
    const dateKey = post.scheduled_at
      ? post.scheduled_at.slice(0, 10)
      : post.created_at.slice(0, 10)
    calendarDates[dateKey] = [...(calendarDates[dateKey] || []), post]
  })

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <AIPageContext
        title="AI Content Engine"
        subtitle="Your AI agent generates, schedules, and manages content tailored to your business — every day, automatically."
        accent="blue"
        automations={[
          'Suggests daily content topics based on your business & audit',
          'Generates full posts for LinkedIn, Facebook, Instagram, TikTok, Blog',
          'Fills your entire month with one click',
          'Adapts tone and messaging per channel',
          'Tracks which products & services need promotion',
        ]}
        manual={['Review & edit content', 'Approve before publishing', 'Connect social accounts to publish']}
      />
      {/* Content Push Integration Alert */}
      {!hasWebhook && !pushAlertDismissed && (
        <div className="mb-6 rounded-2xl border border-blue-600/50 bg-gradient-to-r from-blue-900/80 via-violet-900/60 to-blue-900/80 p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/30 border border-blue-500/40 flex items-center justify-center text-xl flex-shrink-0 mt-0.5">
            📤
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="font-extrabold text-base" style={{ color: '#ffffff' }}>Auto-publish to your website</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/40">NEW</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#ffffff' }}>
              Connect your website so CooVex AI content automatically publishes there. Works with{' '}
              <strong style={{ color: '#ffffff' }}>WordPress, PHP, Node.js, Python, Ghost</strong>{' '}
              — any platform that accepts a POST request. Set up once, publish forever.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <a
                href="/settings/integrations#content-push"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                ⚡ Set Up Integration
              </a>
              <a
                href="/settings/integrations#content-push"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-lg border border-white/20 transition-colors"
              >
                📋 View Code Examples
              </a>
            </div>
          </div>
          <button
            onClick={() => setPushAlertDismissed(true)}
            className="text-blue-200/60 hover:text-white flex-shrink-0 p-1 transition-colors text-lg leading-none"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Content Calendar</h1>
          <p className="text-slate-400 text-sm mt-0.5">Plan, create, and schedule content across all channels</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setIsFilling(true)
              try {
                const res = await fetch('/api/posts/fill-month', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ count: 10 }),
                })
                const data = await res.json()
                if (data.ok) {
                  startTransition(async () => {
                    const r = await fetch('/api/posts')
                    const d = await r.json()
                    if (d.posts) setPosts(d.posts)
                  })
                }
              } finally {
                setIsFilling(false)
              }
            }}
            disabled={isFilling}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {isFilling ? (
              <><div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" /> Generating…</>
            ) : (
              <>✨ Fill My Month</>
            )}
          </button>
          <button
            onClick={openNewModal}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <span className="text-lg leading-none">+</span> New Post
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Scheduled', value: scheduled, icon: '📅', color: 'text-violet-400', filterVal: 'scheduled' as PostStatus | 'geo' },
          { label: 'Drafts', value: drafts, icon: '✏️', color: 'text-amber-400', filterVal: 'draft' as PostStatus | 'geo' },
          { label: 'Published This Month', value: publishedThisMonth, icon: '✅', color: 'text-emerald-400', filterVal: 'published' as PostStatus | 'geo' },
          { label: 'Content to Create', value: contentGaps.length, icon: '🧠', color: 'text-violet-400', filterVal: 'need_to_create' as PostStatus | 'need_to_create' },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => {
              setFilter(s.filterVal as PostStatus | 'need_to_create')
              postsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-left hover:border-slate-600 transition-colors group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 text-xs group-hover:text-slate-400 transition-colors">{s.label}</span>
              <span>{s.icon}</span>
            </div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </button>
        ))}
      </div>

      {/* Pending approvals banner */}
      {pendingApproval > 0 && (
        <div className="mb-4 bg-amber-950/20 border border-amber-800/30 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-amber-300 text-sm font-medium">
              {pendingApproval} post{pendingApproval > 1 ? 's' : ''} pending team approval
            </p>
          </div>
          <button
            onClick={() => setFilter('pending_approval')}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            Review now →
          </button>
        </div>
      )}

      {/* View toggle + filter */}
      <div ref={postsSectionRef} className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          {(['list', 'calendar'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                view === v ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {v === 'list' ? '☰ List' : '📅 Calendar'}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'draft', 'pending_approval', 'scheduled', 'published'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                filter === f
                  ? 'border-violet-500/50 bg-violet-600/20 text-violet-300'
                  : 'border-slate-800 text-slate-500 hover:text-slate-400'
              }`}
            >
              {f === 'all' ? 'All Posts'
                : f === 'pending_approval' ? 'Pending'
                : f === 'draft' ? 'Drafts'
                : f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'draft' && drafts > 0 && (
                <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none min-w-[18px] text-center">
                  {drafts}
                </span>
              )}
              {f === 'pending_approval' && pendingApproval > 0 && (
                <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none min-w-[18px] text-center">
                  {pendingApproval}
                </span>
              )}
            </button>
          ))}
          {/* Need to Create tab */}
          <button
            onClick={() => setFilter('need_to_create')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              filter === 'need_to_create'
                ? 'border-violet-500/50 bg-violet-600/20 text-violet-300'
                : contentGaps.length > 0
                ? 'border-violet-700/60 bg-violet-950/40 text-violet-400 hover:text-violet-300 animate-pulse'
                : 'border-slate-800 text-slate-500 hover:text-slate-400'
            }`}
          >
            🧠 Need to Create{contentGaps.length > 0 ? ` (${contentGaps.length})` : ''}
          </button>
        </div>
      </div>

      {/* Need to Create view */}
      {filter === 'need_to_create' && (
        <div className="space-y-2">
          {contentGaps.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 text-center">
              <div className="text-4xl mb-3">🧠</div>
              <p className="text-white font-semibold mb-2">No content ideas yet</p>
              <p className="text-slate-400 text-sm mb-4">Run GEO Intelligence to get AI-personalized content ideas.</p>
              <a href="/geo" className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors">
                Go to GEO Optimizer →
              </a>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-500">AI assistants frequently cite these content types. Generate to save as draft and publish automatically.</p>
                <a href="/content/ideas" className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex-shrink-0 ml-4">
                  Full page →
                </a>
              </div>
              {contentGaps.map((gap, i) => (
                <GeoIdeaRow key={i} gap={gap} onGenerated={async () => {
                  const r = await fetch('/api/posts'); const d = await r.json()
                  if (d.posts) { setPosts(d.posts); setFilter('draft') }
                }} />
              ))}
            </>
          )}
        </div>
      )}

      {/* List View */}
      {view === 'list' && filter !== 'need_to_create' && (
        <div>
          {filtered.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 text-center">
              <div className="text-5xl mb-4">✍️</div>
              <h2 className="text-white font-semibold mb-2">No posts yet</h2>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
                Create your first post and your AI agent will help you build a consistent publishing schedule.
              </p>
              <button
                onClick={openNewModal}
                className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
              >
                Create First Post
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(post => {
                const ch = CHANNEL_META[post.channel]
                const st = STATUS_META[post.status]
                return (
                  <div key={post.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex gap-4 group hover:border-slate-700 transition-colors">
                    <div className={`flex-shrink-0 w-20 text-center py-2 rounded-lg border text-xs font-medium ${ch.color}`}>
                      <div className="text-xl mb-0.5">{ch.icon}</div>
                      {ch.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 text-sm leading-relaxed line-clamp-2">{post.content}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                        {post.scheduled_at && (
                          <span className="text-slate-500 text-xs">📅 {formatScheduled(post.scheduled_at)}</span>
                        )}
                        {post.published_at && (
                          <span className="text-slate-500 text-xs">✅ {formatDate(post.published_at)}</span>
                        )}
                        {!post.scheduled_at && !post.published_at && (
                          <span className="text-slate-600 text-xs">{formatDate(post.created_at)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity items-center">
                      {post.status === 'draft' && (
                        <button
                          onClick={() => handleStatusChange(post.id, 'pending_approval')}
                          disabled={isPending}
                          className="text-xs text-amber-400 hover:text-amber-300 px-2 py-1 rounded-md hover:bg-amber-950/30 transition-colors"
                        >
                          Submit
                        </button>
                      )}
                      {post.status === 'pending_approval' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(post.id, 'scheduled')}
                            disabled={isPending}
                            className="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-md hover:bg-emerald-950/30 transition-colors font-medium"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => handleStatusChange(post.id, 'draft')}
                            disabled={isPending}
                            className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded-md hover:bg-red-950/30 transition-colors"
                          >
                            ✗ Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => openEditModal(post)}
                        className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-md hover:bg-slate-800 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        disabled={isPending}
                        className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded-md hover:bg-red-950/30 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Calendar View */}
      {view === 'calendar' && filter !== 'need_to_create' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h2 className="text-white font-semibold mb-4 text-center">{monthName}</h2>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-slate-500 text-xs font-medium py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfMonth }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayPosts = calendarDates[dateKey] || []
              const isToday = day === now.getDate()
              return (
                <div
                  key={day}
                  className={`min-h-16 p-1.5 rounded-lg border transition-colors cursor-pointer hover:border-slate-700 ${
                    isToday ? 'border-violet-600/50 bg-violet-950/20' : 'border-slate-800/50'
                  }`}
                  onClick={() => {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T09:00`
                    setScheduledAt(dateStr)
                    openNewModal()
                  }}
                >
                  <span className={`text-xs font-medium ${isToday ? 'text-violet-400' : 'text-slate-500'}`}>{day}</span>
                  <div className="mt-1 space-y-0.5">
                    {dayPosts.slice(0, 2).map(p => (
                      <div
                        key={p.id}
                        onClick={e => { e.stopPropagation(); openEditModal(p) }}
                        className={`text-xs truncate rounded px-1 py-0.5 border cursor-pointer ${CHANNEL_META[p.channel].color}`}
                        title={p.content}
                      >
                        {CHANNEL_META[p.channel].icon} {p.content.slice(0, 20)}…
                      </div>
                    ))}
                    {dayPosts.length > 2 && (
                      <div className="text-xs text-slate-500 pl-1">+{dayPosts.length - 2} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* New / Edit Post Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="text-white font-semibold">{editPost ? 'Edit Post' : 'Create New Post'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-white text-xl leading-none transition-colors">×</button>
            </div>

            <div className="p-5 space-y-5">
              {/* Channel selector */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Channel</label>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(CHANNEL_META) as PostChannel[]).map(c => {
                    const m = CHANNEL_META[c]
                    const isConnected = c === 'wordpress' || connectedChannels.includes(c)
                    return (
                      <button
                        key={c}
                        onClick={() => handleChannelChange(c)}
                        className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          channel === c ? m.color : 'border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        {m.icon} {m.label}
                        {!isConnected && (
                          <span className="ml-0.5 text-amber-500 text-[10px]">⚠</span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Not connected warning */}
                {channel !== 'wordpress' && !connectedChannels.includes(channel) && (
                  <div className="mt-2 flex items-center gap-2 bg-amber-950/20 border border-amber-800/30 rounded-lg px-3 py-2">
                    <span className="text-amber-400 text-sm flex-shrink-0">⚠</span>
                    <p className="text-amber-300/80 text-xs">
                      <span className="font-medium">{CHANNEL_META[channel].label} not connected</span> — posts will be saved but not published automatically.{' '}
                      <a href="/settings/integrations#social" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">Connect account →</a>
                    </p>
                  </div>
                )}
              </div>

              {/* AI generation */}
              {!editPost && (
                <div className="bg-violet-950/20 border border-violet-800/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-violet-300">✨ AI Generate</label>
                  </div>

                  {/* Audit context selector */}
                  {auditOptions.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 flex-shrink-0">Context:</span>
                      <select
                        value={selectedAuditId}
                        onChange={e => {
                          setSelectedAuditId(e.target.value)
                          fetchSuggestions(channel, e.target.value)
                        }}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-violet-500 transition-colors"
                      >
                        <option value="">— No audit selected —</option>
                        {auditOptions.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.url} · {a.score}/100 · {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{a.hasIntel ? ' ✓' : ' ⚠'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Product/service selector */}
                  {products.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 flex-shrink-0">Product:</span>
                      <select
                        value={selectedProductId}
                        onChange={e => setSelectedProductId(e.target.value)}
                        className={`flex-1 bg-slate-900 border rounded-lg px-2 py-1.5 text-xs focus:outline-none transition-colors ${
                          selectedProductId
                            ? 'border-violet-500/60 text-violet-200 focus:border-violet-400'
                            : 'border-slate-700 text-slate-300 focus:border-violet-500'
                        }`}
                      >
                        <option value="">— General content (no product) —</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-600 truncate">
                      {selectedAuditId
                        ? `Topics based on: ${auditOptions.find(a => a.id === selectedAuditId)?.url ?? 'selected audit'}`
                        : 'Topics based on: business info only'}
                    </span>
                    <select
                      value={tone}
                      onChange={e => setTone(e.target.value)}
                      className="flex-shrink-0 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-violet-500 appearance-none transition-colors"
                    >
                      {TONES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </div>

                  {/* AI suggested topics */}
                  {loadingSuggestions ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500 py-1">
                      <span className="w-4 h-4 border border-slate-600 border-t-violet-400 rounded-full animate-spin flex-shrink-0" />
                      AI is choosing the best topics for your business…
                    </div>
                  ) : suggestedTopics.length > 0 ? (
                    <div>
                      <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Suggested by AI — click to generate instantly</p>
                      <div className="space-y-2">
                        {suggestedTopics.map((t, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setTopic(t.title)
                              handleGenerate(t.title)
                            }}
                            disabled={isGenerating}
                            className="w-full text-left flex items-start gap-3 bg-slate-900/60 hover:bg-slate-800 border border-slate-700 hover:border-violet-600/50 rounded-lg px-3 py-2.5 transition-colors group"
                          >
                            <span className="text-xs mt-0.5 flex-shrink-0 bg-slate-800 group-hover:bg-violet-900/40 text-slate-400 group-hover:text-violet-400 border border-slate-700 group-hover:border-violet-700/40 px-2 py-0.5 rounded uppercase tracking-wide">
                              {t.angle}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm text-slate-200 group-hover:text-white leading-snug font-medium">{t.title}</p>
                              <p className="text-xs text-slate-500 group-hover:text-slate-400 mt-0.5">{t.why}</p>
                            </div>
                            <span className="flex-shrink-0 text-slate-500 group-hover:text-violet-400 text-sm mt-0.5 ml-auto">→</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Manual topic input */}
                  <div className="flex gap-2">
                    <input
                      value={topic}
                      onChange={e => setTopic(e.target.value)}
                      placeholder="Or type your own topic…"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                      onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                    />
                    <button
                      onClick={() => handleGenerate()}
                      disabled={isGenerating}
                      className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {isGenerating ? (
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Generating…
                        </span>
                      ) : topic.trim() ? '✨ Generate' : '✨ Surprise me'}
                    </button>
                  </div>
                </div>
              )}

              {/* Content editor */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Content</label>
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Write your post content here, or use AI Generate above…"
                  minHeight={220}
                />
              </div>

              {/* Status + schedule */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Status</label>
                  <select
                    value={postStatus}
                    onChange={e => setPostStatus(e.target.value as PostStatus)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 appearance-none transition-colors"
                  >
                    <option value="draft">Draft</option>
                    <option value="pending_approval">Pending Approval</option>
                    <option value="scheduled" disabled={channel !== 'wordpress' && !connectedChannels.includes(channel)}>
                      {channel !== 'wordpress' && !connectedChannels.includes(channel) ? 'Scheduled (connect account first)' : 'Scheduled'}
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Schedule Date & Time</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={e => setScheduledAt(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-800">
              <button onClick={closeModal} className="text-slate-400 hover:text-white text-sm transition-colors">Cancel</button>
              <button
                onClick={handleSave}
                disabled={isSaving || !content.trim()}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
              >
                {isSaving ? 'Saving…' : editPost ? 'Save Changes' : 'Create Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
