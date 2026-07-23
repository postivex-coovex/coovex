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
  slug: string | null
}

interface PlatformCfg { social_enabled?: boolean; connected?: boolean }

export interface SocialClientProps {
  platform: SocialPlatform
  posts: SocialPost[]
  businessName: string
  industry: string
  settings: Record<string, PlatformCfg>
}

// ── Platform SVG icons ─────────────────────────────────────────────────────────

function LinkedInIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

function FacebookIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
}

function RedditIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
    </svg>
  )
}

function XIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )
}

function YouTubeIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
}

// ── Platform metadata ──────────────────────────────────────────────────────────

const CHANNELS: SocialChannel[] = ['linkedin', 'facebook', 'reddit', 'x', 'youtube']

const META: Record<SocialChannel, {
  label: string
  Icon: React.ComponentType<{ className?: string }>
  color: string        // bg color for icon container
  textColor: string    // icon color
  borderColor: string  // card border when active
  hint: string
  tones: string[]
  defaultTone: string
  features: string[]
}> = {
  linkedin: {
    label: 'LinkedIn',
    Icon: LinkedInIcon,
    color: 'bg-blue-600/15',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    hint: 'Hook in first 2 lines (shows before "…see more"). Max 3 hashtags. End with a question or CTA.',
    tones: ['Professional', 'Thought Leadership', 'Educational', 'Storytelling'],
    defaultTone: 'Professional',
    features: ['B2B thought leadership posts', 'Professional tone, 150–300 words', 'Hashtag-optimized for reach'],
  },
  facebook: {
    label: 'Facebook',
    Icon: FacebookIcon,
    color: 'bg-indigo-600/15',
    textColor: 'text-indigo-400',
    borderColor: 'border-indigo-500/30',
    hint: 'Conversational and relatable. End with an engagement question to boost comments.',
    tones: ['Conversational', 'Community', 'Informative', 'Engaging'],
    defaultTone: 'Conversational',
    features: ['Page posts with community tone', '80–200 words with natural emojis', 'Engagement-first format'],
  },
  reddit: {
    label: 'Reddit',
    Icon: RedditIcon,
    color: 'bg-orange-600/15',
    textColor: 'text-orange-400',
    borderColor: 'border-orange-500/30',
    hint: 'Community-native tone — value-first, zero promotional language. Includes Title + Body.',
    tones: ['Authentic', 'Helpful', 'Storytelling', 'Ask Reddit'],
    defaultTone: 'Authentic',
    features: ['Community-native, non-promotional', 'Title + Body format for any subreddit', 'Genuine member voice, not marketer'],
  },
  x: {
    label: 'X (Twitter)',
    Icon: XIcon,
    color: 'bg-slate-600/20',
    textColor: 'text-slate-300',
    borderColor: 'border-slate-500/30',
    hint: 'Single tweet = under 280 chars. Thread = 4–6 numbered tweets. Hook in the first line.',
    tones: ['Punchy', 'Informative', 'Witty', 'Thread'],
    defaultTone: 'Punchy',
    features: ['Single tweets under 280 chars', 'Thread format (4–6 tweets)', 'Hook-first, high shareability'],
  },
  youtube: {
    label: 'YouTube',
    Icon: YouTubeIcon,
    color: 'bg-red-600/15',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
    hint: 'Script outlines power future AI video generation. Be detailed — include hook, sections, CTA.',
    tones: ['Script Outline', 'Video Description', 'SEO Title + Description'],
    defaultTone: 'Script Outline',
    features: ['Detailed script outlines for AI video', 'SEO-optimized titles & descriptions', 'Chapter breakdown format'],
  },
}

const PENDING_LIMIT = 3

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Pending post card ──────────────────────────────────────────────────────────

