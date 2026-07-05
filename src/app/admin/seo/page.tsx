'use client'

import { useState } from 'react'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://coovex.com'

const SEO_FILES = [
  {
    name: 'llms.txt',
    url: '/llms.txt',
    purpose: 'AI crawler instructions — helps ChatGPT, Perplexity, Claude understand CooVex',
    standard: 'llmstxt.org',
    priority: 'critical',
  },
  {
    name: 'robots.txt',
    url: '/robots.txt',
    purpose: 'Search + AI bot crawling rules — explicitly allows GPTBot, ClaudeBot, PerplexityBot',
    standard: 'RFC 9309',
    priority: 'critical',
  },
  {
    name: 'sitemap.xml',
    url: '/sitemap.xml',
    purpose: 'All public pages with priority + change frequency for search indexing',
    standard: 'Sitemaps Protocol',
    priority: 'high',
  },
]

const META_CHECKS = [
  { label: 'Title tag',           status: 'ok', value: 'CooVex — AI Business Agent' },
  { label: 'Meta description',    status: 'ok', value: '160-char optimized description in layout.tsx' },
  { label: 'Open Graph tags',     status: 'ok', value: 'og:title, og:description, og:image, og:type' },
  { label: 'Twitter/X Card',      status: 'ok', value: 'summary_large_image card with og-image.png' },
  { label: 'Canonical URL',       status: 'ok', value: 'alternates.canonical set in root metadata' },
  { label: 'JSON-LD (Organization)', status: 'ok', value: 'Schema.org Organization in <head>' },
  { label: 'JSON-LD (SoftwareApplication)', status: 'ok', value: 'Schema.org SoftwareApplication in <head>' },
  { label: 'JSON-LD (WebSite)',   status: 'ok', value: 'Schema.org WebSite + SearchAction in <head>' },
  { label: 'llms.txt link in head', status: 'ok', value: '<link rel="alternate" type="text/plain" href="/llms.txt">' },
  { label: 'OG image (og-image.png)', status: 'warn', value: 'Upload og-image.png (1200×630) to /public/' },
]

export default function AdminSeoPage() {
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState('')

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshMsg('')
    try {
      const res = await fetch('/api/admin/seo/refresh', { method: 'POST' })
      const data = await res.json()
      setRefreshMsg(data.ok ? 'Cache purged — all SEO routes will regenerate on next request.' : (data.error ?? 'Failed'))
    } catch {
      setRefreshMsg('Request failed')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">SEO & GEO Optimizer</h1>
          <p className="text-slate-400 text-sm mt-1">AI discoverability files, structured data, and meta tags</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          {refreshing ? 'Refreshing...' : '🔄 Purge Cache & Refresh'}
        </button>
      </div>

      {refreshMsg && (
        <div className="mb-6 bg-emerald-900/40 border border-emerald-700 text-emerald-300 text-sm px-4 py-3 rounded-lg">
          ✓ {refreshMsg}
        </div>
      )}

      {/* AI Discoverability Files */}
      <section className="mb-10">
        <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-widest mb-4">AI Discoverability Files</h2>
        <div className="space-y-3">
          {SEO_FILES.map(f => (
            <div key={f.name} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-start gap-5">
              <div className="mt-0.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${f.priority === 'critical' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-white font-mono font-semibold">{f.name}</span>
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{f.standard}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${f.priority === 'critical' ? 'bg-red-900/60 text-red-400' : 'bg-blue-900/60 text-blue-400'}`}>
                    {f.priority.toUpperCase()}
                  </span>
                </div>
                <p className="text-slate-400 text-sm">{f.purpose}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 border border-slate-700 hover:border-blue-500 px-3 py-1.5 rounded-lg transition-colors"
                >
                  View ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Meta Tags Checklist */}
      <section className="mb-10">
        <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-widest mb-4">Meta Tags & Structured Data</h2>
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {META_CHECKS.map((c, i) => (
            <div key={c.label} className={`flex items-start gap-4 px-5 py-4 ${i < META_CHECKS.length - 1 ? 'border-b border-slate-800' : ''}`}>
              <span className={`mt-0.5 text-base ${c.status === 'ok' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {c.status === 'ok' ? '✓' : '⚠'}
              </span>
              <div>
                <div className="text-white text-sm font-medium">{c.label}</div>
                <div className="text-slate-400 text-xs mt-0.5">{c.value}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* AI Search Channels */}
      <section className="mb-10">
        <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-widest mb-4">AI Search Engine Coverage</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: 'ChatGPT / OpenAI', bot: 'GPTBot',        allowed: true },
            { name: 'Claude / Anthropic', bot: 'ClaudeBot',   allowed: true },
            { name: 'Perplexity',        bot: 'PerplexityBot', allowed: true },
            { name: 'Google Gemini',     bot: 'Google-Extended', allowed: true },
            { name: 'Bing / Copilot',   bot: 'Bingbot',       allowed: true },
            { name: 'You.com',           bot: 'YouBot',        allowed: true },
            { name: 'Amazon',            bot: 'Amazonbot',     allowed: true },
            { name: 'Apple',             bot: 'Applebot',      allowed: true },
          ].map(c => (
            <div key={c.name} className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-center">
              <div className={`text-2xl mb-1 ${c.allowed ? 'text-emerald-400' : 'text-red-400'}`}>
                {c.allowed ? '✓' : '✗'}
              </div>
              <div className="text-white text-sm font-medium">{c.name}</div>
              <div className="text-slate-500 text-xs mt-0.5 font-mono">{c.bot}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-widest mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <a
            href="https://search.google.com/search-console"
            target="_blank" rel="noopener noreferrer"
            className="bg-slate-900 border border-slate-800 hover:border-blue-600 rounded-xl p-5 transition-colors group"
          >
            <div className="text-xl mb-2">🔍</div>
            <div className="text-white font-semibold text-sm group-hover:text-blue-400 transition-colors">Google Search Console</div>
            <div className="text-slate-500 text-xs mt-1">Submit sitemap, monitor indexing</div>
          </a>
          <a
            href="https://www.bing.com/webmasters"
            target="_blank" rel="noopener noreferrer"
            className="bg-slate-900 border border-slate-800 hover:border-blue-600 rounded-xl p-5 transition-colors group"
          >
            <div className="text-xl mb-2">🪟</div>
            <div className="text-white font-semibold text-sm group-hover:text-blue-400 transition-colors">Bing Webmaster Tools</div>
            <div className="text-slate-500 text-xs mt-1">Copilot / Bing indexing</div>
          </a>
          <a
            href="https://validator.schema.org/"
            target="_blank" rel="noopener noreferrer"
            className="bg-slate-900 border border-slate-800 hover:border-blue-600 rounded-xl p-5 transition-colors group"
          >
            <div className="text-xl mb-2">🧪</div>
            <div className="text-white font-semibold text-sm group-hover:text-blue-400 transition-colors">Schema.org Validator</div>
            <div className="text-slate-500 text-xs mt-1">Test JSON-LD structured data</div>
          </a>
        </div>
      </section>
    </div>
  )
}
