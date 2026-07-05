'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface RedditTrend {
  title: string
  subreddit: string
  reddit_url: string
  score: number
  num_comments: number
  content_angle: string
  why: string
}

export default function RedditTrends() {
  const router = useRouter()
  const [trends, setTrends] = useState<RedditTrend[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [loaded, setLoaded] = useState(false)

  const fetchTrends = async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/reddit/trends')
      const data = await res.json()
      setTrends(data.trends ?? [])
      if (data.message) setMessage(data.message)
    } catch {
      setMessage('Failed to load trends. Try again.')
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }

  useEffect(() => {
    fetchTrends()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const createPost = (trend: RedditTrend) => {
    const params = new URLSearchParams({
      trend: trend.title,
      tip:   trend.content_angle,
    })
    router.push(`/content?${params}`)
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">🔥</span>
          <div>
            <h3 className="text-white font-semibold text-sm">Trending on Reddit</h3>
            <p className="text-slate-500 text-xs">AI-suggested content angles from your industry</p>
          </div>
        </div>
        <button
          onClick={fetchTrends}
          disabled={loading}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs transition-colors disabled:opacity-50"
        >
          {loading ? (
            <span className="w-3 h-3 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M8 16H3v5"/>
            </svg>
          )}
          Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && trends.length === 0 && (
        <div className="p-8 text-center">
          <div className="w-6 h-6 border-2 border-blue-600/40 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Analyzing Reddit trends with AI…</p>
        </div>
      )}

      {/* Empty / message */}
      {!loading && loaded && trends.length === 0 && (
        <div className="p-6 text-center">
          <p className="text-2xl mb-2">📭</p>
          <p className="text-slate-400 text-sm">{message || 'No trends found'}</p>
          {message?.includes('subreddits') && (
            <a href="/settings/integrations#reddit" className="text-blue-400 hover:underline text-xs mt-2 inline-block">
              Add subreddits in Integrations →
            </a>
          )}
        </div>
      )}

      {/* Trends list */}
      {trends.length > 0 && (
        <div className="divide-y divide-slate-800">
          {trends.map((trend, i) => (
            <div key={i} className="p-4 hover:bg-slate-800/30 transition-colors group">
              <div className="flex items-start gap-3">
                {/* Rank */}
                <span className="text-slate-600 text-xs font-mono w-4 shrink-0 mt-0.5">{i + 1}</span>

                <div className="flex-1 min-w-0">
                  {/* Subreddit + stats */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <a
                      href={trend.reddit_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-400 text-xs font-medium hover:underline"
                    >
                      r/{trend.subreddit}
                    </a>
                    <span className="text-slate-600 text-xs">·</span>
                    <span className="text-slate-500 text-xs">▲ {trend.score.toLocaleString()}</span>
                    <span className="text-slate-600 text-xs">·</span>
                    <span className="text-slate-500 text-xs">💬 {trend.num_comments}</span>
                  </div>

                  {/* Reddit post title */}
                  <p className="text-slate-300 text-sm leading-snug mb-2 line-clamp-2">{trend.title}</p>

                  {/* AI content angle */}
                  <div className="bg-blue-950/30 border border-blue-800/30 rounded-lg px-3 py-2 mb-2.5">
                    <p className="text-blue-300 text-xs font-medium mb-0.5">✨ Content angle</p>
                    <p className="text-blue-200 text-xs leading-relaxed">{trend.content_angle}</p>
                  </div>

                  {/* Why */}
                  <p className="text-slate-600 text-xs mb-3">{trend.why}</p>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => createPost(trend)}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      ✏️ Create Post
                    </button>
                    <a
                      href={trend.reddit_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
                    >
                      View thread →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
