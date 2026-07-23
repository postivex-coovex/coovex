'use client'

import { useState, useTransition } from 'react'
import { AIPageContext } from '@/components/ui/ai-page-context'

export type SocialPlatform = 'summary' | 'linkedin' | 'facebook' | 'reddit' | 'x' | 'youtube'
type SocialChannel = 'linkedin' | 'facebook' | 'reddit' | 'x' | 'youtube'
type PostStatus = 'draft' | 'pending_approval' | 'published' | 'failed'

export interface SocialPost {
  id: string
  channel: SocialChannel
  content: string
  status: PostStatus
  scheduled_at: string | null
  published_at: string | null
  created_at: string
  slug: string | null // reused to store published_url for social posts
}

interface PlatformCfg {
  social_enabled?: boolean
  connected?: boolean
}

export interface SocialClientProps {
  platform: SocialPlatform
  posts: SocialPost[]
  businessName: string
  industry: string
  settings: Record<string, PlatformCfg>
}

// ── Platform metadata ──────────────────────────────────────────────────────────

const CHANNELS: SocialChannel[] = ['linkedin', 'facebook', 'reddit', 'x', 'youtube']

const META: Record<SocialChannel, {
  label: string
  icon: string
  hint: string
  tones: string[]
  defaultTone: string
  maxChars?: number
  youtubeTypes?: string[]
}> = {
  linkedin: {
    label: 'LinkedIn',     icon: '💼',
    hint: 'Professional network. Hook in first 2 lines (before "…see more"). Max 3 hashtags.',
    tones: ['Professional', 'Thought Leadership', 'Educational', 'Storytelling'],
    defaultTone: 'Professional', maxChars: 3000,
  },
  facebook: {
    label: 'Facebook',     icon: '📘',
    hint: 'Conversational and relatable. End with an engagement question.',
    tones: ['Conversational', 'Community', 'Informative', 'Engaging'],
    defaultTone: 'Conversational', maxChars: 2000,
  },
  reddit: {
    label: 'Reddit',       icon: '🔴',
    hint: 'Authentic community tone — value-first, zero promotion. Include Title + Body.',
    tones: ['Authentic', 'Helpful', 'Storytelling', 'Ask Reddit'],
    defaultTone: 'Authentic',
  },
  x: {
    label: 'X (Twitter)',  icon: '✕',
    hint: 'Under 280 chars for single tweet. Thread = 4–6 numbered tweets.',
    tones: ['Punchy', 'Informative', 'Witty', 'Thread'],
    defaultTone: 'Punchy', maxChars: 280,
  },
  youtube: {
    label: 'YouTube',      icon: '▶',
    hint: 'Script outlines power future AI video generation. Be detailed.',
    tones: ['Script Outline', 'Video Description', 'SEO Title + Description'],
    defaultTone: 'Script Outline',
  },
}

const PENDING_LIMIT = 3

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Pending post card ──────────────────────────────────────────────────────────

function PendingCard({ post, onUpdate }: { post: SocialPost; onUpdate: (updated: SocialPost) => void }) {
  const [urlInput, setUrlInput] = useState(post.slug ?? '')
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function markPublished() {
    if (!urlInput.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/social/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published', slug: urlInput.trim() }),
      })
      if (res.ok) {
        const { post: updated } = await res.json()
        onUpdate(updated)
      }
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await fetch(`/api/social/posts/${post.id}`, { method: 'DELETE' })
      onUpdate({ ...post, status: 'failed' }) // signal removal
    } finally { setDeleting(false) }
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400">
            Pending Manual
          </span>
          <span className="text-xs text-slate-500">{fmtDate(post.created_at)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {expanded ? 'Hide' : 'Show content'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-slate-600 hover:text-red-400 transition-colors px-2 py-1 rounded"
          >
            {deleting ? '…' : 'Delete'}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-3">
          <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-900/50 rounded-lg p-3 border border-slate-700/40 max-h-48 overflow-y-auto font-sans">
            {post.content}
          </pre>
        </div>
      )}
      <div className="px-4 pb-4 flex items-center gap-2">
        <input
          type="url"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          placeholder="Paste published URL after posting manually…"
          className="flex-1 text-xs bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/60"
        />
        <button
          onClick={markPublished}
          disabled={!urlInput.trim() || saving}
          className="flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-colors"
        >
          {saving ? '…' : 'Mark Published'}
        </button>
      </div>
    </div>
  )
}