function PendingCard({ post, onUpdate }: { post: SocialPost; onUpdate: (p: SocialPost) => void }) {
  const [urlInput, setUrlInput] = useState(post.slug ?? '')
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const meta = META[post.channel]

  async function markPublished() {
    if (!urlInput.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/social/posts/${post.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published', slug: urlInput.trim() }),
      })
      if (res.ok) { const { post: u } = await res.json(); onUpdate(u) }
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/social/posts/${post.id}`, { method: 'DELETE' })
    onUpdate({ ...post, status: 'failed' })
    setDeleting(false)
  }

  return (
    <div className={`rounded-2xl border ${meta.borderColor} bg-slate-800/50 overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg ${meta.color} flex items-center justify-center`}>
            <meta.Icon className={`w-3.5 h-3.5 ${meta.textColor}`} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-300">{meta.label}</span>
            <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
              Pending
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-600">{fmtDate(post.created_at)}</span>
          <button onClick={() => setExpanded(e => !e)} className="text-[11px] text-slate-500 hover:text-slate-300 px-2 py-1 rounded transition-colors">
            {expanded ? 'Hide' : 'Preview'}
          </button>
          <button onClick={handleDelete} disabled={deleting} className="text-[11px] text-slate-600 hover:text-red-400 px-2 py-1 rounded transition-colors">
            {deleting ? '…' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Content preview */}
      {expanded && (
        <div className="px-4 py-3 border-b border-slate-700/40">
          <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans max-h-44 overflow-y-auto">
            {post.content}
          </pre>
        </div>
      )}

      {/* URL input row */}
      <div className="px-4 py-3 flex items-center gap-2.5 bg-slate-900/30">
        <div className="flex-1 flex items-center gap-2 bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2">
          <svg className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <input
            type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)}
            placeholder="Paste published URL after posting manually…"
            className="flex-1 text-xs bg-transparent text-slate-200 placeholder:text-slate-600 focus:outline-none"
          />
        </div>
        <button
          onClick={markPublished} disabled={!urlInput.trim() || saving}
          className="flex-shrink-0 text-xs font-semibold px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-colors"
        >
          {saving ? '…' : '✓ Mark Published'}
        </button>
      </div>
    </div>
  )
}

// ── Published post card ────────────────────────────────────────────────────────

function PublishedCard({ post }: { post: SocialPost }) {
  const [expanded, setExpanded] = useState(false)
  const meta = META[post.channel]
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3 flex items-start gap-3">
      <div className={`w-7 h-7 rounded-lg ${meta.color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
        <meta.Icon className={`w-3.5 h-3.5 ${meta.textColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 leading-relaxed">
          {expanded ? post.content : post.content.slice(0, 110) + (post.content.length > 110 ? '…' : '')}
        </p>
        {post.slug && (
          <a href={post.slug} target="_blank" rel="noopener noreferrer"
            className="text-[11px] text-blue-400 hover:underline mt-1 block truncate">{post.slug}</a>
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

function GenerateForm({ channel, pendingCount, onGenerated }: {
  channel: SocialChannel
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
    setGenerating(true); setError(null)
    try {
      const res = await fetch('/api/social/posts/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, topic: topic.trim(), tone, save: true }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Generation failed'); return }
      onGenerated(data.post)
      setTopic('')
    } finally { setGenerating(false) }
  }

  if (atLimit) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0 text-sm">⏸</div>
        <div>
          <p className="text-sm font-semibold text-amber-300">Queue is full ({PENDING_LIMIT}/{PENDING_LIMIT})</p>
          <p className="text-xs text-slate-500 mt-0.5">Publish or delete existing posts to generate new ones.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-0.5">
        <div className={`w-6 h-6 rounded-md ${meta.color} flex items-center justify-center`}>
          <meta.Icon className={`w-3 h-3 ${meta.textColor}`} />
        </div>
        <span className="text-xs font-semibold text-slate-400">Generate {meta.label} {channel === 'youtube' ? 'Script' : 'Post'}</span>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">{meta.hint}</p>
      <textarea
        value={topic} onChange={e => setTopic(e.target.value)}
        placeholder={channel === 'youtube' ? 'Video topic or title idea…' : 'What should this post be about?'}
        rows={2}
        className="text-sm bg-slate-900/60 border border-slate-700/50 rounded-xl px-3.5 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 resize-none transition-colors"
      />
      <div className="flex items-center gap-2">
        <select value={tone} onChange={e => setTone(e.target.value)}
          className="flex-1 text-xs bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-slate-300 focus:outline-none focus:border-blue-500/50 transition-colors">
          {meta.tones.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={generate} disabled={!topic.trim() || generating}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 transition-colors flex-shrink-0">
          {generating && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {generating ? 'Generating…' : '✨ Generate · 8 credits'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
    </div>
  )
}

// ── Disabled state ─────────────────────────────────────────────────────────────

function DisabledState({ channel, onEnable }: { channel: SocialChannel; onEnable: () => void }) {
  const meta = META[channel]
  return (
    <div className="rounded-2xl border border-slate-700/40 bg-slate-800/20 overflow-hidden">
      {/* Top bar */}
      <div className={`h-1 w-full ${meta.textColor.replace('text-', 'bg-').replace('400', '500')} opacity-40`} />
      <div className="p-8 flex flex-col items-center text-center gap-5">
        <div className={`w-16 h-16 rounded-2xl ${meta.color} border border-slate-700/40 flex items-center justify-center`}>
          <meta.Icon className={`w-8 h-8 ${meta.textColor}`} />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-200">{meta.label} Autopilot</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">
            Enable to start generating daily {channel === 'youtube' ? 'video scripts' : 'posts'} automatically.
          </p>
        </div>
        {/* Feature list */}
        <div className="flex flex-col gap-2 w-full max-w-xs text-left">
          {meta.features.map(f => (
            <div key={f} className="flex items-center gap-2.5 text-xs text-slate-400">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.textColor.replace('text-', 'bg-')}`} />
              {f}
            </div>
          ))}
        </div>
        <button onClick={onEnable}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors bg-blue-600 hover:bg-blue-500`}>
          Enable {meta.label} Autopilot
        </button>
      </div>
    </div>
  )
}

// ── Platform view ──────────────────────────────────────────────────────────────

function PlatformView({ platform, posts: initialPosts, businessName, industry, enabled, onToggleEnabled }: {
  platform: SocialChannel
  posts: SocialPost[]
  businessName: string
  industry: string
  enabled: boolean
  onToggleEnabled: (v: boolean) => void
}) {
  const [posts, setPosts] = useState<SocialPost[]>(initialPosts)
  const [, startToggle] = useTransition()
  const meta = META[platform]

  const pending   = posts.filter(p => p.status === 'pending_approval')
  const published = posts.filter(p => p.status === 'published')

  function onGenerated(post: SocialPost) { setPosts(prev => [post, ...prev]) }
  function onUpdate(updated: SocialPost) {
    setPosts(prev => updated.status === 'failed'
      ? prev.filter(p => p.id !== updated.id)
      : prev.map(p => p.id === updated.id ? updated : p)
    )
  }

  async function toggleEnabled(val: boolean) {
    startToggle(async () => {
      await fetch('/api/social/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: platform, enabled: val }),
      })
      onToggleEnabled(val)
    })
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <AIPageContext
        title={`${meta.label} Autopilot`}
        subtitle={`AI generates platform-native ${platform === 'youtube' ? 'scripts' : 'posts'} daily. Posts land in a pending queue — publish manually and enter the URL to mark them done.`}
        automations={[
          `Generates 1 ${meta.label} ${platform === 'youtube' ? 'script' : 'post'} daily`,
          'Stops at 3 pending posts to avoid spam',
          'Saves all history with published URLs',
        ]}
        manual={[`Post manually on ${meta.label} then enter the URL`]}
        accent="blue"
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${meta.color} border ${meta.borderColor} flex items-center justify-center`}>
            <meta.Icon className={`w-5 h-5 ${meta.textColor}`} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100">{meta.label}</h1>
            <p className="text-xs text-slate-500">
              {enabled ? `${pending.length}/${PENDING_LIMIT} pending · ${published.length} published` : 'Disabled'}
            </p>
          </div>
        </div>
        {enabled && (
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-slate-500">Enabled</span>
            <button onClick={() => toggleEnabled(false)}
              className="relative w-10 h-5 rounded-full bg-blue-600 transition-colors">
              <span className="absolute top-0.5 left-5 w-4 h-4 rounded-full bg-white shadow transition-all" />
            </button>
          </div>
        )}
      </div>

      {/* Disabled state */}
      {!enabled && <DisabledState channel={platform} onEnable={() => toggleEnabled(true)} />}

      {enabled && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Pending', value: pending.length, accent: pending.length >= PENDING_LIMIT },
              { label: 'Published', value: published.length, accent: false },
              { label: 'Queue limit', value: `${pending.length}/${PENDING_LIMIT}`, accent: false },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-slate-700/40 bg-slate-800/30 px-4 py-3">
                <p className={`text-xl font-bold ${s.accent && pending.length >= PENDING_LIMIT ? 'text-amber-400' : 'text-slate-100'}`}>
                  {s.value}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Generate form */}
          <GenerateForm channel={platform} pendingCount={pending.length} onGenerated={onGenerated} />

          {/* Pending posts */}
          {pending.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Pending ({pending.length}/{PENDING_LIMIT})
                </h2>
                {pending.length >= PENDING_LIMIT && (
                  <span className="text-[10px] text-amber-400 font-medium">Queue full — publish to unlock</span>
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
            <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 py-10 text-center">
              <p className="text-sm text-slate-500">No posts yet — generate your first one above.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Summary view ───────────────────────────────────────────────────────────────

function SummaryView({ posts: initialPosts, businessName, settings: initialSettings }: {
  posts: SocialPost[]
  businessName: string
  settings: Record<string, PlatformCfg>
}) {
  const [posts, setPosts]       = useState<SocialPost[]>(initialPosts)
  const [settings, setSettings] = useState(initialSettings)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult]   = useState<{ generated: number; results: { channel: string; status: string; reason?: string }[] } | null>(null)

  async function generateAll() {
    setGenerating(true); setGenResult(null)
    try {
      const res = await fetch('/api/social/posts/generate-all', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setGenResult(data)
        const r = await fetch('/api/social/posts')
        if (r.ok) { const d = await r.json(); setPosts(d.posts ?? []) }
      }
    } finally { setGenerating(false) }
  }

  async function togglePlatform(ch: SocialChannel, enabled: boolean) {
    await fetch('/api/social/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: ch, enabled }),
    })
    setSettings(prev => ({ ...prev, [ch]: { ...(prev[ch] ?? {}), social_enabled: enabled } }))
  }

  const pendingTotal   = posts.filter(p => p.status === 'pending_approval').length
  const publishedTotal = posts.filter(p => p.status === 'published').length
  const enabledCount   = CHANNELS.filter(ch => settings[ch]?.social_enabled).length

  return (
    <div className="flex flex-col gap-5 pb-8">
      <AIPageContext
        title="Social Marketing Autopilot"
        subtitle={`Generates daily posts across all enabled platforms for ${businessName}. Posts sit in a pending queue until you publish them manually and enter the URL.`}
        automations={[
          'Generates one post per enabled platform daily',
          'Enforces a 3-post pending limit per platform',
          'YouTube produces script outlines for future AI video generation',
          'Saves all content with published URLs for history',
        ]}
        manual={['Enable platforms below', 'Post manually then enter the URL on each platform page']}
        accent="blue"
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Social Autopilot</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {enabledCount} platform{enabledCount !== 1 ? 's' : ''} enabled · {pendingTotal} pending · {publishedTotal} published
          </p>
        </div>
        <button onClick={generateAll} disabled={generating || enabledCount === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 transition-colors flex-shrink-0">
          {generating && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {generating ? 'Generating…' : "✨ Generate Today's Posts"}
        </button>
      </div>

      {/* Generate result */}
      {genResult && (
        <div className="rounded-2xl border border-slate-700/40 bg-slate-800/30 p-4">
          <p className="text-sm font-semibold text-slate-200 mb-3">
            {genResult.generated} post{genResult.generated !== 1 ? 's' : ''} generated
          </p>
          <div className="flex flex-col gap-2">
            {genResult.results.map(r => {
              const m = META[r.channel as SocialChannel]
              return (
                <div key={r.channel} className="flex items-center gap-3 text-xs">
                  {m && (
                    <div className={`w-5 h-5 rounded-md ${m.color} flex items-center justify-center flex-shrink-0`}>
                      <m.Icon className={`w-2.5 h-2.5 ${m.textColor}`} />
                    </div>
                  )}
                  <span className="text-slate-400 w-24">{m?.label ?? r.channel}</span>
                  <span className={r.status === 'generated' ? 'text-blue-400' : 'text-slate-600'}>
                    {r.status === 'generated' ? '✓ Generated' : `Skipped — ${r.reason}`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Platform cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {CHANNELS.map(ch => {
          const meta      = META[ch]
          const enabled   = settings[ch]?.social_enabled ?? false
          const chPending = posts.filter(p => p.channel === ch && p.status === 'pending_approval').length
          const chPub     = posts.filter(p => p.channel === ch && p.status === 'published').length
          const atLimit   = chPending >= PENDING_LIMIT

          return (
            <div key={ch} className={`rounded-2xl border ${enabled ? meta.borderColor : 'border-slate-800/50'} ${enabled ? 'bg-slate-800/40' : 'bg-slate-900/20'} p-4 flex flex-col gap-3 transition-all`}>
              {/* Platform header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl ${meta.color} flex items-center justify-center`}>
                    <meta.Icon className={`w-4 h-4 ${enabled ? meta.textColor : 'text-slate-600'}`} />
                  </div>
                  <span className={`text-sm font-semibold ${enabled ? 'text-slate-200' : 'text-slate-500'}`}>{meta.label}</span>
                </div>
                <button
                  onClick={() => togglePlatform(ch, !enabled)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-slate-700'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${enabled ? 'left-4' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Stats */}
              {enabled && (
                <div className="flex gap-4">
                  <div>
                    <p className={`text-lg font-bold ${atLimit ? 'text-amber-400' : 'text-slate-100'}`}>{chPending}</p>
                    <p className="text-[10px] text-slate-600 uppercase tracking-wider">Pending</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-100">{chPub}</p>
                    <p className="text-[10px] text-slate-600 uppercase tracking-wider">Published</p>
                  </div>
                </div>
              )}

              {atLimit && enabled && (
                <p className="text-[10px] text-amber-400 font-medium">Queue full — publish first</p>
              )}

              <a href={`/social/${ch}`}
                className={`text-xs font-semibold transition-colors ${enabled ? 'text-blue-400 hover:text-blue-300' : 'text-slate-600 hover:text-slate-400'}`}>
                {enabled ? 'Manage →' : 'Enable →'}
              </a>
            </div>
          )
        })}
      </div>

      {/* Pending queue */}
      {pendingTotal > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Pending Posts — Needs Manual Publishing ({pendingTotal})
          </h2>
          <div className="flex flex-col gap-2.5">
            {posts.filter(p => p.status === 'pending_approval').slice(0, 8).map(p => {
              const m = META[p.channel]
              return (
                <div key={p.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${m.borderColor} bg-slate-800/30`}>
                  <div className={`w-7 h-7 rounded-lg ${m.color} flex items-center justify-center flex-shrink-0`}>
                    <m.Icon className={`w-3.5 h-3.5 ${m.textColor}`} />
                  </div>
                  <p className="flex-1 text-xs text-slate-400 truncate">{p.content.slice(0, 90)}…</p>
                  <a href={`/social/${p.channel}`}
                    className="flex-shrink-0 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                    Publish →
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {enabledCount === 0 && (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 py-10 text-center">
          <p className="text-sm font-semibold text-slate-400">No platforms enabled yet</p>
          <p className="text-xs text-slate-600 mt-1">Toggle the platforms above to start generating daily posts.</p>
        </div>
      )}
    </div>
  )
}

// ── Root export ────────────────────────────────────────────────────────────────

export default function SocialClient({ platform, posts, businessName, industry, settings: initialSettings }: SocialClientProps) {
  const [settings, setSettings] = useState(initialSettings)

  function onToggleEnabled(ch: SocialChannel, val: boolean) {
    setSettings(prev => ({ ...prev, [ch]: { ...(prev[ch] ?? {}), social_enabled: val } }))
  }

  if (platform === 'summary') {
    return <SummaryView posts={posts} businessName={businessName} settings={settings} />
  }

  const ch      = platform as SocialChannel
  const enabled = settings[ch]?.social_enabled ?? false

  return (
    <PlatformView
      platform={ch} posts={posts}
      businessName={businessName} industry={industry}
      enabled={enabled}
      onToggleEnabled={val => onToggleEnabled(ch, val)}
    />
  )
}
