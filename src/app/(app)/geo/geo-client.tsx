'use client'

import { useState, useEffect, Component, type ReactNode } from 'react'
import { CheckCircle2, XCircle, RefreshCw, Copy, Download, ChevronDown, ChevronUp, Globe2, Brain, Sparkles, AlertCircle } from 'lucide-react'
import { checkCredits } from '@/lib/client-credits'
import { LiveVisibilityCheck } from '@/components/geo/live-visibility-check'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeoCheck {
  llms_txt: boolean; robots_txt: boolean; sitemap_xml: boolean
  structured_data: boolean; open_graph: boolean; canonical_url: boolean
  meta_description: boolean; twitter_card: boolean; https: boolean
  ai_discoverability: 'high' | 'medium' | 'low'
  geo_score: number; missing_geo: string[]
  ai_tasks: { title: string; desc: string; priority: 'critical' | 'high' | 'medium' }[]
  robots_ai_allowed?: boolean
  llms_txt_quality?: 'good' | 'basic' | 'missing'
  faq_content?: boolean
}

interface GeoIntelligence {
  prompt_examples: {
    prompt: string
    ai: 'ChatGPT' | 'Perplexity' | 'Claude' | 'Gemini' | 'Any AI'
    category: 'discovery' | 'comparison' | 'how-to' | 'best-of' | 'brand'
    likelihood: 'high' | 'medium' | 'low'
  }[]
  topic_clusters: {
    topic: string
    subtopics: string[]
    coverage: 'strong' | 'weak' | 'missing'
    suggested_url?: string
  }[]
  content_gaps: {
    type: 'comparison' | 'faq' | 'case-study' | 'listicle' | 'how-to' | 'landing' | 'guide' | 'integration-guide' | 'use-case' | 'competitive-positioning' | 'brand-entity'
    suggestion: string
    impact: 'high' | 'medium' | 'low'
  }[]
  entity_score: number
  entity_notes: string
  ai_voice_summary: string
  generated_at: string
  actual_ai_visibility?: {
    checks: {
      query: string
      ai: string
      found: boolean
      response_snippet: string
      sources: string[]
      search_queries?: string[]
    }[]
    visibility_rate: number
    checked_at: string
  } | null
}

interface BusinessIntel {
  business_name?: string; description?: string; industry?: string
  services?: string[]; contact?: { email?: string; phone?: string }
}

interface GeoClientProps {
  geo: GeoCheck | null
  intel: BusinessIntel | null
  websiteUrl: string
  businessName: string
  lastScanned: string | null
  cachedIntelligence: GeoIntelligence | null
  generatedGaps?: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GEO_ITEMS = [
  { key: 'llms_txt',         label: 'llms.txt',         desc: 'AI model guide file',           weight: 'critical' },
  { key: 'structured_data',  label: 'JSON-LD',           desc: 'Structured data schema',        weight: 'critical' },
  { key: 'meta_description', label: 'Meta Description',  desc: 'Page summary for AI',           weight: 'high'     },
  { key: 'sitemap_xml',      label: 'sitemap.xml',       desc: 'Page index for crawlers',       weight: 'high'     },
  { key: 'robots_txt',       label: 'robots.txt',        desc: 'Crawler permission file',       weight: 'high'     },
  { key: 'open_graph',       label: 'Open Graph',        desc: 'Social/AI preview tags',        weight: 'medium'   },
  { key: 'https',            label: 'HTTPS',             desc: 'Secure connection',             weight: 'high'     },
  { key: 'canonical_url',    label: 'Canonical URL',     desc: 'Dedup prevention',              weight: 'medium'   },
  { key: 'twitter_card',     label: 'Twitter/X Card',    desc: 'Social card meta',              weight: 'low'      },
] as const

const VERIFIED_TASKS: {
  key: keyof GeoCheck
  title: string
  priority: 'critical' | 'high' | 'medium'
  howTo: string
  generatorTab?: boolean
}[] = [
  { key: 'llms_txt',         title: 'Create /llms.txt file',                   priority: 'critical', generatorTab: true,
    howTo: 'Use the Generators tab to create your llms.txt file, then upload it to your website root so AI models (Perplexity, ChatGPT, Gemini, Claude) can find and index your business.' },
  { key: 'structured_data',  title: 'Add JSON-LD structured data',             priority: 'critical', generatorTab: true,
    howTo: "Use the Generators tab to generate an Organization JSON-LD schema, then paste the <script> block into your website's <head> section." },
  { key: 'meta_description', title: 'Add meta description to all pages',       priority: 'high',
    howTo: 'Add a <meta name="description" content="..."> tag in the <head> of each page. Keep it 150–160 characters and describe your page clearly.' },
  { key: 'open_graph',       title: 'Add Open Graph meta tags',                priority: 'high',
    howTo: 'Add og:title, og:description, og:image, and og:url tags to your <head>. These are used by AI search engines and social platforms.' },
  { key: 'sitemap_xml',      title: 'Add sitemap.xml',                         priority: 'high',
    howTo: 'Generate a sitemap.xml listing all your pages and submit it to Google Search Console. Most CMS platforms (WordPress, Webflow) can do this automatically.' },
  { key: 'robots_txt',       title: 'Update robots.txt to allow AI crawlers',  priority: 'medium', generatorTab: true,
    howTo: 'Use the Generators tab to copy the AI-friendly robots.txt template and upload it to your website root.' },
  { key: 'canonical_url',    title: 'Add canonical URL tags',                  priority: 'medium',
    howTo: 'Add <link rel="canonical" href="https://yourdomain.com/page"> to each page to prevent duplicate content issues with AI crawlers.' },
  { key: 'twitter_card',     title: 'Add Twitter/X card meta tags',            priority: 'medium',
    howTo: 'Add twitter:card, twitter:title, twitter:description, and twitter:image tags to your <head> for better social and AI preview rendering.' },
  { key: 'https',            title: 'Enable HTTPS on your website',            priority: 'critical',
    howTo: "Install an SSL certificate via your hosting provider (most offer free Let's Encrypt SSL). HTTPS is required for AI crawlers to trust your site." },
]

const STATIC_ROBOTS_TXT = `User-agent: *
Allow: /

# AI Crawlers — explicitly allowed
User-agent: GPTBot
Allow: /

User-agent: CCBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Bingbot
Allow: /

Sitemap: https://yourdomain.com/sitemap.xml`

const AI_ICONS: Record<string, string> = {
  ChatGPT: '🤖',
  Perplexity: '🔍',
  Claude: '🧠',
  Gemini: '✨',
  'Any AI': '🌐',
}

const CATEGORY_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  comparison: 'Comparison',
  'how-to': 'How-to',
  'best-of': 'Best-of list',
  brand: 'Brand query',
}

