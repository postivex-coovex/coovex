'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { RefreshCw, TrendingUp, Eye, Heart, MessageCircle, Share2, BarChart3 } from 'lucide-react'

interface Post {
  id: string
  title: string | null
  content: string | null
  channel: string
  status: string
  created_at: string
  views: number
  likes: number
  comments: number
  shares: number
  ctr: number
}

interface ChannelStat {
  channel: string
  posts: number
  total_views: number
  total_likes: number
}

const CHANNEL_ICONS: Record<string, string> = {
  linkedin:  '💼',
  instagram: '📸',
  facebook:  '📘',
  twitter:   '🐦',
  tiktok:    '🎵',
  wordpress: '📝',
}

const CHANNEL_COLORS: Record<string, string> = {
  linkedin:  'bg-blue-900/30 text-blue-300',
  instagram: 'bg-pink-900/30 text-pink-300',
  facebook:  'bg-indigo-900/30 text-indigo-300',
  tiktok:    'bg-slate-700/50 text-slate-300',
  wordpress: 'bg-orange-900/30 text-orange-300',
  twitter:   'bg-sky-900/30 text-sky-300',
}

const STATUS_COLOR: Record<string, string> = {
  published:        'text-emerald-400 bg-emerald-950/40 border-emerald-800/30',
  scheduled:        'text-blue-400 bg-blue-950/40 border-blue-800/30',
  draft:            'text-slate-500 bg-slate-800 border-slate-700',
  pending_approval: 'text-amber-400 bg-amber-950/40 border-amber-800/30',
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export default function ContentPerformancePage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [byChannel, setByChannel] = useState<ChannelStat[]>([])
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)
  const [sortBy, setSortBy] = useState<'views' | 'likes' | 'comments' | 'ctr'>('views')

  function load() {
    setLoading(true)
    fetch('/api/posts/performance')
      .then(r => r.json())
      .then(d => {
        setPosts(d.posts ?? [])
        setByChannel(d.by_channel ?? [])
        setEmpty(!!d.empty)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const sorted = [...posts].sort((a, b) => b[sortBy] - a[sortBy])
  const published = posts.filter(p => p.status === 'published')
  const totalPosts = posts.length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Content Performance</h1>
          </div>
          <p className="text-slate-400 text-sm">Engagement metrics across your published posts</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/content" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">← Content</Link>
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Connect banner */}
      <div className="mb-6 bg-violet-950/20 border border-violet-800/30 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-violet-400 text-lg flex-shrink-0">🔌</span>
        <p className="text-violet-300/80 text-sm flex-1">
          <span className="font-medium text-violet-300">Connect your social accounts</span> to automatically sync real engagement metrics (views, likes, comments, shares).
        </p>
        <Link
          href="/settings/integrations#social"
          className="flex-shrink-0 text-xs px-3 py-1.5 bg-violet-700/30 hover:bg-violet-700/50 border border-violet-600/40 text-violet-300 rounded-lg transition-colors whitespace-nowrap"
        >
          Connect accounts →
        </Link>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Published Posts', value: String(published.length), icon: Eye,        color: 'text-blue-400' },
          { label: 'Total Posts',     value: String(totalPosts),       icon: BarChart3,  color: 'text-violet-400' },
          { label: 'Total Views',     value: '—',                      icon: TrendingUp, color: 'text-emerald-400', note: 'Connect to see' },
          { label: 'Avg Engagement',  value: '—',                      icon: Heart,      color: 'text-rose-400',   note: 'Connect to see' },
        ].map(({ label, value, icon: Icon, color, note }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
            <Icon className={`w-6 h-6 ${color} mx-auto mb-3`} />
            <p className={`text-4xl font-bold ${color}`}>{value}</p>
            <p className="text-slate-400 text-sm mt-2">{label}</p>
            {note && <p className="text-slate-600 text-xs mt-0.5">{note}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {/* By channel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold text-lg mb-5">By Channel</h2>
          {byChannel.length === 0 ? (
            <p className="text-slate-500 text-sm">No posts yet</p>
          ) : (
            <div className="space-y-4">
              {byChannel.map(c => (
                <div key={c.channel} className="flex items-center justify-between">
                  <span className={`text-sm px-3 py-1 rounded-full border ${CHANNEL_COLORS[c.channel] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    {CHANNEL_ICONS[c.channel] ?? '📱'} {c.channel}
                  </span>
                  <span className="text-slate-300 text-sm font-semibold">{c.posts} post{c.posts !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top post placeholder */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold text-lg mb-4">Top Performing Post</h2>
          {published.length === 0 ? (
            <p className="text-slate-500 text-sm">No published posts yet.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">{CHANNEL_ICONS[published[0].channel] ?? '📱'}</span>
                <div>
                  <p className="text-white font-medium leading-snug">
                    {published[0].title || published[0].content?.slice(0, 80) || 'Untitled'}
                  </p>
                  <p className="text-slate-500 text-sm capitalize mt-1">
                    {published[0].channel} · {new Date(published[0].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Views',    icon: Eye,           color: 'text-blue-400' },
                  { label: 'Likes',    icon: Heart,         color: 'text-rose-400' },
                  { label: 'Comments', icon: MessageCircle, color: 'text-violet-400' },
                  { label: 'Shares',   icon: Share2,        color: 'text-emerald-400' },
                ].map(({ label, icon: Icon, color }) => (
                  <div key={label} className="bg-slate-800/50 rounded-xl p-4 text-center">
                    <Icon className={`w-5 h-5 ${color} mx-auto mb-2`} />
                    <p className={`text-xl font-bold ${color}`}>—</p>
                    <p className="text-slate-500 text-sm mt-1">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-slate-600 text-sm">Connect social accounts to sync real engagement data</p>
            </div>
          )}
        </div>
      </div>

      {/* Posts table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">All Posts</h2>
          <div className="flex items-center gap-1 text-sm text-slate-500">
            Sort by:
            {(['views', 'likes', 'comments', 'ctr'] as const).map(k => (
              <button
                key={k}
                onClick={() => setSortBy(k)}
                className={`px-3 py-1 rounded transition-colors capitalize ${sortBy === k ? 'text-violet-400 bg-violet-950/40' : 'hover:text-slate-300'}`}
              >
                {k === 'ctr' ? 'CTR' : k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-24 text-slate-500 text-sm">Loading…</div>
        ) : empty || sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600">
            <div className="text-5xl mb-4">✍️</div>
            <p className="text-slate-300 font-semibold text-lg mb-2">No posts yet</p>
            <p className="text-slate-500 text-sm mb-6">Create content and it will appear here with performance metrics</p>
            <Link href="/content" className="text-violet-400 hover:text-violet-300 text-sm transition-colors">Go to Content Calendar →</Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {sorted.map(post => (
              <div key={post.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-800/20 transition-colors">
                <span className="text-xl flex-shrink-0">{CHANNEL_ICONS[post.channel] ?? '📱'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 truncate">{post.title || post.content?.slice(0, 70) || 'Untitled'}</p>
                  <p className="text-slate-500 text-sm capitalize mt-0.5">
                    {post.channel} · {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border flex-shrink-0 ${STATUS_COLOR[post.status] ?? 'text-slate-500 bg-slate-800 border-slate-700'}`}>
                  {post.status === 'pending_approval' ? 'Pending' : post.status}
                </span>
                <div className="flex items-center gap-5 text-sm flex-shrink-0 text-slate-600">
                  <span className="flex items-center gap-1.5"><Eye className="w-4 h-4" />—</span>
                  <span className="flex items-center gap-1.5"><Heart className="w-4 h-4" />—</span>
                  <span className="flex items-center gap-1.5"><MessageCircle className="w-4 h-4" />—</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-slate-700 text-xs text-center mt-4">
        Real engagement data syncs automatically once you connect LinkedIn, Facebook, or Instagram in{' '}
        <Link href="/settings/integrations#social" className="text-slate-500 hover:text-slate-400 underline underline-offset-2">Settings → Integrations</Link>
      </p>
    </div>
  )
}
