'use client'

import { useState } from 'react'
import Link from 'next/link'

const PLATFORMS = ['LinkedIn', 'Instagram', 'Facebook', 'Twitter/X']
const INDUSTRIES = [
  'SaaS / Software', 'E-commerce / Retail', 'Consulting / Advisory',
  'Marketing / Agency', 'Healthcare', 'Real Estate',
  'Restaurant / Food', 'Education', 'Finance / Fintech', 'Other',
]
const TONES = ['Professional', 'Conversational', 'Inspiring', 'Educational', 'Humorous']

interface Post {
  content: string
  type: string
  platform: string
}

export default function ContentGeneratorPage() {
  const [form, setForm] = useState({
    businessName: '',
    industry: '',
    topic: '',
    platform: 'LinkedIn',
    tone: 'Professional',
  })
  const [loading, setLoading] = useState(false)
  const [posts, setPosts] = useState<Post[]>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<number | null>(null)
  const [emailCapture, setEmailCapture] = useState(false)
  const [email, setEmail] = useState('')
  const [emailDone, setEmailDone] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function generate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.businessName || !form.industry || !form.topic) {
      setError('Please fill in all required fields')
      return
    }

    setError('')
    setLoading(true)
    setPosts([])

    try {
      const res = await fetch('/api/tools/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      setPosts(data.posts)
      // Show email capture after generating
      setTimeout(() => setEmailCapture(true), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return

    await fetch('/api/tools/capture-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        tool_used: 'content-generator',
        result_json: { posts: posts.length, form },
      }),
    })

    setEmailDone(true)
    setEmailCapture(false)
  }

  async function copyPost(text: string, idx: number) {
    await navigator.clipboard.writeText(text)
    setCopied(idx)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-violet-500/10 text-violet-300 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
          ✍️ AI Content Generator — Free
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Generate 5 posts in seconds</h1>
        <p className="text-slate-400 text-sm">Tailored to your business, industry, and platform. No signup required.</p>
      </div>

      <form onSubmit={generate} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 mb-8">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Business Name <span className="text-violet-400">*</span>
            </label>
            <input
              type="text"
              value={form.businessName}
              onChange={e => set('businessName', e.target.value)}
              placeholder="e.g. Acme Digital"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Industry <span className="text-violet-400">*</span>
            </label>
            <select
              value={form.industry}
              onChange={e => set('industry', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors appearance-none"
            >
              <option value="">Select...</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Post Topic / Focus <span className="text-violet-400">*</span>
          </label>
          <input
            type="text"
            value={form.topic}
            onChange={e => set('topic', e.target.value)}
            placeholder="e.g. AI automation for small businesses, client success story, new product launch..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Platform</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set('platform', p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    form.platform === p
                      ? 'bg-violet-600 border-violet-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Tone</label>
            <select
              value={form.tone}
              onChange={e => set('tone', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors appearance-none"
            >
              {TONES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating 5 posts...
            </>
          ) : (
            <>Generate 5 Posts Free →</>
          )}
        </button>
      </form>

      {/* Email capture */}
      {emailCapture && !emailDone && (
        <div className="mb-6 bg-violet-950/40 border border-violet-800/30 rounded-xl p-5">
          <p className="text-white font-medium text-sm mb-1">Want 30 posts per month on autopilot?</p>
          <p className="text-slate-400 text-xs mb-4">Enter your email to get a free trial + we&apos;ll send you 30 more posts.</p>
          <form onSubmit={submitEmail} className="flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500 transition-colors"
            />
            <button
              type="submit"
              className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              Get More Posts
            </button>
          </form>
        </div>
      )}

      {emailDone && (
        <div className="mb-6 bg-emerald-950/40 border border-emerald-800/30 rounded-xl p-4 text-center">
          <p className="text-emerald-300 text-sm font-medium">✅ Done! Check your email for more details.</p>
        </div>
      )}

      {/* Generated posts */}
      {posts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold">Your Generated Posts</h2>
            <span className="text-slate-500 text-xs">{form.platform} · {form.tone}</span>
          </div>

          {posts.map((post, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-violet-400 text-xs font-medium bg-violet-500/10 px-2 py-1 rounded">
                  {post.type || `Post ${i + 1}`}
                </span>
                <button
                  onClick={() => copyPost(post.content, i)}
                  className="text-slate-500 hover:text-white text-xs transition-colors flex items-center gap-1"
                >
                  {copied === i ? (
                    <><span>✓</span> Copied!</>
                  ) : (
                    <><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> Copy</>
                  )}
                </button>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
            </div>
          ))}

          <div className="text-center pt-4">
            <p className="text-slate-500 text-sm mb-3">Want posts like this every week — automatically?</p>
            <Link
              href={email ? `/signup?email=${encodeURIComponent(email)}` : '/signup'}
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
            >
              Start 14-Day Free Trial →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