const CONTENT_TYPE_ICONS: Record<string, string> = {
  comparison: '⚖️',
  faq: '❓',
  'case-study': '📊',
  listicle: '📋',
  'how-to': '📖',
  landing: '🏠',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreRing({ score, size = 140, label = '/ 100' }: { score: number; size?: number; label?: string }) {
  const r = size * 0.39
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 65 ? '#2563eb' : score >= 35 ? '#64748b' : '#ef4444'
  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth="12" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{score}</span>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
    </div>
  )
}

function LikelihoodBadge({ v }: { v: string }) {
  const meta = ({
    high:   { cls: 'bg-blue-600/15 text-blue-400 border border-blue-500/25', label: 'High' },
    medium: { cls: 'bg-slate-600/15 text-slate-500 border border-slate-500/25',     label: 'Medium' },
    low:    { cls: 'bg-slate-700 text-slate-400 border border-slate-600',             label: 'Low' },
  } as Record<string, { cls: string; label: string }>)[v] ?? { cls: 'bg-slate-700 text-slate-400 border border-slate-600', label: v ?? '—' }
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
}

function ImpactBadge({ v }: { v: string }) {
  const meta = ({
    high:   { cls: 'bg-red-500/15 text-red-400 border border-red-500/25',          label: 'High impact' },
    medium: { cls: 'bg-slate-600/15 text-slate-500 border border-slate-500/25',     label: 'Medium impact' },
    low:    { cls: 'bg-slate-700 text-slate-400 border border-slate-600',            label: 'Low impact' },
  } as Record<string, { cls: string; label: string }>)[v] ?? { cls: 'bg-slate-700 text-slate-400 border border-slate-600', label: v ?? '—' }
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex-shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
    >
      <Copy className="w-3 h-3" />
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function VerifiedTaskCard({ task, verified, scanned, onGoToGenerators }: {
  task: typeof VERIFIED_TASKS[number]; verified: boolean; scanned: boolean; onGoToGenerators: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const priorityMeta = {
    critical: { label: 'Critical', cls: 'bg-red-500/20 text-red-400 border border-red-500/30' },
    high:     { label: 'High',     cls: 'bg-slate-600/20 text-slate-500 border border-slate-500/30' },
    medium:   { label: 'Medium',   cls: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  }
  const meta = priorityMeta[task.priority]
  return (
    <div className={`border rounded-xl transition-all ${!scanned ? 'bg-slate-900 border-slate-800' : verified ? 'bg-slate-950/20 border-slate-700/30' : 'bg-slate-900 border-slate-800'}`}>
      <div className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0 mt-0.5">
          {!scanned ? <div className="w-5 h-5 rounded-full border-2 border-slate-700 bg-slate-800" />
            : verified ? <CheckCircle2 className="w-5 h-5 text-blue-400" />
            : <XCircle className="w-5 h-5 text-red-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-medium ${verified ? 'text-blue-300' : 'text-white'}`}>{task.title}</p>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>{meta.label}</span>
            {scanned && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${verified ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'}`}>
                {verified ? '✓ Verified' : '✗ Not detected'}
              </span>
            )}
          </div>
          {expanded && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-slate-400 leading-relaxed">{task.howTo}</p>
              {!verified && task.generatorTab && (
                <button onClick={onGoToGenerators} className="text-xs text-blue-400 hover:text-blue-300 underline transition-colors">
                  → Open Generators tab to create this file
                </button>
              )}
              {!verified && <p className="text-xs text-slate-500 italic">Implement this, then click "Re-scan to Verify".</p>}
            </div>
          )}
        </div>
        <button onClick={() => setExpanded(e => !e)} className="text-slate-500 hover:text-slate-300 flex-shrink-0 transition-colors">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

function CodeBlock({ content, filename }: { content: string; filename: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <span className="text-xs font-mono text-slate-400">{filename}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">
            <Copy className="w-3 h-3" />{copied ? 'Copied!' : 'Copy'}
          </button>
          {filename !== 'robots.txt' && (
            <button onClick={() => { const b = new Blob([content], { type: 'text/plain' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = filename; a.click(); URL.revokeObjectURL(u) }}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">
              <Download className="w-3 h-3" />Download
            </button>
          )}
        </div>
      </div>
      <pre className="p-4 text-xs text-slate-300 font-mono overflow-x-auto bg-slate-950 max-h-80 overflow-y-auto whitespace-pre-wrap">{content}</pre>
    </div>
  )
}

// ─── Error Boundary for Intelligence Tab ─────────────────────────────────────

class IntelligenceBoundary extends Component<{ children: ReactNode; onReset: () => void }, { crashed: boolean }> {
  state = { crashed: false }
  static getDerivedStateFromError() { return { crashed: true } }
  componentDidCatch() {
    // Silently clear corrupted intelligence from DB — next page load will start fresh
    fetch('/api/geo/clear-intelligence', { method: 'DELETE' }).catch(() => {})
  }
  render() {
    if (this.state.crashed) return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-4" />
        <p className="text-white font-semibold mb-1">Analysis data could not be displayed</p>
        <p className="text-slate-400 text-sm mb-6">The cached data was corrupted and has been cleared. Click below to regenerate.</p>
        <button
          onClick={() => { this.setState({ crashed: false }); this.props.onReset() }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
        >
          Regenerate Analysis
        </button>
      </div>
    )
    return this.props.children
  }
}

// ─── AI Intelligence Tab ──────────────────────────────────────────────────────

function IntelligenceTab({ intelligence, onGenerate, generating, error, logs, onContentGenerated, generatedGaps, currentGeo, websiteUrl }: {
  intelligence: GeoIntelligence | null
  onGenerate: () => void
  generating: boolean
  error: string
  logs: string[]
  onContentGenerated: () => void
  generatedGaps: string[]
  currentGeo: GeoCheck | null
  websiteUrl: string
}) {
  const [promptFilter, setPromptFilter] = useState<string>('all')
  const [gapGenerating, setGapGenerating] = useState<Record<number, boolean>>({})
  const [gapDone, setGapDone] = useState<Record<number, { channel: string; pushed: boolean }>>({})
  const [gapError, setGapError] = useState<Record<number, string>>({})
  const [clusterGenerating, setClusterGenerating] = useState<Record<number, boolean>>({})
  const [clusterDone, setClusterDone] = useState<Record<number, { channel: string; pushed: boolean }>>({})
  const [clusterError, setClusterError] = useState<Record<number, string>>({})

  // Restore generated gaps from localStorage on mount
  useEffect(() => {
    if (!intelligence?.content_gaps) return
    try {
      const stored: Record<string, { channel: string; pushed: boolean }> =
        JSON.parse(localStorage.getItem('coovex:generated_gaps') ?? '{}')
      const restored: Record<number, { channel: string; pushed: boolean }> = {}
      intelligence.content_gaps.forEach((gap, i) => {
        if (stored[gap.suggestion]) {
          restored[i] = stored[gap.suggestion]
        } else if (generatedGaps.includes(gap.suggestion)) {
          // DB-persisted — channel unknown from cache, default to wordpress
          restored[i] = { channel: 'wordpress', pushed: false }
        }
      })
      if (Object.keys(restored).length > 0) setGapDone(restored)
    } catch { /* ignore */ }
  }, [intelligence, generatedGaps])

  const handleGenerateContent = async (gap: GeoIntelligence['content_gaps'][number], idx: number) => {
    setGapGenerating(prev => ({ ...prev, [idx]: true }))
    setGapError(prev => ({ ...prev, [idx]: '' }))
    try {
      const res = await fetch('/api/geo/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: gap.type, suggestion: gap.suggestion }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      const doneEntry = { channel: data.channel, pushed: !!data.pushed }
      setGapDone(prev => ({ ...prev, [idx]: doneEntry }))
      // Persist to localStorage so "View" survives page reload
      try {
        const stored = JSON.parse(localStorage.getItem('coovex:generated_gaps') ?? '{}')
        stored[gap.suggestion] = doneEntry
        localStorage.setItem('coovex:generated_gaps', JSON.stringify(stored))
      } catch { /* ignore */ }
      onContentGenerated()
    } catch (e) {
      setGapError(prev => ({ ...prev, [idx]: e instanceof Error ? e.message : 'Failed' }))
    } finally {
      setGapGenerating(prev => ({ ...prev, [idx]: false }))
    }
  }

  const handleGenerateCluster = async (cluster: GeoIntelligence['topic_clusters'][number], idx: number) => {
    setClusterGenerating(prev => ({ ...prev, [idx]: true }))
    setClusterError(prev => ({ ...prev, [idx]: '' }))
    try {
      const suggestion = `Write a comprehensive guide about "${cluster.topic}" covering: ${cluster.subtopics.join(', ')}. This page should go at: ${cluster.suggested_url || '/' + cluster.topic.toLowerCase().replace(/\s+/g, '-')}`
      const res = await fetch('/api/geo/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'guide', suggestion }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setClusterDone(prev => ({ ...prev, [idx]: { channel: data.channel, pushed: !!data.pushed } }))
      onContentGenerated()
    } catch (e) {
      setClusterError(prev => ({ ...prev, [idx]: e instanceof Error ? e.message : 'Failed' }))
    } finally {
      setClusterGenerating(prev => ({ ...prev, [idx]: false }))
    }
  }

  if (!intelligence || generating) {
    return (
      <div className="space-y-4 pb-10">
        <div className="bg-slate-950/20 border border-slate-700/30 rounded-2xl p-8">
          <div className="text-center mb-6">
            <Brain className={`w-12 h-12 text-blue-400 mx-auto mb-4 ${generating ? 'animate-pulse' : ''}`} />
            <h2 className="text-lg font-semibold text-white mb-2">AI Visibility Intelligence</h2>
            {!generating && (
              <>
                <p className="text-slate-400 text-sm mb-4 max-w-md mx-auto">
                  AI analyzes your business to tell you exactly where you stand in AI search results — and what to do to get mentioned more.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6 text-left max-w-lg mx-auto">
                  {[
                    { icon: '🎯', title: 'Test Prompts', desc: 'Real prompts users type in ChatGPT, Perplexity, Gemini & Claude to find businesses like yours' },
                    { icon: '✨', title: 'Live AI Visibility Check', desc: 'Gemini actually searches right now and tells you if your business appears in AI results today', highlight: true },
                    { icon: '📊', title: 'Topic Coverage', desc: 'Which topics AI knows well vs where you\'re completely invisible' },
                    { icon: '✍️', title: 'Content to Create', desc: 'Specific articles, comparisons & FAQs that get you cited — AI writes them for you' },
                    { icon: '🤖', title: 'Entity Score', desc: 'How clearly AI can identify your business (0–100)' },
                    { icon: '🗣️', title: 'AI Voice', desc: 'The exact words AI would use to describe you when recommending you' },
                  ].map((f, i) => (
                    <div key={i} className={`flex items-start gap-2.5 p-3 rounded-xl border ${f.highlight ? 'bg-slate-950/30 border-slate-700/40' : 'bg-slate-900/50 border-slate-800'}`}>
                      <span className="text-lg flex-shrink-0">{f.icon}</span>
                      <div>
                        <p className={`text-xs font-semibold ${f.highlight ? 'text-blue-300' : 'text-slate-300'}`}>{f.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <button
              onClick={onGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
            >
              <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Analyzing…' : 'Generate Full AI Report'}
            </button>
            <div className="flex items-center justify-center gap-3 mt-3">
              <span className="text-slate-600 text-xs">5 AI credits</span>
              <span className="text-slate-700 text-xs">·</span>
              <span className="text-slate-600 text-xs">Cached 7 days</span>
              <span className="text-slate-700 text-xs">·</span>
              <span className="text-slate-600 text-xs">Includes live Gemini search</span>
            </div>
          </div>

          {/* Live console log */}
          {logs.length > 0 && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500/60" />
                  <span className="w-3 h-3 rounded-full bg-slate-600/60" />
                  <span className="w-3 h-3 rounded-full bg-blue-600/60" />
                </div>
                <span className="text-[11px] font-mono text-slate-500 ml-1">coovex ~ geo-intelligence</span>
              </div>
              <div className="p-4 font-mono text-xs space-y-1.5 max-h-64 overflow-y-auto">
                {logs.map((line, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-slate-600 select-none flex-shrink-0">$</span>
                    <span className={
                      line.startsWith('✅') ? 'text-blue-400' :
                      line.startsWith('❌') || line.startsWith('Error') ? 'text-red-400' :
                      line.startsWith('⚠️') ? 'text-slate-500' :
                      'text-slate-300'
                    }>
                      {line}
                    </span>
                  </div>
                ))}
                {generating && (
                  <div className="flex items-center gap-2 text-blue-400">
                    <span className="text-slate-600 select-none">$</span>
                    <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse rounded-sm" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const promptExamples = intelligence.prompt_examples ?? []
  const contentGaps    = intelligence.content_gaps    ?? []
  const topicClusters  = intelligence.topic_clusters  ?? []

  const aisPresent = [...new Set(promptExamples.map(p => p.ai))]
  const filteredPrompts = promptFilter === 'all'
    ? promptExamples
    : promptExamples.filter(p => p.ai === promptFilter)

  const coverageMeta = {
    strong:  { icon: '✅', cls: 'text-blue-400', bg: 'bg-slate-950/20 border-slate-700/30' },
    weak:    { icon: '⚠️',  cls: 'text-slate-500',   bg: 'bg-slate-950/20 border-slate-700/30'   },
    missing: { icon: '❌', cls: 'text-red-400',      bg: 'bg-red-950/20 border-red-800/30'       },
  }

  const gapImpactOrder = { high: 0, medium: 1, low: 2 }
  const sortedGaps = [...contentGaps].sort((a, b) => gapImpactOrder[a.impact] - gapImpactOrder[b.impact])

  return (
    <div className="space-y-5 pb-10">
      {/* Header + refresh */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">
            Last analyzed: {new Date(intelligence.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <p className="text-[11px] text-slate-600 mt-0.5">Regenerate after publishing new content to track visibility improvement</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={onGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Regenerating…' : 'Regenerate'}
          </button>
          <p className="text-[10px] text-blue-400/60">5 credits · 7-day cache</p>
        </div>
      </div>

      {/* Entity Score + AI Voice */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center">
          <p className="text-sm text-slate-400 mb-3 font-medium">Entity Score</p>
          <ScoreRing score={intelligence.entity_score} size={120} />
          <p className="text-[11px] text-slate-500 mt-2 text-center">AI recognition clarity</p>
        </div>
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <p className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <span>🗣️</span> How AI Would Describe You
            </p>
            <p className="text-xs text-slate-500 mb-3">When a user asks a relevant question, AI assistants (once optimized) would say:</p>
            <blockquote className="text-slate-200 text-sm leading-relaxed border-l-2 border-blue-500 pl-4 italic">
              &ldquo;{intelligence.ai_voice_summary}&rdquo;
            </blockquote>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-500 font-medium mb-1">Entity Notes</p>
            <p className="text-xs text-slate-400 leading-relaxed">{intelligence.entity_notes}</p>
          </div>
        </div>
      </div>

      {/* Live AI Visibility Check */}
      {intelligence.actual_ai_visibility ? (
        <LiveVisibilityCheck visibility={intelligence.actual_ai_visibility} geo={currentGeo} />
      ) : (
        <div className="bg-slate-950/15 border border-slate-700/30 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">✨</span>
            <div>
              <p className="text-sm font-semibold text-white mb-0.5">Live AI Visibility Check — New Feature</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Gemini will search in real-time to verify if your business actually appears in AI results today.
                Click <strong className="text-slate-300">Regenerate</strong> to add this check to your existing analysis (no extra credits).
              </p>
            </div>
          </div>
          <button
            onClick={onGenerate}
            disabled={generating}
            className="flex-shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Checking…' : 'Run Check'}
          </button>
        </div>
      )}

      {/* Test Prompts */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-white">🎯 Test Prompts</h3>
          <span className="text-xs text-slate-500">{promptExamples.length} prompts</span>
        </div>
        <p className="text-xs text-slate-500 mb-4">Real prompts users type in AI assistants that should surface your business. Copy and test them yourself.</p>

        {/* AI filter tabs */}
        <div className="flex gap-1 flex-wrap mb-4">
          <button
            onClick={() => setPromptFilter('all')}
            className={`text-xs px-3 py-1 rounded-lg border transition-colors ${promptFilter === 'all' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
          >
            All ({promptExamples.length})
          </button>
          {aisPresent.map(ai => (
            <button
              key={ai}
              onClick={() => setPromptFilter(ai)}
              className={`text-xs px-3 py-1 rounded-lg border transition-colors ${promptFilter === ai ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
            >
              {AI_ICONS[ai]} {ai}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filteredPrompts.map((p, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 group hover:border-slate-600 transition-colors">
              <span className="text-base flex-shrink-0 mt-0.5">{AI_ICONS[p.ai]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-semibold text-slate-400">{p.ai}</span>
                  <span className="text-[10px] text-slate-600">·</span>
                  <span className="text-[10px] text-slate-500">{CATEGORY_LABELS[p.category]}</span>
                  <LikelihoodBadge v={p.likelihood} />
                </div>
                <p className="text-sm text-slate-200 font-medium leading-snug">&ldquo;{p.prompt}&rdquo;</p>
              </div>
              <CopyButton text={p.prompt} />
            </div>
          ))}
        </div>
      </div>

      {/* Topic Clusters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-1">📊 Topic Coverage</h3>
        <p className="text-xs text-slate-500 mb-4">
          Topics where AI needs to know about your business. <span className="text-blue-400">Not covered</span> or <span className="text-slate-500">Weak</span> = create a page on your website for that topic — CooVex can write it for you.
        </p>
        <div className="space-y-3">
          {topicClusters.map((cluster, i) => {
            const m = coverageMeta[cluster.coverage] ?? coverageMeta.missing
            const isClusterDone = !!clusterDone[i]
            const isClusterGenerating = !!clusterGenerating[i]
            const needsContent = cluster.coverage !== 'strong'
            const baseUrl = websiteUrl ? websiteUrl.replace(/\/$/, '') : 'yourdomain.com'
            return (
              <div key={i} className={`p-4 rounded-xl border ${m.bg}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex-shrink-0">{m.icon}</span>
                    <span className={`text-sm font-semibold ${m.cls} truncate`}>{cluster.topic}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      cluster.coverage === 'strong' ? 'bg-blue-600/15 text-blue-400 border-blue-500/25' :
                      cluster.coverage === 'weak'   ? 'bg-slate-600/15 text-slate-500 border-slate-500/25' :
                                                      'bg-red-500/15 text-red-400 border-red-500/25'
                    }`}>
                      {cluster.coverage === 'strong' ? 'Strong' : cluster.coverage === 'weak' ? 'Weak' : 'Not covered'}
                    </span>
                    {needsContent && (
                      isClusterDone ? (
                        <a href="/content"
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900/40 hover:bg-slate-900/60 text-blue-400 border border-slate-700/40 transition-colors whitespace-nowrap">
                          View draft →
                        </a>
                      ) : (
                        <button
                          onClick={() => handleGenerateCluster(cluster, i)}
                          disabled={isClusterGenerating}
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 disabled:opacity-50 text-blue-300 border border-slate-700/40 transition-colors whitespace-nowrap"
                        >
                          {isClusterGenerating ? (
                            <><span className="w-2.5 h-2.5 border border-blue-400 border-t-transparent rounded-full animate-spin" />Writing…</>
                          ) : (
                            <>✨ Write with AI · 8 credits</>
                          )}
                        </button>
                      )
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(cluster.subtopics ?? []).map((s, j) => (
                    <span key={j} className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {s}
                    </span>
                  ))}
                </div>
                {cluster.suggested_url && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500">Create this page on your site:</span>
                    <span className={`text-[10px] font-mono font-medium ${
                      cluster.coverage === 'missing' ? 'text-red-400' : cluster.coverage === 'weak' ? 'text-slate-500' : 'text-blue-400'
                    }`}>
                      {baseUrl}{cluster.suggested_url}
                    </span>
                  </div>
                )}
                {clusterError[i] && (
                  <p className="text-xs text-red-400 mt-1.5">{clusterError[i]}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Content Gap Analysis */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-white">✍️ Content to Create</h3>
          <span className="text-[10px] text-slate-500">AI generates &amp; saves to Content as draft</span>
        </div>
        <p className="text-xs text-slate-500 mb-4">AI assistants frequently cite these content types. Click Generate — CooVex writes it and pushes it to your site automatically (if webhook is set up), or saves it to Content drafts.</p>
        <div className="space-y-2">
          {sortedGaps.map((gap, i) => {
            const isDone = !!gapDone[i]
            const isGenerating = !!gapGenerating[i]
            const doneInfo = gapDone[i]
            return (
              <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
                isDone            ? 'bg-slate-950/20 border-slate-700/30' :
                gap.impact === 'high'   ? 'bg-red-950/10 border-red-800/20' :
                gap.impact === 'medium' ? 'bg-slate-950/10 border-slate-700/20' :
                                          'bg-slate-800/30 border-slate-700/50'
              }`}>
                <span className="text-lg flex-shrink-0 mt-0.5">{isDone ? '✅' : CONTENT_TYPE_ICONS[gap.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{gap.type}</span>
                    <ImpactBadge v={gap.impact} />
                    {isDone && doneInfo && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-600/15 text-blue-400 border border-blue-500/25">
                        {doneInfo.pushed ? `Pushed to site ✓` : `Saved to ${doneInfo.channel} drafts`}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm leading-snug ${isDone ? 'text-slate-400' : 'text-slate-200'}`}>{gap.suggestion}</p>
                  {gapError[i] && (
                    <p className="text-xs text-red-400 mt-1">{gapError[i]}</p>
                  )}
                </div>
                {isDone ? (
                  <a
                    href="/content"
                    className="flex-shrink-0 text-[11px] px-3 py-1.5 rounded-lg bg-slate-900/40 hover:bg-slate-900/60 text-blue-400 border border-slate-700/40 transition-colors"
                  >
                    View →
                  </a>
                ) : (
                  <button
                    onClick={() => handleGenerateContent(gap, i)}
                    disabled={isGenerating}
                    className="flex-shrink-0 flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 disabled:opacity-50 text-blue-300 border border-slate-700/40 transition-colors whitespace-nowrap"
                  >
                    {isGenerating ? (
                      <>
                        <span className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                        Writing…
                      </>
                    ) : (
                      <>✨ Generate · 8 credits</>
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Regenerate after creating content */}
      <div className="bg-gradient-to-r from-slate-950/40 to-slate-900 border border-slate-700/40 rounded-2xl p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white mb-1">✅ Published the content above?</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Regenerate to see if your AI visibility score improves and whether Gemini starts mentioning you in search results.
          </p>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          <button
            onClick={onGenerate}
            disabled={generating}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-violet-900/40 whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Regenerating…' : 'Regenerate Report'}
          </button>
          <p className="text-[10px] text-blue-400/70">5 AI credits</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/30 border border-red-800/30 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GeoClient({ geo, intel, websiteUrl, businessName, lastScanned, cachedIntelligence, generatedGaps = [] }: GeoClientProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'intelligence' | 'generators' | 'tasks'>('overview')
  const [currentGeo, setCurrentGeo] = useState<GeoCheck | null>(geo)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [lastScan, setLastScan] = useState(lastScanned)

  const [intelligence, setIntelligence] = useState<GeoIntelligence | null>(cachedIntelligence)
  const [intelLoading, setIntelLoading] = useState(false)
  const [intelError, setIntelError] = useState('')
  const [intelLogs, setIntelLogs] = useState<string[]>([])
  const [genLoading, setGenLoading] = useState<'llms_txt' | 'jsonld' | null>(null)
  const [genContent, setGenContent] = useState<{ llms_txt?: string; jsonld?: string }>({})
  const [genError, setGenError] = useState('')

  const handleScan = async () => {
    setScanning(true); setScanError('')
    try {
      const res = await fetch('/api/geo/scan', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scan failed')
      setCurrentGeo(data.geo)
      setLastScan(new Date().toISOString())
    } catch (e: unknown) {
      setScanError(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  const handleGenerateIntelligence = async () => {
    setIntelError('')
    // Pre-check: verify enough credits before starting
    const check = await checkCredits('geo_intelligence')
    if (!check.ok) {
      setIntelError(check.error)
      return
    }
    setIntelLoading(true)
    setIntelLogs([])
    try {
      const res = await fetch('/api/geo/intelligence', { method: 'POST' })
      if (!res.body) throw new Error('No response stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6)) as { type: string; msg?: string; intelligence?: GeoIntelligence }
            if (evt.type === 'log' && evt.msg) {
              setIntelLogs(prev => [...prev, evt.msg!])
            } else if (evt.type === 'done') {
              if (evt.intelligence && Array.isArray(evt.intelligence.prompt_examples)) {
                setIntelligence(evt.intelligence)
                window.dispatchEvent(new CustomEvent('coovex:credits-changed'))
              } else {
                // API returned done but with missing/null arrays — treat as failed
                setIntelError('Analysis returned incomplete data. Please try again.')
              }
            } else if (evt.type === 'error' && evt.msg) {
              setIntelError(evt.msg)
            }
          } catch (parseErr) {
            // SSE line failed to parse — log to console for debugging
            console.error('[geo-intelligence] SSE parse error:', parseErr, 'line length:', line.length)
          }
        }
      }
    } catch (e: unknown) {
      setIntelError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setIntelLoading(false)
    }
  }

  const handleGenerate = async (type: 'llms_txt' | 'jsonld') => {
    setGenLoading(type); setGenError('')
    try {
      const res = await fetch('/api/geo/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setGenContent(prev => ({ ...prev, [type]: data.content }))
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenLoading(null)
    }
  }

  const discoverability = currentGeo?.ai_discoverability ?? null
  const score = currentGeo?.geo_score ?? 0
  const discColors = {
    high:   'bg-blue-600/20 text-blue-400 border border-blue-500/30',
    medium: 'bg-slate-600/20 text-slate-500 border border-slate-500/30',
    low:    'bg-red-500/20 text-red-400 border border-red-500/30',
  }

  const priorityOrder = { critical: 0, high: 1, medium: 2 }
  const sortedVerifiedTasks = [...VERIFIED_TASKS].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
  const verifiedCount = currentGeo ? sortedVerifiedTasks.filter(t => currentGeo[t.key] === true).length : 0

  const TABS = [
    { id: 'overview',      label: 'Overview'        },
    { id: 'intelligence',  label: '🤖 AI Intelligence', badge: !intelligence },
    { id: 'generators',    label: 'Generators'      },
    { id: 'tasks',         label: 'AI Tasks'        },
  ] as const

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 flex items-center justify-center">
              <Globe2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">GEO Optimizer</h1>
              <p className="text-xs text-slate-400">Generative Engine Optimization — get found by ChatGPT, Perplexity & Gemini</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastScan && <span className="text-xs text-slate-500">Scanned: {new Date(lastScan).toLocaleDateString()}</span>}
            <button
              onClick={handleScan}
              disabled={scanning}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning…' : 'Run GEO Scan'}
            </button>
          </div>
        </div>
      </div>

      {scanError && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <div className="bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-3 text-red-400 text-sm">{scanError}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-6 pt-6">
        <div className="flex gap-1 bg-slate-900 rounded-xl p-1 border border-slate-800 w-fit mb-6 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
              {'badge' in tab && tab.badge && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-400" />
              )}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6 pb-10">
            {!currentGeo ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
                <Globe2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h2 className="text-lg font-medium text-white mb-2">No GEO data yet</h2>
                <p className="text-slate-400 text-sm mb-5">Run a website audit or click "Run GEO Scan" to check your AI discoverability.</p>
                <button onClick={handleScan} disabled={scanning} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm transition-colors">
                  {scanning ? 'Scanning…' : 'Run GEO Scan'}
                </button>
              </div>
            ) : (
              <>
                {/* Score + discoverability */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center">
                    <p className="text-sm text-slate-400 mb-3 font-medium">GEO Score</p>
                    <ScoreRing score={score} />
                    {discoverability && (
                      <span className={`mt-3 text-xs font-medium px-3 py-1 rounded-full ${discColors[discoverability]}`}>
                        {discoverability.charAt(0).toUpperCase() + discoverability.slice(1)} AI Discoverability
                      </span>
                    )}
                  </div>

                  <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <p className="text-sm font-medium text-white mb-4">GEO Checklist</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {GEO_ITEMS.map(item => {
                        const pass = currentGeo[item.key as keyof GeoCheck] as boolean

                        // Enhanced quality display for llms.txt and robots.txt
                        let qualityNote = ''
                        if (item.key === 'llms_txt' && pass) {
                          const q = currentGeo.llms_txt_quality
                          qualityNote = q === 'good' ? 'Good quality' : q === 'basic' ? 'Needs more content' : ''
                        }
                        if (item.key === 'robots_txt' && pass) {
                          qualityNote = currentGeo.robots_ai_allowed ? 'AI bots allowed' : 'AI bots not specified'
                        }

                        return (
                          <div
                            key={item.key}
                            className={`flex items-start gap-2 p-3 rounded-xl border ${
                              pass ? 'bg-slate-950/30 border-slate-700/30' : 'bg-slate-800/50 border-slate-700/50'
                            }`}
                          >
                            {pass ? <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                                  : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />}
                            <div>
                              <p className={`text-xs font-medium ${pass ? 'text-blue-300' : 'text-slate-300'}`}>{item.label}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">{qualityNote || item.desc}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Enhanced signals row — only shown if this is a new-format scan */}
                {currentGeo.llms_txt_quality !== undefined ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className={`flex items-center gap-3 p-4 rounded-xl border ${currentGeo.robots_ai_allowed ? 'bg-slate-950/20 border-slate-700/30' : 'bg-slate-900 border-slate-800'}`}>
                      <span className="text-xl">{currentGeo.robots_ai_allowed ? '✅' : '⚠️'}</span>
                      <div>
                        <p className="text-xs font-semibold text-white">AI Bot Access</p>
                        <p className="text-[11px] text-slate-500">{currentGeo.robots_ai_allowed ? 'GPTBot, ClaudeBot allowed' : 'Not explicitly allowed'}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                      currentGeo.llms_txt_quality === 'good'  ? 'bg-slate-950/20 border-slate-700/30' :
                      currentGeo.llms_txt_quality === 'basic' ? 'bg-slate-950/20 border-slate-700/30' :
                                                                 'bg-slate-900 border-slate-800'
                    }`}>
                      <span className="text-xl">
                        {currentGeo.llms_txt_quality === 'good' ? '✅' : currentGeo.llms_txt_quality === 'basic' ? '⚠️' : '❌'}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-white">llms.txt Quality</p>
                        <p className="text-[11px] text-slate-500">
                          {currentGeo.llms_txt_quality === 'good' ? 'Well structured' :
                           currentGeo.llms_txt_quality === 'basic' ? 'Needs more detail' : 'File missing'}
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-3 p-4 rounded-xl border ${currentGeo.faq_content ? 'bg-slate-950/20 border-slate-700/30' : 'bg-slate-900 border-slate-800'}`}>
                      <span className="text-xl">{currentGeo.faq_content ? '✅' : '❌'}</span>
                      <div>
                        <p className="text-xs font-semibold text-white">FAQ Content</p>
                        <p className="text-[11px] text-slate-500">{currentGeo.faq_content ? 'Found on page' : 'Add FAQ schema'}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">Re-scan to see AI bot access, llms.txt quality, and FAQ detection.</p>
                    <button
                      onClick={handleScan}
                      disabled={scanning}
                      className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-50 transition-colors"
                    >
                      {scanning ? 'Scanning…' : 'Re-scan'}
                    </button>
                  </div>
                )}

                {/* ── Intelligence summary or nudge ── */}
                {!intelligence ? (
                  <div className="bg-slate-950/20 border border-slate-700/30 rounded-2xl p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white mb-0.5">🤖 See which prompts should find you</p>
                      <p className="text-xs text-slate-400">AI Intelligence tab tells you exactly what users type in ChatGPT/Perplexity that should surface your business, and what content to create.</p>
                    </div>
                    <button onClick={() => setActiveTab('intelligence')}
                      className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                      Analyze →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">

                    {/* Live AI Visibility Check — compact */}
                    {intelligence.actual_ai_visibility && (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-semibold text-white flex items-center gap-2">
                            ✨ Live AI Visibility
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              intelligence.actual_ai_visibility.visibility_rate >= 60 ? 'bg-blue-600/15 text-blue-400 border border-blue-500/25' :
                              intelligence.actual_ai_visibility.visibility_rate >= 30 ? 'bg-slate-600/15 text-slate-500 border border-slate-500/25' :
                              'bg-red-500/15 text-red-400 border border-red-500/25'
                            }`}>
                              {intelligence.actual_ai_visibility.visibility_rate}%
                            </span>
                          </p>
                          <button onClick={() => setActiveTab('intelligence')}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                            See full check →
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {intelligence.actual_ai_visibility.checks.map((c, i) => (
                            <div key={i} className="flex items-center gap-2.5 py-1">
                              <span className="flex-shrink-0 text-sm">{c.found ? '✅' : '❌'}</span>
                              <p className="text-xs text-slate-400 truncate flex-1">&ldquo;{c.query}&rdquo;</p>
                              <span className={`text-[10px] font-semibold flex-shrink-0 ${c.found ? 'text-blue-400' : 'text-red-400'}`}>
                                {c.found ? 'Mentioned' : 'Not found'}
                              </span>
                            </div>
                          ))}
                        </div>
                        {intelligence.actual_ai_visibility.visibility_rate < 60 && (
                          <div className="mt-3 pt-3 border-t border-slate-800 flex items-start gap-2">
                            <span className="text-sm flex-shrink-0">💡</span>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              To get mentioned: create the <strong className="text-slate-400">content below</strong>, add JSON-LD structured data, publish /llms.txt, and get listed on G2/Capterra. Then regenerate to re-check.
                              <button onClick={() => setActiveTab('intelligence')} className="ml-1 text-blue-400 hover:text-blue-300 underline transition-colors">See full guide →</button>
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Content to Create — top 3 high-impact */}
                    {(intelligence?.content_gaps?.length ?? 0) > 0 && (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-semibold text-white">✍️ Content to Create</p>
                          <button onClick={() => setActiveTab('intelligence')}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                            See all {intelligence?.content_gaps?.length ?? 0} →
                          </button>
                        </div>
                        <div className="space-y-2">
                          {[...(intelligence?.content_gaps ?? [])]
                            .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.impact] - { high: 0, medium: 1, low: 2 }[b.impact]))
                            .slice(0, 3)
                            .map((gap, i) => (
                              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${
                                gap.impact === 'high' ? 'bg-red-950/10 border-red-800/20' : 'bg-slate-800/40 border-slate-700/40'
                              }`}>
                                <span className="flex-shrink-0 text-base mt-0.5">
                                  {{ comparison: '⚖️', faq: '❓', 'case-study': '📊', listicle: '📋', 'how-to': '📖', landing: '🏠', guide: '📘', 'integration-guide': '🔌', 'use-case': '💡', 'competitive-positioning': '🎯', 'brand-entity': '🏷️' }[gap.type] ?? '📝'}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-[10px] font-semibold text-slate-500 uppercase">{gap.type}</span>
                                    <span className={`text-[10px] font-semibold px-1 rounded ${gap.impact === 'high' ? 'text-red-400' : 'text-slate-500'}`}>
                                      {gap.impact} impact
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-300 leading-snug line-clamp-2">{gap.suggestion}</p>
                                </div>
                                <button
                                  onClick={() => setActiveTab('intelligence')}
                                  className="flex-shrink-0 text-[11px] px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-slate-700/40 transition-colors whitespace-nowrap"
                                >
                                  Generate
                                </button>
                              </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pending AI Tasks — top 3 unverified */}
                    {(() => {
                      const pending = VERIFIED_TASKS.filter(t => !currentGeo || currentGeo[t.key] !== true)
                        .sort((a, b) => ({ critical: 0, high: 1, medium: 2 }[a.priority] - { critical: 0, high: 1, medium: 2 }[b.priority]))
                        .slice(0, 3)
                      if (!pending.length) return null
                      return (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-white">📋 Pending AI Tasks</p>
                            <button onClick={() => setActiveTab('tasks')}
                              className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                              See all tasks →
                            </button>
                          </div>
                          <div className="space-y-2">
                            {pending.map((task, i) => (
                              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
                                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                <p className="text-xs text-slate-300 flex-1">{task.title}</p>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                                  task.priority === 'critical' ? 'bg-red-500/15 text-red-400 border-red-500/25' :
                                  task.priority === 'high'     ? 'bg-slate-600/15 text-slate-500 border-slate-500/25' :
                                  'bg-blue-500/15 text-blue-400 border-blue-500/25'
                                }`}>{task.priority}</span>
                              </div>
                            ))}
                          </div>
                          <button onClick={() => setActiveTab('tasks')}
                            className="mt-3 w-full text-xs text-center text-slate-500 hover:text-slate-300 transition-colors py-1">
                            View all tasks with instructions →
                          </button>
                        </div>
                      )
                    })()}

                  </div>
                )}

                {/* Missing GEO */}
                {currentGeo.missing_geo.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <p className="text-sm font-medium text-white mb-3">Missing Elements ({currentGeo.missing_geo.length})</p>
                    <ul className="space-y-2">
                      {currentGeo.missing_geo.map((m, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />{m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {websiteUrl && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400">Scanning</p>
                      <p className="text-sm text-white mt-0.5">{websiteUrl}</p>
                    </div>
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                      Visit site →
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── AI Intelligence ── */}
        {activeTab === 'intelligence' && (
          <IntelligenceBoundary onReset={() => { setIntelligence(null); handleGenerateIntelligence() }}>
            <IntelligenceTab
              intelligence={intelligence}
              onGenerate={handleGenerateIntelligence}
              generating={intelLoading}
              error={intelError}
              logs={intelLogs}
              generatedGaps={generatedGaps}
              currentGeo={currentGeo}
              websiteUrl={websiteUrl}
              onContentGenerated={() => {
                window.dispatchEvent(new CustomEvent('coovex:content-draft-added'))
                window.dispatchEvent(new CustomEvent('coovex:credits-changed'))
              }}
            />
          </IntelligenceBoundary>
        )}

        {/* ── Generators ── */}
        {activeTab === 'generators' && (
          <div className="space-y-6 pb-10">
            {genError && <div className="bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-3 text-red-400 text-sm">{genError}</div>}

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">llms.txt Generator</h3>
                  <p className="text-xs text-slate-400 mt-1">An emerging standard that tells AI models (Perplexity, ChatGPT, Gemini) about your business. Place at your website root at <code className="text-slate-300">/llms.txt</code>.</p>
                </div>
                <button onClick={() => handleGenerate('llms_txt')} disabled={genLoading === 'llms_txt'}
                  className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm transition-colors ml-4">
                  {genLoading === 'llms_txt' ? 'Generating…' : 'Generate llms.txt'}
                </button>
              </div>
              {genContent.llms_txt ? (
                <CodeBlock content={genContent.llms_txt} filename="llms.txt" />
              ) : (
                <div className="bg-slate-800/50 rounded-xl p-4 text-xs text-slate-500 font-mono">
                  {'# ' + (businessName || 'Your Business') + '\n'}
                  {'> One-line description of what you do\n\n'}
                  {'## Services\n- Service 1\n- Service 2\n\n'}
                  {'## Contact\n- Website: ' + (websiteUrl || 'https://yoursite.com')}
                  {'\n\n[Click "Generate llms.txt" to create a personalized file]'}
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Organization JSON-LD Generator</h3>
                  <p className="text-xs text-slate-400 mt-1">Structured data that helps Google SGE, Bing AI, and other AI search engines understand your business entity.</p>
                </div>
                <button onClick={() => handleGenerate('jsonld')} disabled={genLoading === 'jsonld'}
                  className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm transition-colors ml-4">
                  {genLoading === 'jsonld' ? 'Generating…' : 'Generate JSON-LD'}
                </button>
              </div>
              {genContent.jsonld ? (
                <CodeBlock content={genContent.jsonld} filename="structured-data.json" />
              ) : (
                <div className="bg-slate-800/50 rounded-xl p-4 text-xs text-slate-500 font-mono">
                  {'{\n  "@context": "https://schema.org",\n  "@type": "Organization",\n  "name": "' + (businessName || 'Your Business') + '",\n  ...\n}'}
                  {'\n\n[Click "Generate JSON-LD" to create your schema]'}
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">robots.txt with AI Bot Permissions</h3>
                  <p className="text-xs text-slate-400 mt-1">Explicitly allows GPTBot, CCBot, PerplexityBot, ClaudeBot, anthropic-ai, and Google-Extended to index your site.</p>
                </div>
              </div>
              <CodeBlock content={STATIC_ROBOTS_TXT} filename="robots.txt" />
              <p className="text-xs text-slate-500 mt-3">Replace <code className="text-slate-400">yourdomain.com</code> with your actual domain before uploading.</p>
            </div>
          </div>
        )}

        {/* ── AI Tasks ── */}
        {activeTab === 'tasks' && (
          <div className="space-y-3 pb-10">
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4 flex items-center justify-between">
              <div>
                {!currentGeo ? (
                  <p className="text-sm text-slate-400">Run a GEO scan to auto-verify your tasks</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xl font-bold text-blue-400">{verifiedCount}</p>
                      <p className="text-xs text-slate-500">Verified</p>
                    </div>
                    <div className="w-px h-8 bg-slate-700" />
                    <div className="text-center">
                      <p className="text-xl font-bold text-red-400">{sortedVerifiedTasks.length - verifiedCount}</p>
                      <p className="text-xs text-slate-500">Remaining</p>
                    </div>
                    <div className="w-px h-8 bg-slate-700" />
                    <div className="text-center">
                      <p className="text-xl font-bold text-white">{sortedVerifiedTasks.length}</p>
                      <p className="text-xs text-slate-500">Total</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <button onClick={handleScan} disabled={scanning}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm transition-colors">
                  <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                  {scanning ? 'Verifying…' : 'Re-scan to Verify'}
                </button>
                <p className="text-[11px] text-slate-500">CooVex independently verifies each task</p>
              </div>
            </div>

            {!currentGeo && (
              <div className="bg-blue-950/30 border border-blue-800/30 rounded-xl px-5 py-4">
                <p className="text-sm font-medium text-blue-300 mb-1">How auto-verification works</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  CooVex scans your live website to check each task independently. You cannot manually mark tasks as done — only a real scan can verify them. Implement a change, then click "Re-scan to Verify".
                </p>
              </div>
            )}

            {sortedVerifiedTasks.map(task => (
              <VerifiedTaskCard
                key={task.key}
                task={task}
                verified={currentGeo ? (currentGeo[task.key] as boolean) === true : false}
                scanned={!!currentGeo}
                onGoToGenerators={() => setActiveTab('generators')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