// ── Published post card ────────────────────────────────────────────────────────

function PublishedCard({ post }: { post: SocialPost }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 px-4 py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
          {post.content.slice(0, expanded ? undefined : 120)}{!expanded && post.content.length > 120 ? '…' : ''}
        </p>
        {post.slug && (
          <a href={post.slug} target="_blank" rel="noopener noreferrer"
            className="text-[11px] text-blue-400 hover:underline mt-1 block truncate">
            {post.slug}
          </a>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] text-slate-600">{fmtDate(post.published_at ?? post.created_at)}</span>
        <button onClick={() => setExpanded(e => !e)} className="text-[11px] text-slate-600 hover:text-slate-400">
          {expanded ? '▲' : '▼'}
        </button>
      </div>
    </div>
  )
}

// ── Generate form ──────────────────────────────────────────────────────────────

function GenerateForm({
  channel, businessName, pendingCount, onGenerated,
}: {
  channel: SocialChannel
  businessName: string
  pendingCount: number
  onGenerated: (post: SocialPost) => void
}) {
  const meta = META[channel]
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState(meta.defaultTone)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const atLimit = pendingCount >= PENDING_LIMIT

  async function generate() {
    if (!topic.trim() || atLimit) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/social/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, topic: topic.trim(), tone, save: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Generation failed')
        return
      }
      onGenerated(data.post)
      setTopic('')
    } finally { setGenerating(false) }
  }

  if (atLimit) {
    return (
      <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 px-4 py-4 text-center">
        <p className="text-sm font-medium text-slate-300">3 pending posts in queue</p>
        <p className="text-xs text-slate-500 mt-1">Publish or delete existing posts before generating more.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 flex flex-col gap-3">
      <p className="text-[11px] text-slate-500">{meta.hint}</p>
      <textarea
        value={topic}
        onChange={e => setTopic(e.target.value)}
        placeholder={channel === 'youtube' ? 'Video topic or title idea…' : 'What should this post be about?'}
        rows={2}
        className="text-sm bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/60 resize-none"
      />
      <div className="flex items-center gap-3">
        <select
          value={tone}
          onChange={e => setTone(e.target.value)}
          className="flex-1 text-xs bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-blue-500/60"
        >
          {meta.tones.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          onClick={generate}
          disabled={!topic.trim() || generating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 transition-colors flex-shrink-0"
        >
          {generating && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {generating ? 'Generating…' : '✨ Generate · 8 credits'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

// ── Platform view ──────────────────────────────────────────────────────────────

function PlatformView({
  platform, posts: initialPosts, businessName, industry, enabled, onToggleEnabled,
}: {
  platform: SocialChannel
  posts: SocialPost[]
  businessName: string
  industry: string
  enabled: boolean
  onToggleEnabled: (enabled: boolean) => void
}) {
  const [posts, setPosts] = useState<SocialPost[]>(initialPosts)
  const [toggling, startToggle] = useTransition()
  const meta = META[platform]

  const pending   = posts.filter(p => p.status === 'pending_approval')
  const published = posts.filter(p => p.status === 'published')

  function onGenerated(post: SocialPost) {
    setPosts(prev => [post, ...prev])
  }

  function onUpdate(updated: SocialPost) {
    setPosts(prev =>
      updated.status === 'failed'
        ? prev.filter(p => p.id !== updated.id) // deleted
        : prev.map(p => p.id === updated.id ? updated : p)
    )
  }

  async function toggleEnabled(val: boolean) {
    startToggle(async () => {
      await fetch('/api/social/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: platform, enabled: val }),
      })
      onToggleEnabled(val)
    })
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <AIPageContext
        title={`${meta.label} Autopilot`}
        subtitle={`AI generates platform-native ${platform === 'youtube' ? 'scripts' : 'posts'} daily. Pending posts wait for your manual publish — enter the URL to mark them done.`}
        automations={[
          `Generates 1 ${meta.label} ${platform === 'youtube' ? 'script' : 'post'} daily`,
          'Stops at 3 pending posts until you publish them',
          'Saves all content to your post history',
        ]}
        manual={[`Manually ${platform === 'youtube' ? 'upload video and' : 'post and'} enter the published URL`]}
        accent="blue"
      />

      {/* Header + enable toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{meta.icon}</span>
          <div>
            <h1 className="text-lg font-bold text-slate-100">{meta.label}</h1>
            <p className="text-xs text-slate-500">
              {pending.length}/{PENDING_LIMIT} pending · {published.length} published
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{enabled ? 'Enabled' : 'Disabled'}</span>
          <button
            onClick={() => toggleEnabled(!enabled)}
            disabled={toggling}
            className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-slate-700'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${enabled ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {!enabled && (
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 px-4 py-6 text-center">
          <p className="text-sm text-slate-500">This platform is disabled. Enable it to start generating daily posts.</p>
        </div>
      )}

      {enabled && (
        <>
          {/* Generate form */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Generate Post</h2>
            <GenerateForm
              channel={platform}
              businessName={businessName}
              pendingCount={pending.length}
              onGenerated={onGenerated}
            />
          </div>

          {/* Pending posts */}
          {pending.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Pending Manual Publishing ({pending.length}/{PENDING_LIMIT})
                </h2>
                {pending.length >= PENDING_LIMIT && (
                  <span className="text-[10px] text-amber-400 font-medium">Queue full — publish to unblock</span>
                )}
              </div>
              <div className="flex flex-col gap-3">
                {pending.map(p => <PendingCard key={p.id} post={p} onUpdate={onUpdate} />)}
              </div>
            </div>
          )}

          {/* Published history */}
          {published.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Published ({published.length})
              </h2>
              <div className="flex flex-col gap-2">
                {published.slice(0, 10).map(p => <PublishedCard key={p.id} post={p} />)}
              </div>
            </div>
          )}

          {pending.length === 0 && published.length === 0 && (
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 px-4 py-8 text-center">
              <p className="text-sm text-slate-500">No posts yet. Generate your first one above.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Summary view ───────────────────────────────────────────────────────────────

function SummaryView({
  posts: initialPosts, businessName, settings: initialSettings,
}: {
  posts: SocialPost[]
  businessName: string
  settings: Record<string, PlatformCfg>
}) {
  const [posts, setPosts] = useState<SocialPost[]>(initialPosts)
  const [settings, setSettings] = useState(initialSettings)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState<{ generated: number; results: { channel: string; status: string; reason?: string }[] } | null>(null)

  async function generateAll() {
    setGenerating(true)
    setGenResult(null)
    try {
      const res = await fetch('/api/social/posts/generate-all', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setGenResult(data)
        // Refresh posts
        const r = await fetch('/api/social/posts')
        if (r.ok) { const d = await r.json(); setPosts(d.posts ?? []) }
      }
    } finally { setGenerating(false) }
  }

  const pendingTotal = posts.filter(p => p.status === 'pending_approval').length
  const publishedTotal = posts.filter(p => p.status === 'published').length

  return (
    <div className="flex flex-col gap-6 pb-8">
      <AIPageContext
        title="Social Marketing Autopilot"
        subtitle={`Generates daily posts across all enabled platforms for ${businessName}. Posts wait in a pending queue until you publish them manually and enter the URL.`}
        automations={[
          'Generates one post per enabled platform daily',
          'Enforces a 3-post pending limit per platform',
          'Saves all content to post history with published URLs',
          'YouTube produces script outlines for future AI video generation',
        ]}
        manual={['Enable platforms', 'Publish posts manually and enter URLs']}
        accent="blue"
      />

      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Social Autopilot Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {pendingTotal} pending · {publishedTotal} published
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={generateAll}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 transition-colors"
          >
            {generating && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {generating ? 'Generating…' : '✨ Generate Today\'s Posts'}
          </button>
        </div>
      </div>

      {/* Generate result */}
      {genResult && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
          <p className="text-sm font-semibold text-slate-200 mb-2">
            Generated {genResult.generated} post{genResult.generated !== 1 ? 's' : ''}
          </p>
          <div className="flex flex-col gap-1.5">
            {genResult.results.map(r => (
              <div key={r.channel} className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 w-24">{META[r.channel as SocialChannel]?.label ?? r.channel}</span>
                <span className={r.status === 'generated' ? 'text-blue-400' : 'text-slate-600'}>
                  {r.status === 'generated' ? '✓ Generated' : `Skipped — ${r.reason}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platform cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {CHANNELS.map(ch => {
          const meta = META[ch]
          const cfg = settings[ch]
          const enabled = cfg?.social_enabled ?? false
          const chPending   = posts.filter(p => p.channel === ch && p.status === 'pending_approval').length
          const chPublished = posts.filter(p => p.channel === ch && p.status === 'published').length
          const atLimit = chPending >= PENDING_LIMIT

          return (
            <div key={ch} className={`rounded-xl border p-4 flex flex-col gap-3 ${enabled ? 'border-slate-700/50 bg-slate-800/30' : 'border-slate-800/40 bg-slate-900/20 opacity-60'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{meta.icon}</span>
                  <span className="text-sm font-semibold text-slate-200">{meta.label}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${enabled ? 'bg-blue-600/20 text-blue-400' : 'bg-slate-800 text-slate-600'}`}>
                  {enabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-xl font-bold text-slate-100">{chPending}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Pending</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-100">{chPublished}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Published</p>
                </div>
              </div>
              {atLimit && enabled && (
                <p className="text-[10px] text-amber-400">Queue full — publish posts to unblock</p>
              )}
              <a
                href={`/social/${ch}`}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
              >
                Manage →
              </a>
            </div>
          )
        })}
      </div>

      {/* Recent pending across all platforms */}
      {pendingTotal > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Pending Posts ({pendingTotal})
          </h2>
          <div className="flex flex-col gap-3">
            {posts
              .filter(p => p.status === 'pending_approval')
              .slice(0, 6)
              .map(p => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-700/40 bg-slate-800/30">
                  <span className="text-base">{META[p.channel]?.icon}</span>
                  <p className="flex-1 text-xs text-slate-400 truncate">{p.content.slice(0, 100)}…</p>
                  <a href={`/social/${p.channel}`} className="flex-shrink-0 text-xs text-blue-400 hover:underline">
                    Publish →
                  </a>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Root export ────────────────────────────────────────────────────────────────

export default function SocialClient({ platform, posts, businessName, industry, settings: initialSettings }: SocialClientProps) {
  const [settings, setSettings] = useState(initialSettings)

  function onToggleEnabled(ch: SocialChannel, val: boolean) {
    setSettings(prev => ({
      ...prev,
      [ch]: { ...(prev[ch] ?? {}), social_enabled: val },
    }))
  }

  if (platform === 'summary') {
    return <SummaryView posts={posts} businessName={businessName} settings={settings} />
  }

  const ch = platform as SocialChannel
  const enabled = settings[ch]?.social_enabled ?? false

  return (
    <PlatformView
      platform={ch}
      posts={posts}
      businessName={businessName}
      industry={industry}
      enabled={enabled}
      onToggleEnabled={val => onToggleEnabled(ch, val)}
    />
  )
}
