'use client'

import { useState, useEffect } from 'react'

interface Product {
  id: string
  name: string
  type: 'product' | 'service'
  category: string | null
  tagline: string | null
  description: string | null
  target_audience: string | null
  status: string
}

interface RedditPost {
  id: string
  title: string
  selftext: string
  subreddit: string
  author: string
  score: number
  num_comments: number
  url: string
  quality: number
  created_utc: number
}

function timeAgo(utc: number) {
  const h = Math.floor((Date.now() / 1000 - utc) / 3600)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function PostCard({ post, product }: { post: RedditPost; product: Product }) {
  const [comment, setComment]     = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied]       = useState(false)
  const [open, setOpen]           = useState(false)

  async function generateComment() {
    setGenerating(true)
    setComment('')
    setOpen(true)
    try {
      const res = await fetch('/api/reddit/generate-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_title:          post.title,
          post_body:           post.selftext ?? '',
          subreddit:           post.subreddit,
          product_name:        product.name,
          product_tagline:     product.tagline,
          product_description: product.description,
          target_audience:     product.target_audience,
          category:            product.category,
        }),
      })
      const data = await res.json()
      setComment(data.comment ?? '')
    } catch {
      setComment('Failed to generate comment. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(comment)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const qualityColor =
    post.quality >= 9 ? 'text-red-400 bg-red-900/30 border-red-700/30' :
    post.quality >= 6 ? 'text-slate-500 bg-slate-900/30 border-slate-700/30' :
                        'text-slate-400 bg-slate-800 border-slate-700'
  const qualityLabel = post.quality >= 9 ? 'Hot' : post.quality >= 6 ? 'Warm' : 'Cold'

  return (
    <div className="border-b border-slate-800 last:border-0">
      {/* Post row */}
      <div className="px-5 py-4 hover:bg-slate-800/20 transition-colors">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Meta */}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-slate-500 text-xs font-medium bg-slate-950/40 border border-slate-700/30 px-2 py-0.5 rounded-full">
                r/{post.subreddit}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${qualityColor}`}>
                {qualityLabel}
              </span>
              <span className="text-slate-600 text-xs">▲ {post.score}</span>
              <span className="text-slate-600 text-xs">💬 {post.num_comments}</span>
              <span className="text-slate-700 text-xs">{timeAgo(post.created_utc)}</span>
            </div>

            {/* Title */}
            <p className="text-slate-100 text-sm font-medium leading-snug mb-1">
              {post.title}
            </p>
            {post.selftext && (
              <p className="text-slate-500 text-xs line-clamp-2 mb-1">{post.selftext}</p>
            )}
            <p className="text-slate-700 text-xs">u/{post.author}</p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <button
              onClick={generateComment}
              disabled={generating}
              className="flex items-center gap-1.5 bg-blue-600/20 hover:bg-blue-600/40 disabled:opacity-50 border border-slate-700/40 text-blue-300 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              {generating ? (
                <span className="w-3 h-3 border-2 border-blue-400/30 border-t-violet-300 rounded-full animate-spin" />
              ) : '✨'}
              {generating ? 'Generating…' : 'AI Comment'}
            </button>
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-blue-600/15 hover:bg-blue-600/30 border border-slate-700/30 text-slate-400 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              Open Reddit
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M7 17L17 7M7 7h10v10"/>
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Generated comment panel */}
      {open && (
        <div className="mx-5 mb-4 bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-800/80">
            <p className="text-slate-300 text-xs font-medium">✨ AI-Generated Comment</p>
            <div className="flex items-center gap-2">
              {comment && !generating && (
                <button
                  onClick={copy}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-lg transition-colors ${
                    copied
                      ? 'bg-blue-600/30 border border-blue-600/40 text-blue-300'
                      : 'bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300'
                  }`}
                >
                  {copied ? '✓ Copied!' : '⎘ Copy'}
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-slate-600 hover:text-slate-400 text-sm transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-4">
            {generating ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-3 bg-slate-700 rounded w-full" />
                <div className="h-3 bg-slate-700 rounded w-5/6" />
                <div className="h-3 bg-slate-700 rounded w-4/6" />
              </div>
            ) : comment ? (
              <>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={4}
                  className="w-full bg-transparent text-slate-200 text-sm leading-relaxed resize-none focus:outline-none"
                />
                <div className="mt-3 pt-3 border-t border-slate-700 flex items-center justify-between">
                  <p className="text-slate-600 text-xs">
                    Edit if needed → <strong className="text-slate-500">Copy</strong> → Open Reddit → Paste as reply
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={generateComment}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      ↻ Regenerate
                    </button>
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={copy}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Copy & Open Reddit →
                    </a>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

export function RedditLeadsTab() {
  const [products, setProducts]     = useState<Product[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [posts, setPosts]           = useState<RedditPost[]>([])
  const [loading, setLoading]       = useState(false)
  const [searched, setSearched]     = useState(false)

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(d => {
        const active = (d.products ?? []).filter((p: Product) => p.status !== 'discontinued')
        setProducts(active)
        if (active.length > 0) setSelectedId(active[0].id)
      })
      .catch(() => {/* ignore */})
  }, [])

  async function findPosts() {
    if (!selectedId) return
    setPosts([])
    setLoading(true)
    setSearched(false)
    try {
      const res  = await fetch('/api/reddit/product-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: selectedId }),
      })
      const data = await res.json()
      setPosts(data.leads ?? [])
    } catch {
      setPosts([])
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }

  const selectedProduct = products.find(p => p.id === selectedId)

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="bg-slate-950/20 border border-slate-700/30 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl flex-shrink-0">🎯</span>
        <div>
          <p className="text-slate-300 text-sm font-medium">Reddit Lead Finder + AI Comment</p>
          <p className="text-slate-400 text-xs mt-0.5">
            Select a product → find relevant Reddit posts → generate an AI comment to reply with →
            copy it → paste on Reddit. Natural engagement that subtly promotes your service.
          </p>
        </div>
      </div>

      {/* Product selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <p className="text-xs font-medium text-slate-400 mb-3">Select your product / service</p>

        {products.length === 0 ? (
          <div className="text-slate-500 text-sm py-4 text-center">
            No products found.{' '}
            <a href="/products" className="text-blue-400 hover:underline">Add your first product →</a>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
              {products.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedId(p.id); setSearched(false); setPosts([]) }}
                  className={`text-left px-4 py-3 rounded-xl border transition-all ${
                    selectedId === p.id
                      ? 'bg-blue-600/20 border-slate-500/50 text-white'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span>{p.type === 'service' ? '⚙️' : '🛍️'}</span>
                    <span className="font-medium text-sm truncate">{p.name}</span>
                  </div>
                  {p.category && <p className="text-slate-500 text-xs truncate">{p.category}</p>}
                  {p.target_audience && (
                    <p className="text-slate-600 text-xs truncate mt-0.5">🎯 {p.target_audience}</p>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <p className="flex-1 text-xs text-slate-500">
                {selectedProduct
                  ? <>Searching Reddit for: <span className="text-white font-medium">{selectedProduct.name}</span></>
                  : 'Select a product above'}
              </p>
              <button
                onClick={findPosts}
                disabled={loading || !selectedId}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
              >
                {loading ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Scanning Reddit…</>
                ) : '🔍 Find Reddit Posts'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {[1,2,3,4].map(i => (
            <div key={i} className="px-5 py-4 border-b border-slate-800 animate-pulse flex gap-4 last:border-0">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <div className="w-20 h-5 bg-slate-800 rounded-full" />
                  <div className="w-12 h-5 bg-slate-800 rounded-full" />
                </div>
                <div className="h-4 bg-slate-800 rounded w-5/6" />
                <div className="h-3 bg-slate-800 rounded w-3/6" />
              </div>
              <div className="w-28 h-8 bg-slate-800 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && searched && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {/* Results header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-800/40">
            <p className="text-slate-300 text-sm font-medium">
              {posts.length > 0
                ? `${posts.length} Reddit posts found for "${selectedProduct?.name}"`
                : `No posts found for "${selectedProduct?.name}"`}
            </p>
            <button
              onClick={findPosts}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M8 16H3v5"/>
              </svg>
              Refresh
            </button>
          </div>

          {posts.length === 0 ? (
            <div className="py-16 text-center px-6">
              <p className="text-3xl mb-3">🔍</p>
              <p className="text-slate-300 font-medium text-sm mb-1">No matching posts found</p>
              <p className="text-slate-500 text-xs max-w-sm mx-auto">
                Try again in a few hours, or add more subreddits in{' '}
                <a href="/settings/integrations" className="text-slate-500 hover:underline">
                  Integrations → Reddit
                </a>
              </p>
            </div>
          ) : (
            <>
              {selectedProduct && posts.map(post => (
                <PostCard key={post.id} post={post} product={selectedProduct} />
              ))}
              <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/50">
                <p className="text-slate-600 text-xs">
                  💡 Click <strong className="text-slate-500">AI Comment</strong> to generate a helpful reply →
                  <strong className="text-slate-500"> Copy & Open Reddit</strong> to paste it in the thread
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Initial state */}
      {!loading && !searched && products.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-14 text-center">
          <p className="text-4xl mb-3">🔴</p>
          <p className="text-slate-300 font-medium text-sm mb-1">
            Select a product and click &ldquo;Find Reddit Posts&rdquo;
          </p>
          <p className="text-slate-600 text-xs">
            We&apos;ll find relevant Reddit conversations where you can add value
          </p>
        </div>
      )}
    </div>
  )
}
