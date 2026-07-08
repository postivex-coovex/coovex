'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { LiveVisibilityCheck } from '@/components/geo/live-visibility-check'
import type { VisibilityResult } from '@/app/api/geo/visibility-check/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditScores {
  performance: number; seo: number; accessibility: number
  best_practices: number; mobile: number; overall: number
}
interface AuditIssue {
  severity: 'critical' | 'warning' | 'info'; category: string; title: string; description: string
}
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
  [key: string]: unknown
}
interface BusinessIntel {
  business_name?: string; description?: string; industry?: string; services?: string[]
  target_market?: string; who_needs_it?: string[]; pain_points?: string[]
  contact?: { email?: string; phone?: string; address?: string }
  social_links?: { linkedin?: string; facebook?: string; instagram?: string; twitter?: string }
  team_members?: string[]; clients?: string[]; pricing_model?: string
  unique_value_proposition?: string; missing_elements?: string[]
  content_quality_score?: number; ai_insights?: string[]
}
type AuditPurpose = 'my_business' | 'client' | 'competitor' | 'research'
interface Audit {
  id: string; type: string; score: number; created_at: string
  report_json: {
    url?: string; purpose?: AuditPurpose; scores: AuditScores
    issues: AuditIssue[]; recommendations: string[]
    intel?: BusinessIntel; geo?: GeoCheck
    pages_visited?: string[]; js_rendered_pages?: string[]; checked_at?: string
  }
}
interface AuditClientProps {
  audits: Audit[]; websiteUrl: string; businessName: string; currentHealthScore: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PURPOSE_META: Record<AuditPurpose, { label: string; icon: string; color: string }> = {
  my_business: { label: 'My Business', icon: '🏢', color: 'bg-violet-900/40 text-violet-300 border-violet-700/40' },
  client:      { label: 'Client',      icon: '🤝', color: 'bg-blue-900/40 text-blue-300 border-blue-700/40' },
  competitor:  { label: 'Competitor',  icon: '🔍', color: 'bg-amber-900/40 text-amber-300 border-amber-700/40' },
  research:    { label: 'Research',    icon: '📊', color: 'bg-slate-800 text-slate-400 border-slate-700' },
}
const SEVERITY_META = {
  critical: { label: 'Critical', color: 'text-red-400',   bg: 'bg-red-950/40 border-red-800/40',   dot: 'bg-red-400' },
  warning:  { label: 'Warning',  color: 'text-amber-400', bg: 'bg-amber-950/40 border-amber-800/40', dot: 'bg-amber-400' },
  info:     { label: 'Info',     color: 'text-blue-400',  bg: 'bg-blue-950/40 border-blue-800/40',  dot: 'bg-blue-400' },
}
const GEO_ITEMS = [
  { key: 'llms_txt',        label: 'llms.txt',      icon: '🤖', desc: 'AI model guide',      weight: 'critical' },
  { key: 'structured_data', label: 'JSON-LD',       icon: '🧬', desc: 'Rich results schema', weight: 'critical' },
  { key: 'meta_description',label: 'Meta Desc',     icon: '📝', desc: 'Page summaries',      weight: 'high' },
  { key: 'sitemap_xml',     label: 'sitemap.xml',   icon: '🗺',  desc: 'Page index',          weight: 'high' },
  { key: 'robots_txt',      label: 'robots.txt',    icon: '🤖', desc: 'Crawler rules',       weight: 'high' },
  { key: 'open_graph',      label: 'Open Graph',    icon: '🔗', desc: 'Social/AI preview',   weight: 'medium' },
  { key: 'https',           label: 'HTTPS',         icon: '🔒', desc: 'Secure connection',   weight: 'high' },
  { key: 'canonical_url',   label: 'Canonical',     icon: '📎', desc: 'Dedup prevention',    weight: 'medium' },
  { key: 'twitter_card',    label: 'X/Twitter Card',icon: '🐦', desc: 'Social card',         weight: 'low' },
] as const

// ─── Sub-components ───────────────────────────────────────────────────────────

function FixOutput({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g)
  return (
    <div className="space-y-3 text-sm">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const lines = part.slice(3, -3).split('\n')
          const lang = lines[0].trim()
          const code = lines.slice(1).join('\n')
          return (
            <div key={i} className="relative group">
              {lang && <span className="absolute top-2 right-2 text-[10px] text-slate-500 font-mono">{lang}</span>}
              <pre className="bg-slate-900 border border-slate-700 rounded-lg p-4 overflow-x-auto text-xs text-slate-200 font-mono leading-relaxed">
                <code>{code}</code>
              </pre>
              <button
                onClick={() => navigator.clipboard.writeText(code)}
                className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-0.5 rounded"
              >
                Copy
              </button>
            </div>
          )
        }
        return part.trim() ? (
          <p key={i} className="text-slate-300 leading-relaxed whitespace-pre-wrap">{part.trim()}</p>
        ) : null
      })}
    </div>
  )
}

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size / 2) - 10
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={size*0.22} fontWeight="700">{score}</text>
      <text x="50%" y="68%" textAnchor="middle" dominantBaseline="middle" fill={color} fontSize={size*0.13} fontWeight="600">{grade}</text>
    </svg>
  )
}

function MiniScoreCard({ label, score }: { label: string; score: number }) {
  const color = score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'
  const bar   = score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="bg-slate-800/60 rounded-xl p-3 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-slate-400 text-xs">{label}</span>
        <span className={`text-sm font-bold ${color}`}>{score}</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

function GeoCheckItem({ item, passed }: { item: typeof GEO_ITEMS[number]; passed: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all ${
      passed ? 'bg-emerald-900/20 border-emerald-800/40' : 'bg-slate-800/40 border-slate-700/40'
    }`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${
        passed ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500'
      }`}>
        {passed ? '✓' : '✗'}
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-mono font-semibold truncate ${passed ? 'text-emerald-300' : 'text-slate-400'}`}>
          {item.label}
        </p>
        <p className="text-[10px] text-slate-600 truncate">{item.desc}</p>
      </div>
    </div>
  )
}

type TabId = 'overview' | 'geo' | 'issues' | 'intel'

interface AiFix {
  taskTitle: string
  content: string
  loading: boolean
}

// ─── Main Component ───────────────────────────────────────────────────────────

type LogEntry = {
  id: number
  text: string
  type: 'info' | 'success' | 'sub' | 'warn' | 'done'
  ts: string
}

function elapsed(start: number) {
  const s = ((Date.now() - start) / 1000).toFixed(1)
  return `${s}s`
}

export default function AuditClient({ audits: initialAudits, websiteUrl, businessName, currentHealthScore }: AuditClientProps) {
  const [audits, setAudits] = useState<Audit[]>(initialAudits)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [urlInput, setUrlInput] = useState(websiteUrl)
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(audits[0] || null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [updatingPurposeId, setUpdatingPurposeId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [aiFix, setAiFix] = useState<AiFix | null>(null)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [visibility, setVisibility] = useState<VisibilityResult | null>(null)
  const [visibilityLoading, setVisibilityLoading] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const startRef = useRef<number>(0)
  let logId = useRef(0)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logEntries])

  const runVisibilityCheck = useCallback(async (silent = false) => {
    if (!silent) setVisibilityLoading(true)
    try {
      // First try cache
      const cached = await fetch('/api/geo/visibility-check').then(r => r.json()) as { result: VisibilityResult | null }
      if (cached.result) { setVisibility(cached.result); return }
      // Run fresh check
      const res = await fetch('/api/geo/visibility-check', { method: 'POST' })
      const data = await res.json() as { result: VisibilityResult }
      if (data.result) setVisibility(data.result)
    } catch { /* silent fail */ } finally {
      setVisibilityLoading(false)
    }
  }, [])

  // Load visibility when geo tab is opened
  useEffect(() => {
    if (activeTab === 'geo' && !visibility && !visibilityLoading) {
      runVisibilityCheck(true)
    }
  }, [activeTab, visibility, visibilityLoading, runVisibilityCheck])

  function addLog(text: string, type: LogEntry['type'], delayMs: number) {
    const id = ++logId.current
    const timer = setTimeout(() => {
      setLogEntries(prev => [...prev, { id, text, type, ts: elapsed(startRef.current) }])
    }, delayMs)
    timersRef.current.push(timer)
  }

  function startLogSimulation(url: string) {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setLogEntries([])
    startRef.current = Date.now()

    const domain = (() => { try { return new URL(url).hostname } catch { return url } })()

    addLog(`Connecting to ${url}`, 'info', 100)
    addLog(`Homepage HTML fetched from ${domain}`, 'success', 900)
    addLog(`Discovering internal pages via anchor links...`, 'info', 1400)
    addLog(`↳ Scanning href + anchor text for keyword matches`, 'sub', 1900)
    addLog(`↳ Found pages: /about, /pricing, /contact, /services`, 'sub', 2600)
    addLog(`Fetching page content in parallel (up to 12 pages)`, 'info', 3200)
    addLog(`↳ [homepage] ${domain}/`, 'sub', 3600)
    addLog(`↳ [about] ${domain}/about`, 'sub', 4000)
    addLog(`↳ [pricing] ${domain}/pricing`, 'sub', 4300)
    addLog(`↳ [contact] ${domain}/contact`, 'sub', 4600)
    addLog(`Running Google PageSpeed API (mobile + desktop)`, 'info', 5000)
    addLog(`↳ Performance, SEO, Accessibility, Best Practices scores`, 'sub', 5400)
    addLog(`Checking GEO / AI discoverability signals...`, 'info', 6000)
    addLog(`↳ llms.txt — AI model guide file`, 'sub', 6300)
    addLog(`↳ robots.txt — crawler permission rules`, 'sub', 6600)
    addLog(`↳ sitemap.xml — page index for AI crawlers`, 'sub', 6900)
    addLog(`↳ JSON-LD structured data (rich results)`, 'sub', 7200)
    addLog(`↳ Open Graph, HTTPS, canonical URL, Twitter card`, 'sub', 7500)
    addLog(`GEO signals collected — computing AI discoverability score`, 'success', 8000)
    addLog(`Claude AI analyzing scraped content...`, 'info', 8800)
    addLog(`↳ Identifying industry, services & target market`, 'sub', 9500)
    addLog(`↳ Extracting unique value proposition`, 'sub', 10500)
    addLog(`↳ Finding contact info & social links`, 'sub', 11500)
    addLog(`↳ Spotting missing website elements`, 'sub', 12500)
    addLog(`↳ Generating AI business insights`, 'sub', 13500)
    addLog(`AI analysis complete`, 'success', 15000)
    addLog(`Saving audit report to agent memory (website_audit key)`, 'info', 15800)
    addLog(`Refreshing business context for all AI features`, 'sub', 16500)
    addLog(`Generating agent signals & action items`, 'info', 17000)
  }

  const updatePurpose = async (auditId: string, purpose: AuditPurpose, e: React.MouseEvent) => {
    e.stopPropagation()
    setUpdatingPurposeId(auditId)
    try {
      await fetch(`/api/audit/${auditId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purpose }) })
      setAudits(prev => prev.map(a => a.id === auditId ? { ...a, report_json: { ...a.report_json, purpose } } : a))
      if (selectedAudit?.id === auditId) setSelectedAudit(prev => prev ? { ...prev, report_json: { ...prev.report_json, purpose } } : prev)
    } finally { setUpdatingPurposeId(null) }
  }

  const deleteAudit = async (auditId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this audit?')) return
    setDeletingId(auditId)
    try {
      await fetch(`/api/audit/${auditId}`, { method: 'DELETE' })
      const next = audits.filter(a => a.id !== auditId)
      setAudits(next)
      if (selectedAudit?.id === auditId) setSelectedAudit(next[0] || null)
    } finally { setDeletingId(null) }
  }

  const fixWithAI = async (task: { title: string; desc: string }) => {
    setAiFix({ taskTitle: task.title, content: '', loading: true })
    try {
      const intel = selectedAudit?.report_json.intel
      const res = await fetch('/api/audit/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_title: task.title,
          task_desc: task.desc,
          website_url: selectedAudit?.report_json.url,
          business_name: intel?.business_name || businessName,
          business_desc: intel?.description,
        }),
      })
      const data = await res.json()
      setAiFix({ taskTitle: task.title, content: data.fix || 'Could not generate fix.', loading: false })
    } catch {
      setAiFix({ taskTitle: task.title, content: 'Failed to generate fix. Please try again.', loading: false })
    }
  }

  const runAudit = async () => {
    setRunning(true)
    setError('')
    const url = urlInput.trim()
    startLogSimulation(url)
    try {
      const res = await fetch('/api/audit/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Audit failed')
      // Clear pending timers, add final success line
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      setLogEntries(prev => [...prev, { id: ++logId.current, text: `✅ Audit complete — score ${data.scores?.overall ?? '?'}/100 · GEO ${data.geo?.geo_score ?? '?'}/100`, type: 'done', ts: elapsed(startRef.current) }])
      const newAudit: Audit = data.audit
      setAudits(prev => [newAudit, ...prev])
      setSelectedAudit(newAudit)
      setActiveTab('overview')
      // Auto-run AI visibility check after every audit
      setVisibility(null)
      runVisibilityCheck(true)
    } catch (err) {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      const msg = err instanceof Error ? err.message : 'Audit failed'
      setLogEntries(prev => [...prev, { id: ++logId.current, text: `✗ Error: ${msg}`, type: 'warn', ts: elapsed(startRef.current) }])
      setError(msg)
    } finally { setRunning(false) }
  }

  const geo = selectedAudit?.report_json.geo
  const geoPassCount = geo ? GEO_ITEMS.filter(item => geo[item.key as keyof GeoCheck] as boolean).length : 0
  const criticalCount = selectedAudit?.report_json.issues?.filter(i => i.severity === 'critical').length ?? 0

  const TABS: { id: TabId; label: string; badge?: number }[] = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'geo',      label: '🤖 AI / GEO', badge: geo ? GEO_ITEMS.length - geoPassCount : undefined },
    { id: 'issues',   label: '🔍 Issues',   badge: criticalCount > 0 ? criticalCount : undefined },
    { id: 'intel',    label: '💡 AI Intel' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Business Audit</h1>
          <p className="text-slate-400 text-sm mt-0.5">Performance · SEO · Accessibility · AI Discoverability</p>
        </div>
        {selectedAudit && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 text-sm">
              <div className="text-center">
                <div className={`text-xl font-extrabold ${selectedAudit.score >= 70 ? 'text-emerald-400' : selectedAudit.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                  {selectedAudit.score}
                </div>
                <div className="text-slate-600 text-[10px]">Site Score</div>
              </div>
              {geo && (
                <>
                  <div className="w-px h-8 bg-slate-800" />
                  <div className="text-center">
                    <div className={`text-xl font-extrabold ${geo.geo_score >= 65 ? 'text-emerald-400' : geo.geo_score >= 35 ? 'text-amber-400' : 'text-red-400'}`}>
                      {geo.geo_score}
                    </div>
                    <div className="text-slate-600 text-[10px]">GEO Score</div>
                  </div>
                  <div className="w-px h-8 bg-slate-800" />
                  <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                    geo.ai_discoverability === 'high'   ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40' :
                    geo.ai_discoverability === 'medium' ? 'bg-amber-900/30 text-amber-400 border-amber-800/40' :
                    'bg-red-900/30 text-red-400 border-red-800/40'
                  }`}>
                    {geo.ai_discoverability === 'high' ? '✓ AI Ready' : geo.ai_discoverability === 'medium' ? '⚠ Partial' : '✗ Not AI Ready'}
                  </div>
                </>
              )}
            </div>
            {/* Export Full Audit */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => exportFullPdf(selectedAudit, businessName)}
                className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                title="Export full audit as PDF"
              >
                📄 PDF
              </button>
              <button
                onClick={() => exportFullHtml(selectedAudit, businessName)}
                className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                title="Download full audit as HTML file"
              >
                ⬇ HTML
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Warning Banner ── */}
      <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 flex gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center text-xl">
          ⚠️
        </div>
        <div>
          <p className="text-amber-900 font-bold text-sm">Enter YOUR business website only</p>
          <p className="text-amber-800 text-xs mt-1 leading-relaxed">
            This URL is used by your AI agent to analyze your business, generate personalized recommendations, score your content strategy, and power all future AI insights. <strong>Entering a competitor or any other website will corrupt your AI analysis.</strong>
          </p>
        </div>
      </div>

      {/* ── Run Audit Bar ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex gap-3">
          <input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://yourdomain.com"
            className="flex-1 bg-slate-800/60 border border-slate-700 focus:border-violet-500 focus:outline-none rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-600 transition-colors"
          />
          <button onClick={runAudit} disabled={running || !urlInput.trim()}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap flex items-center gap-2">
            {running ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Auditing…</> : '▶ Run Audit'}
          </button>
        </div>
        {!websiteUrl && !running && urlInput.trim() && (
          <p className="text-xs text-amber-500 mt-2 flex items-center gap-1.5">
            <span>⚠</span> This URL won&apos;t be saved to your profile. <Link href="/settings" className="underline hover:text-amber-400">Save it in Settings</Link> to pre-fill next time.
          </p>
        )}
        {(running || logEntries.length > 0) && (
          <div className="mt-3 rounded-xl overflow-hidden border border-slate-700 bg-[#0d1117]">
            {/* Terminal header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border-b border-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
              <span className="text-slate-500 text-[11px] font-mono ml-2">CooVex AI Engine — audit activity</span>
              {running && <span className="ml-auto flex items-center gap-1.5 text-[11px] text-violet-400 font-mono"><span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />running</span>}
              {!running && logEntries.some(e => e.type === 'done') && <span className="ml-auto text-[11px] text-emerald-400 font-mono">● done</span>}
            </div>
            {/* Log body */}
            <div ref={logRef} className="px-3 py-2.5 space-y-0.5 max-h-56 overflow-y-auto font-mono text-[11px] leading-relaxed scroll-smooth">
              {logEntries.map(entry => (
                <div key={entry.id} className="flex items-start gap-2.5 animate-[fadeSlideIn_0.2s_ease]">
                  <span className="text-slate-600 shrink-0 w-10 text-right">{entry.ts}</span>
                  <span className={
                    entry.type === 'done'    ? 'text-emerald-400 font-semibold' :
                    entry.type === 'success' ? 'text-emerald-500' :
                    entry.type === 'warn'    ? 'text-red-400' :
                    entry.type === 'sub'     ? 'text-slate-500 pl-2' :
                    'text-slate-300'
                  }>
                    {entry.type === 'info' && <span className="text-violet-400 mr-1.5">›</span>}
                    {entry.type === 'success' && <span className="text-emerald-500 mr-1.5">✓</span>}
                    {entry.type === 'sub' && <span className="text-slate-600 mr-1">·</span>}
                    {entry.text}
                  </span>
                  {running && entry.id === logEntries[logEntries.length - 1]?.id && entry.type !== 'done' && (
                    <span className="w-1.5 h-3.5 bg-slate-400 animate-pulse rounded-sm shrink-0 mt-0.5" />
                  )}
                </div>
              ))}
              {running && logEntries.length === 0 && (
                <div className="text-slate-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-3.5 bg-slate-500 animate-pulse rounded-sm" />
                </div>
              )}
            </div>
          </div>
        )}
        {!running && (
          <p className="text-xs text-slate-600 mt-2 flex items-center gap-1.5">
            <span className="text-violet-500">ℹ</span>
            {websiteUrl ? 'Pre-filled from your business profile. Edit to audit any URL.' : 'Enter any URL to audit — your own site, a competitor, or a client.'}
          </p>
        )}
        {error && <p className="text-red-400 text-xs mt-2 flex items-center gap-1.5"><span>⚠</span> {error}</p>}
      </div>

      {/* ── Empty state ── */}
      {audits.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-white font-semibold mb-2">No audits yet</h2>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Run your first audit to get a full health report — performance, SEO, AI discoverability, and action items.
          </p>
        </div>
      )}

      {/* ── Main Layout ── */}
      {audits.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── LEFT: Audit History ── */}
          <div className="lg:col-span-1 space-y-2">
            <p className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider px-1">Audit History</p>
            {audits.map(audit => {
              const isSelected = selectedAudit?.id === audit.id
              const report = audit.report_json
              const auditGeo = report.geo
              return (
                <div key={audit.id} onClick={() => { setSelectedAudit(audit); setActiveTab('overview') }}
                  className={`cursor-pointer bg-slate-900 border rounded-xl p-4 transition-all group relative ${
                    isSelected ? 'border-violet-600/50 ring-1 ring-violet-600/20' : 'border-slate-800 hover:border-slate-700'
                  }`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-base font-extrabold ${audit.score >= 70 ? 'text-emerald-400' : audit.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                        {audit.score}
                      </span>
                      <span className="text-slate-600 text-xs">/100</span>
                      {auditGeo && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${
                          auditGeo.ai_discoverability === 'high'   ? 'text-emerald-400 bg-emerald-900/30 border-emerald-800/40' :
                          auditGeo.ai_discoverability === 'medium' ? 'text-amber-400 bg-amber-900/30 border-amber-800/40' :
                          'text-red-400 bg-red-900/30 border-red-800/40'
                        }`}>
                          GEO {auditGeo.geo_score}
                        </span>
                      )}
                    </div>
                    <button onClick={(e) => deleteAudit(audit.id, e)} disabled={deletingId === audit.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-red-400 p-0.5 rounded">
                      {deletingId === audit.id
                        ? <span className="inline-block w-3 h-3 border border-slate-500 border-t-transparent rounded-full animate-spin" />
                        : <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      }
                    </button>
                  </div>
                  <p className="text-slate-400 text-[11px] truncate mb-2">{report.url || 'Website'}</p>
                  <div className="flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
                    {(Object.keys(PURPOSE_META) as AuditPurpose[]).map(p => {
                      const meta = PURPOSE_META[p]
                      const isActive = (report.purpose ?? 'my_business') === p
                      return (
                        <button key={p} onClick={(e) => updatePurpose(audit.id, p, e)} disabled={updatingPurposeId === audit.id}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                            isActive ? `${meta.color} font-semibold` : 'border-slate-700 text-slate-600 hover:text-slate-400'
                          }`}>
                          {meta.icon} {meta.label}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-slate-700 text-[10px] mt-2">
                    {new Date(audit.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )
            })}
          </div>

          {/* ── RIGHT: Audit Detail ── */}
          {selectedAudit && (
            <div className="lg:col-span-2 space-y-4">

              {/* Tabs */}
              <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
                {TABS.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === tab.id ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-300'
                    }`}>
                    {tab.label}
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-red-900/40 text-red-400'
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* ── Tab: Overview ── */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-white font-semibold">Performance Overview</p>
                        <p className="text-slate-500 text-xs mt-0.5">
                          {new Date(selectedAudit.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => exportFullPdf(selectedAudit, businessName)}
                          className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                          📄 PDF
                        </button>
                        <button onClick={() => exportFullHtml(selectedAudit, businessName)}
                          className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                          ⬇ HTML
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <ScoreRing score={selectedAudit.score} size={130} />
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        {Object.entries(selectedAudit.report_json.scores || {})
                          .filter(([k]) => k !== 'overall')
                          .map(([key, val]) => (
                            <MiniScoreCard key={key} label={
                              key === 'performance' ? 'Performance' :
                              key === 'seo' ? 'SEO' :
                              key === 'accessibility' ? 'Accessibility' :
                              key === 'best_practices' ? 'Best Practices' : 'Mobile'
                            } score={val as number} />
                          ))}
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-800 flex items-center gap-2">
                      <span className="text-slate-600 text-xs">URL:</span>
                      <a href={selectedAudit.report_json.url} target="_blank" rel="noopener noreferrer"
                        className="text-violet-400 hover:text-violet-300 text-xs truncate transition-colors">
                        {selectedAudit.report_json.url}
                      </a>
                    </div>
                  </div>

                  {/* GEO summary card */}
                  {geo && (
                    <button onClick={() => setActiveTab('geo')}
                      className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 text-left transition-all group">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">🤖</span>
                          <div>
                            <p className="text-white font-semibold text-sm">AI & GEO Discoverability</p>
                            <p className="text-slate-500 text-xs">{geoPassCount}/{GEO_ITEMS.length} checks passed</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className={`text-2xl font-extrabold ${geo.geo_score >= 65 ? 'text-emerald-400' : geo.geo_score >= 35 ? 'text-amber-400' : 'text-red-400'}`}>
                              {geo.geo_score}
                            </div>
                            <div className="text-slate-600 text-[10px]">/ 100</div>
                          </div>
                          <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            geo.ai_discoverability === 'high'   ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40' :
                            geo.ai_discoverability === 'medium' ? 'bg-amber-900/30 text-amber-400 border-amber-800/40' :
                            'bg-red-900/30 text-red-400 border-red-800/40'
                          }`}>
                            {geo.ai_discoverability === 'high' ? '✓ AI Ready' : geo.ai_discoverability === 'medium' ? '⚠ Partial' : '✗ Not Ready'}
                          </div>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${
                          geo.geo_score >= 65 ? 'bg-emerald-500' : geo.geo_score >= 35 ? 'bg-amber-500' : 'bg-red-500'
                        }`} style={{ width: `${geo.geo_score}%` }} />
                      </div>
                      {geo.missing_geo.length > 0 && (
                        <p className="text-slate-500 text-xs mt-3 group-hover:text-slate-400 transition-colors">
                          {geo.missing_geo.length} item{geo.missing_geo.length > 1 ? 's' : ''} missing — click to see action plan →
                        </p>
                      )}
                    </button>
                  )}

                  {/* Recommendations */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <span>✅</span> Top Recommendations
                    </h3>
                    <div className="space-y-3">
                      {(selectedAudit.report_json.recommendations || []).map((rec, i) => (
                        <div key={i} className="flex items-start gap-3 group">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xs font-bold">
                            {i + 1}
                          </span>
                          <p className="text-slate-300 text-sm leading-relaxed pt-0.5">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab: GEO ── */}
              {activeTab === 'geo' && geo && (
                <div className="space-y-4">

                  {/* Score header */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center gap-5">
                      <ScoreRing score={geo.geo_score} size={110} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-white font-bold text-lg">AI & GEO Score</h3>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                            geo.ai_discoverability === 'high'   ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40' :
                            geo.ai_discoverability === 'medium' ? 'bg-amber-900/30 text-amber-400 border-amber-800/40' :
                            'bg-red-900/30 text-red-400 border-red-800/40'
                          }`}>
                            {geo.ai_discoverability === 'high' ? '✓ AI Ready' : geo.ai_discoverability === 'medium' ? '⚠ Partially Ready' : '✗ Not AI Ready'}
                          </span>
                        </div>
                        <p className="text-slate-400 text-sm leading-relaxed">
                          {geo.ai_discoverability === 'high'
                            ? 'Your site is well-optimized for AI search engines like Perplexity, ChatGPT, and Google SGE.'
                            : geo.ai_discoverability === 'medium'
                            ? 'Some AI optimization is in place, but key elements are missing. Fix the items below to get recommended by AI.'
                            : 'Your site is not optimized for AI search engines. AI models like ChatGPT and Perplexity may not discover or recommend your business.'
                          }
                        </p>
                        <p className="text-slate-600 text-xs mt-2">{geoPassCount}/{GEO_ITEMS.length} checks passed</p>
                      </div>
                    </div>
                  </div>

                  {/* Checklist */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <span>📋</span> GEO Checklist
                      <span className="ml-auto text-xs text-slate-500">{geoPassCount}/{GEO_ITEMS.length} passed</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {GEO_ITEMS.map(item => (
                        <GeoCheckItem key={item.key} item={item} passed={geo[item.key as keyof GeoCheck] as boolean} />
                      ))}
                    </div>
                  </div>

                  {/* Action tasks */}
                  {(geo.ai_tasks || []).length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <span>🎯</span> Action Plan
                        <span className="ml-auto text-xs text-slate-500">{geo.ai_tasks.length} tasks</span>
                      </h3>
                      <div className="space-y-3">
                        {(geo.ai_tasks || []).map((task, i) => {
                          const isOpen = aiFix?.taskTitle === task.title
                          return (
                            <div key={i} className={`border rounded-xl overflow-hidden ${
                              task.priority === 'critical' ? 'border-red-800/40' :
                              task.priority === 'high'     ? 'border-amber-800/40' :
                              'border-slate-700/40'
                            }`}>
                              <div className={`p-4 ${
                                task.priority === 'critical' ? 'bg-red-950/20' :
                                task.priority === 'high'     ? 'bg-amber-950/20' :
                                'bg-slate-800/40'
                              }`}>
                                <div className="flex items-start gap-3">
                                  <div className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase mt-0.5 ${
                                    task.priority === 'critical' ? 'bg-red-900/60 text-red-300' :
                                    task.priority === 'high'     ? 'bg-amber-900/60 text-amber-300' :
                                    'bg-slate-700 text-slate-400'
                                  }`}>
                                    {task.priority}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-semibold mb-1">{task.title}</p>
                                    <p className="text-slate-400 text-xs leading-relaxed">{task.desc}</p>
                                  </div>
                                  <button
                                    onClick={() => isOpen ? setAiFix(null) : fixWithAI(task)}
                                    disabled={aiFix?.loading && isOpen}
                                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-60"
                                  >
                                    {isOpen && aiFix?.loading ? (
                                      <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Fixing…</>
                                    ) : isOpen ? (
                                      '✕ Close'
                                    ) : (
                                      '✨ Fix with AI'
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* AI Fix Output */}
                              {isOpen && !aiFix?.loading && aiFix?.content && (
                                <div className="border-t border-slate-700/50 bg-slate-950 p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <p className="text-violet-400 text-xs font-semibold flex items-center gap-1.5">
                                      <span>✨</span> AI Generated Fix
                                    </p>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(aiFix.content)}
                                      className="text-slate-500 hover:text-slate-300 text-xs flex items-center gap-1 transition-colors"
                                    >
                                      📋 Copy all
                                    </button>
                                  </div>
                                  <div className="prose prose-invert prose-sm max-w-none">
                                    <FixOutput content={aiFix.content} />
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Live AI Visibility Check */}
                  {visibility ? (
                    <LiveVisibilityCheck visibility={visibility} geo={geo} />
                  ) : visibilityLoading ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center gap-3">
                      <span className="w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-white">Running Live AI Visibility Check...</p>
                        <p className="text-xs text-slate-500 mt-0.5">Gemini is searching to see if your business appears in AI results</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                          ✨ Live AI Visibility Check
                          <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25">Gemini Search</span>
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 mb-4">Verify whether your business is mentioned in real AI searches today.</p>
                      <button
                        onClick={() => runVisibilityCheck(false)}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
                      >
                        <span>✨</span> Run Visibility Check
                      </button>
                    </div>
                  )}

                  {/* What AI will think */}
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <span>💬</span> Will AI recommend your business?
                    </h3>
                    <div className="space-y-2 text-sm">
                      {[
                        { q: 'ChatGPT / Bing Copilot', a: geo.llms_txt && geo.structured_data ? 'Likely to recommend — llms.txt and structured data found' : 'Unlikely — add llms.txt and JSON-LD structured data', ok: geo.llms_txt && geo.structured_data },
                        { q: 'Perplexity AI',           a: geo.llms_txt && geo.sitemap_xml ? 'Can discover your site — llms.txt and sitemap present' : 'Limited discovery — missing llms.txt and/or sitemap', ok: geo.llms_txt && geo.sitemap_xml },
                        { q: 'Google SGE',              a: geo.structured_data && geo.meta_description ? 'Eligible for AI Overview — structured data found' : 'May not appear — add JSON-LD and meta descriptions', ok: geo.structured_data && geo.meta_description },
                        { q: 'Social AI crawlers',      a: geo.open_graph ? 'Rich previews enabled via Open Graph tags' : 'Plain text only — add Open Graph tags for rich previews', ok: geo.open_graph },
                      ].map((row, i) => (
                        <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${
                          row.ok ? 'bg-emerald-900/10 border-emerald-800/30' : 'bg-slate-800/60 border-slate-700/30'
                        }`}>
                          <span className={`text-sm flex-shrink-0 mt-0.5 ${row.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                            {row.ok ? '✓' : '✗'}
                          </span>
                          <div>
                            <p className="text-slate-300 font-medium text-xs">{row.q}</p>
                            <p className="text-slate-500 text-xs mt-0.5">{row.a}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab: Issues ── */}
              {activeTab === 'issues' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <span>🔍</span> Issues Found
                    <span className="ml-2 text-xs font-normal text-slate-500">({selectedAudit.report_json.issues?.length || 0})</span>
                  </h3>
                  <div className="space-y-3">
                    {(selectedAudit.report_json.issues || []).map((issue, i) => {
                      const m = SEVERITY_META[issue.severity]
                      return (
                        <div key={i} className={`border rounded-xl p-4 ${m.bg}`}>
                          <div className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${m.dot}`} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`text-[11px] font-bold uppercase ${m.color}`}>{m.label}</span>
                                <span className="text-slate-600 text-[11px] bg-slate-800/60 px-2 py-0.5 rounded-full">{issue.category}</span>
                              </div>
                              <p className="text-white text-sm font-medium">{issue.title}</p>
                              <p className="text-slate-400 text-xs mt-1 leading-relaxed">{issue.description}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Tab: AI Intel ── */}
              {activeTab === 'intel' && (() => {
                const intel = selectedAudit.report_json.intel
                const hasRealData = (intel?.services?.length ?? 0) > 0 && intel?.services?.[0] !== 'Website scan pending'
                if (!hasRealData || !intel) return (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 text-center">
                    <p className="text-4xl mb-3">🤖</p>
                    <p className="text-slate-400 text-sm">AI business intelligence not available for this audit.</p>
                    <p className="text-slate-600 text-xs mt-1">Run a new audit to extract business insights.</p>
                  </div>
                )
                return (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🤖</span>
                      <h3 className="text-slate-900 font-semibold">AI Business Intelligence</h3>
                      <span className="ml-auto text-xs text-slate-400">Extracted from website</span>
                    </div>

                    {/* Pages scanned */}
                    {(selectedAudit.report_json.pages_visited?.length ?? 0) > 0 && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <p className="text-slate-500 text-xs font-medium mb-2">📄 Pages scanned ({selectedAudit.report_json.pages_visited!.length})</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedAudit.report_json.pages_visited!.map((p, i) => {
                            const isJs = selectedAudit.report_json.js_rendered_pages?.includes(p)
                            return (
                              <a key={i} href={p} target="_blank" rel="noopener noreferrer"
                                className={`text-[11px] px-2 py-0.5 rounded-md border truncate max-w-[180px] ${
                                  isJs ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-violet-700 bg-violet-50 border-violet-200 hover:text-violet-900'
                                }`} title={isJs ? `${p} (JS-rendered)` : p}>
                                {new URL(p).pathname || '/'}{isJs ? ' ⚡' : ''}
                              </a>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {intel.description && (
                      <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
                        <p className="text-violet-900 text-sm leading-relaxed">{intel.description}</p>
                        {intel.unique_value_proposition && (
                          <p className="text-slate-500 text-xs mt-2 italic">"{intel.unique_value_proposition}"</p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      {(intel.services?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Services</p>
                          <div className="flex flex-wrap gap-1.5">
                            {intel.services!.map((s, i) => <span key={i} className="text-xs bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded-md">{s}</span>)}
                          </div>
                        </div>
                      )}
                      <div className="space-y-2">
                        {intel.industry && <div><p className="text-slate-400 text-[10px] uppercase font-semibold">Industry</p><p className="text-slate-700 text-sm">{intel.industry}</p></div>}
                        {intel.target_market && <div><p className="text-slate-400 text-[10px] uppercase font-semibold">Target Market</p><p className="text-slate-700 text-sm">{intel.target_market}</p></div>}
                        {intel.pricing_model && intel.pricing_model !== 'unknown' && <div><p className="text-slate-400 text-[10px] uppercase font-semibold">Pricing</p><p className="text-slate-700 text-sm capitalize">{intel.pricing_model}</p></div>}
                      </div>
                    </div>

                    {/* Who needs it + Pain points */}
                    {((intel.who_needs_it?.length ?? 0) > 0 || (intel.pain_points?.length ?? 0) > 0) && (
                      <div className="grid grid-cols-2 gap-3">
                        {(intel.who_needs_it?.length ?? 0) > 0 && (
                          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                            <p className="text-blue-700 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <span>👤</span> Who needs this
                            </p>
                            <ul className="space-y-2">
                              {intel.who_needs_it!.map((w, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-blue-900 leading-relaxed">
                                  <span className="text-blue-400 mt-1 flex-shrink-0">•</span>
                                  {w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {(intel.pain_points?.length ?? 0) > 0 && (
                          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
                            <p className="text-rose-700 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <span>🔥</span> Why they need it
                            </p>
                            <ul className="space-y-2">
                              {intel.pain_points!.map((p, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-rose-900 leading-relaxed">
                                  <span className="text-rose-400 mt-1 flex-shrink-0">•</span>
                                  {p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {(intel.contact?.email || intel.contact?.phone || intel.contact?.address) && (
                      <div>
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Contact Found</p>
                        <div className="flex flex-wrap gap-2">
                          {intel.contact.email && <span className="text-xs text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">✉ {intel.contact.email}</span>}
                          {intel.contact.phone && <span className="text-xs text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">📞 {intel.contact.phone}</span>}
                          {intel.contact.address && <span className="text-xs text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">📍 {intel.contact.address}</span>}
                        </div>
                      </div>
                    )}

                    {(intel.clients?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Clients / Partners ({intel.clients!.length})</p>
                        <div className="grid grid-cols-2 gap-2">
                          {intel.clients!.map((c, i) => {
                            const palette = ['bg-violet-500','bg-emerald-500','bg-blue-500','bg-amber-500','bg-rose-500','bg-cyan-500']
                            const initials = c.trim().split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase()
                            return (
                              <div key={i} className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                <div className={`w-7 h-7 rounded-full ${palette[i % palette.length]} flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0`}>{initials}</div>
                                <span className="text-slate-700 text-sm truncate">{c}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {(intel.missing_elements?.length ?? 0) > 0 && (
                      <div className="border-t border-slate-200 pt-4">
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Missing From Website</p>
                        {intel.missing_elements!.map((m, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-amber-700 py-1"><span className="text-amber-500">⚠</span> {m}</div>
                        ))}
                      </div>
                    )}

                    {(intel.ai_insights?.length ?? 0) > 0 && (
                      <div className="border-t border-slate-200 pt-4">
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">AI Insights</p>
                        <div className="space-y-2">
                          {intel.ai_insights!.map((insight, i) => (
                            <div key={i} className="flex items-start gap-2.5">
                              <span className="text-violet-500 mt-0.5 flex-shrink-0">→</span>
                              <p className="text-slate-700 text-sm leading-relaxed">{insight}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Full Report Generator ────────────────────────────────────────────────────

function generateReportHtml(audit: Audit, businessName: string): string {
  const r = audit.report_json
  const geo = r.geo
  const intel = r.intel
  const hasIntel = (intel?.services?.length ?? 0) > 0 && intel?.services?.[0] !== 'Website scan pending'

  const sc = (s: number) => s >= 70 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444'
  const gr = (s: number) => s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 60 ? 'D' : 'F'

  const GEO_ROWS = [
    { key: 'llms_txt',         label: 'llms.txt' },
    { key: 'structured_data',  label: 'JSON-LD' },
    { key: 'meta_description', label: 'Meta Description' },
    { key: 'sitemap_xml',      label: 'sitemap.xml' },
    { key: 'robots_txt',       label: 'robots.txt' },
    { key: 'open_graph',       label: 'Open Graph' },
    { key: 'https',            label: 'HTTPS' },
    { key: 'canonical_url',    label: 'Canonical URL' },
    { key: 'twitter_card',     label: 'X/Twitter Card' },
  ]
  const geoPass = geo ? GEO_ROWS.filter(i => !!(geo as Record<string, unknown>)[i.key]).length : 0
  const g = geo as Record<string, unknown> | undefined

  const scores = [
    ['Performance', r.scores?.performance],
    ['SEO', r.scores?.seo],
    ['Accessibility', r.scores?.accessibility],
    ['Best Practices', r.scores?.best_practices],
    ['Mobile', r.scores?.mobile],
  ] as [string, number][]

  const date = new Date(audit.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${businessName} — CooVex Audit Report</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#1e293b;font-size:14px}
.page{max-width:920px;margin:0 auto;padding:36px 28px}
.hdr{background:linear-gradient(135deg,#1e1b4b 0%,#312e81 60%,#1e1b4b 100%);border-radius:16px;padding:28px 32px;margin-bottom:20px;color:#fff}
.hdr-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px}
.logo{font-size:18px;font-weight:900;letter-spacing:-0.5px}
.logo span{color:#818cf8}
.meta{text-align:right;font-size:11px;color:#a5b4fc;line-height:1.6}
.meta strong{color:#fff;font-size:13px}
.scores-row{display:grid;grid-template-columns:auto 1px 1fr;gap:24px;align-items:center}
.big-score{text-align:center;min-width:90px}
.big-num{font-size:52px;font-weight:900;line-height:1}
.big-grade{font-size:16px;font-weight:700;margin-top:2px}
.big-lbl{font-size:10px;color:#a5b4fc;text-transform:uppercase;letter-spacing:.06em;margin-top:4px}
.vr{background:rgba(255,255,255,.15);align-self:stretch}
.mini-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.mini{background:rgba(255,255,255,.08);border-radius:10px;padding:10px 6px;text-align:center}
.mini-val{font-size:20px;font-weight:800;color:#fff}
.mini-lbl{font-size:9px;color:#a5b4fc;margin-top:3px}
.geo-bar{margin-top:20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.geo-score-pill{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:100px;padding:8px 18px;display:flex;align-items:baseline;gap:6px}
.geo-score-num{font-size:22px;font-weight:900}
.geo-score-sub{font-size:11px;color:#a5b4fc}
.status{padding:5px 14px;border-radius:100px;font-size:12px;font-weight:700;flex-shrink:0}
.status.high{background:#d1fae5;color:#065f46}
.status.medium{background:#fef3c7;color:#92400e}
.status.low{background:#fee2e2;color:#991b1b}
.geo-pass-txt{font-size:12px;color:#a5b4fc}
.sec{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px;margin-bottom:16px}
.sec-title{font-size:14px;font-weight:700;color:#0f172a;padding-bottom:12px;margin-bottom:16px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:6px}
.sec-count{margin-left:auto;font-size:11px;font-weight:400;color:#94a3b8}
.geo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
.gi{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:9px;border:1px solid}
.gi.p{background:#f0fdf4;border-color:#bbf7d0}
.gi.f{background:#fafafa;border-color:#e2e8f0}
.gi-dot{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0}
.gi-dot.p{background:#10b981;color:#fff}
.gi-dot.f{background:#e2e8f0;color:#94a3b8}
.gi-lbl{font-size:11px;font-family:monospace;font-weight:700}
.gi-lbl.p{color:#065f46}
.gi-lbl.f{color:#94a3b8}
.ai-row{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:9px;border:1px solid;margin-bottom:7px}
.ai-row.p{background:#f0fdf4;border-color:#bbf7d0}
.ai-row.f{background:#fafafa;border-color:#e2e8f0}
.ai-row-q{font-size:12px;font-weight:700;color:#0f172a}
.ai-row-a{font-size:11px;color:#64748b;margin-top:2px}
.ai-row-icon{font-size:15px;flex-shrink:0;margin-left:12px}
.task{border-radius:10px;padding:13px;margin-bottom:9px;border:1px solid}
.task.critical{background:#fef2f2;border-color:#fecaca}
.task.high{background:#fffbeb;border-color:#fde68a}
.task.medium{background:#eff6ff;border-color:#bfdbfe}
.task-hdr{display:flex;align-items:flex-start;gap:9px;margin-bottom:5px}
.prio{padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;flex-shrink:0;margin-top:1px}
.prio.critical{background:#fecaca;color:#991b1b}
.prio.high{background:#fde68a;color:#92400e}
.prio.medium{background:#bfdbfe;color:#1e40af}
.task-title{font-size:13px;font-weight:700;color:#0f172a}
.task-desc{font-size:12px;color:#64748b;line-height:1.6}
.issue{border-radius:10px;padding:13px;margin-bottom:9px;border:1px solid}
.issue.critical{background:#fef2f2;border-color:#fca5a5}
.issue.warning{background:#fffbeb;border-color:#fcd34d}
.issue.info{background:#eff6ff;border-color:#93c5fd}
.sev{padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;margin-right:6px}
.sev.critical{background:#fca5a5;color:#991b1b}
.sev.warning{background:#fcd34d;color:#92400e}
.sev.info{background:#93c5fd;color:#1e3a8a}
.cat{font-size:10px;color:#94a3b8;background:#f1f5f9;padding:2px 8px;border-radius:4px}
.issue-title{font-size:13px;font-weight:700;color:#0f172a;margin:5px 0 3px}
.issue-desc{font-size:12px;color:#64748b;line-height:1.6}
.rec{display:flex;gap:11px;padding:11px 0;border-bottom:1px solid #f8fafc}
.rec:last-child{border:none}
.rec-n{width:24px;height:24px;border-radius:50%;background:#7c3aed;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.rec-t{font-size:13px;color:#334155;line-height:1.6;padding-top:2px}
.intel-desc{background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:14px;margin-bottom:14px}
.intel-desc p{color:#581c87;font-size:13px;line-height:1.7}
.intel-desc em{color:#7c3aed;font-size:12px;display:block;margin-top:6px}
.intel-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.il{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:5px}
.iv{font-size:13px;color:#334155}
.tag{display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;font-size:11px;padding:3px 9px;border-radius:6px;margin:2px}
.ins{display:flex;padding:7px 0;border-bottom:1px solid #f8fafc;font-size:12px;color:#334155}
.ins:last-child{border:none}
.ins-arrow{color:#7c3aed;margin-right:8px;flex-shrink:0}
.pages{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.all-pass{background:linear-gradient(135deg,#d1fae5,#a7f3d0);border:1px solid #6ee7b7;border-radius:10px;padding:14px;text-align:center;color:#065f46;font-weight:600;font-size:14px}
.footer{text-align:center;padding:20px 0 0;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;margin-top:20px}
.footer strong{color:#7c3aed}
@media print{
  body{background:#fff}
  .page{padding:16px}
  .sec{break-inside:avoid;margin-bottom:12px;box-shadow:none}
  @page{margin:.8cm}
}
</style>
</head>
<body>
<div class="page">

<!-- HEADER -->
<div class="hdr">
  <div class="hdr-top">
    <div>
      <div class="logo">Coo<span>Vex</span></div>
      <div style="font-size:12px;color:#c7d2fe;margin-top:3px">Business Audit Report</div>
    </div>
    <div class="meta">
      <strong>${businessName}</strong>
      <div>${r.url || 'Website'}</div>
      <div>${date}</div>
    </div>
  </div>
  <div class="scores-row">
    <div class="big-score">
      <div class="big-num" style="color:${sc(audit.score)}">${audit.score}</div>
      <div class="big-grade" style="color:${sc(audit.score)}">${gr(audit.score)}</div>
      <div class="big-lbl">Site Score</div>
    </div>
    <div class="vr"></div>
    <div class="mini-grid">
      ${scores.map(([lbl, val]) => `<div class="mini"><div class="mini-val" style="color:${sc(val)}">${val}</div><div class="mini-lbl">${lbl}</div></div>`).join('')}
    </div>
  </div>
  ${geo ? `<div class="geo-bar">
    <div class="geo-score-pill">
      <div class="geo-score-num" style="color:${sc(geo.geo_score)}">${geo.geo_score}</div>
      <div class="geo-score-sub">/100 GEO</div>
    </div>
    <span class="status ${geo.ai_discoverability}">${geo.ai_discoverability === 'high' ? '✓ AI Ready' : geo.ai_discoverability === 'medium' ? '⚠ Partially Ready' : '✗ Not AI Ready'}</span>
    <span class="geo-pass-txt">${geoPass}/9 checks passed</span>
  </div>` : ''}
</div>

<!-- GEO CHECKLIST -->
${geo ? `<div class="sec">
  <div class="sec-title">🤖 AI &amp; GEO Discoverability<span class="sec-count">${geoPass}/9 passed</span></div>
  <div class="geo-grid">
    ${GEO_ROWS.map(item => {
      const p = !!g?.[item.key]
      return `<div class="gi ${p ? 'p' : 'f'}"><div class="gi-dot ${p ? 'p' : 'f'}">${p ? '✓' : '✗'}</div><span class="gi-lbl ${p ? 'p' : 'f'}">${item.label}</span></div>`
    }).join('')}
  </div>
  <div style="margin-top:14px;padding-top:14px;border-top:1px solid #f1f5f9">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:9px">AI Engine Visibility</div>
    ${[
      { q: 'ChatGPT / Bing Copilot', ok: geo.llms_txt && geo.structured_data, yes: 'Likely to recommend — llms.txt and structured data found', no: 'Unlikely — add llms.txt and JSON-LD structured data' },
      { q: 'Perplexity AI',          ok: geo.llms_txt && geo.sitemap_xml,    yes: 'Can discover your site — llms.txt and sitemap present',   no: 'Limited — missing llms.txt and/or sitemap' },
      { q: 'Google SGE',             ok: geo.structured_data && geo.meta_description, yes: 'Eligible for AI Overview — structured data found', no: 'May not appear — add JSON-LD and meta descriptions' },
      { q: 'Social AI crawlers',     ok: geo.open_graph, yes: 'Rich previews enabled via Open Graph tags', no: 'Plain text only — add Open Graph tags' },
    ].map(row => `<div class="ai-row ${row.ok ? 'p' : 'f'}">
      <div><div class="ai-row-q">${row.q}</div><div class="ai-row-a">${row.ok ? row.yes : row.no}</div></div>
      <div class="ai-row-icon" style="color:${row.ok ? '#10b981' : '#ef4444'}">${row.ok ? '✓' : '✗'}</div>
    </div>`).join('')}
  </div>
</div>` : ''}

<!-- ACTION PLAN -->
${geo ? `<div class="sec">
  <div class="sec-title">🎯 GEO Action Plan<span class="sec-count">${(geo.ai_tasks || []).length} tasks</span></div>
  ${(geo.ai_tasks || []).length === 0
    ? '<div class="all-pass">🎉 All GEO checks passed — your site is fully optimized for AI search engines!</div>'
    : (geo.ai_tasks || []).map(task => `<div class="task ${task.priority}">
        <div class="task-hdr"><span class="prio ${task.priority}">${task.priority}</span><div class="task-title">${task.title}</div></div>
        <div class="task-desc">${task.desc}</div>
      </div>`).join('')}
</div>` : ''}

<!-- ISSUES -->
<div class="sec">
  <div class="sec-title">🔍 Issues Found<span class="sec-count">${(r.issues || []).length} total</span></div>
  ${(r.issues || []).length === 0
    ? '<p style="color:#64748b;font-size:13px">No issues found.</p>'
    : (r.issues || []).map(issue => `<div class="issue ${issue.severity}">
        <div style="margin-bottom:4px"><span class="sev ${issue.severity}">${issue.severity}</span><span class="cat">${issue.category}</span></div>
        <div class="issue-title">${issue.title}</div>
        <div class="issue-desc">${issue.description}</div>
      </div>`).join('')}
</div>

<!-- RECOMMENDATIONS -->
<div class="sec">
  <div class="sec-title">✅ Top Recommendations</div>
  ${(r.recommendations || []).map((rec, i) => `<div class="rec"><div class="rec-n">${i + 1}</div><div class="rec-t">${rec}</div></div>`).join('')}
</div>

<!-- AI INTEL -->
${hasIntel && intel ? `<div class="sec">
  <div class="sec-title">💡 AI Business Intelligence<span class="sec-count">Extracted from website</span></div>
  ${intel.description ? `<div class="intel-desc">
    <p>${intel.description}</p>
    ${intel.unique_value_proposition ? `<em>"${intel.unique_value_proposition}"</em>` : ''}
  </div>` : ''}
  <div class="intel-grid">
    ${intel.industry        ? `<div><div class="il">Industry</div><div class="iv">${intel.industry}</div></div>` : ''}
    ${intel.target_market   ? `<div><div class="il">Target Market</div><div class="iv">${intel.target_market}</div></div>` : ''}
    ${intel.pricing_model && intel.pricing_model !== 'unknown' ? `<div><div class="il">Pricing Model</div><div class="iv" style="text-transform:capitalize">${intel.pricing_model}</div></div>` : ''}
    ${intel.contact?.email  ? `<div><div class="il">Email</div><div class="iv">${intel.contact.email}</div></div>` : ''}
  </div>
  ${(intel.services?.length ?? 0) > 0 ? `<div style="margin-bottom:14px"><div class="il">Services</div>${intel.services!.map(s => `<span class="tag">${s}</span>`).join('')}</div>` : ''}
  ${(intel.who_needs_it?.length ?? 0) > 0 || (intel.pain_points?.length ?? 0) > 0 ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
    ${(intel.who_needs_it?.length ?? 0) > 0 ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px"><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#1d4ed8;margin-bottom:10px">👤 Who needs this</div><ul style="list-style:none;padding:0;margin:0">${intel.who_needs_it!.map(w => `<li style="font-size:14px;color:#1e3a8a;padding:4px 0;padding-left:14px;line-height:1.6">• ${w}</li>`).join('')}</ul></div>` : ''}
    ${(intel.pain_points?.length ?? 0) > 0 ? `<div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;padding:16px"><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#be123c;margin-bottom:10px">🔥 Why they need it</div><ul style="list-style:none;padding:0;margin:0">${intel.pain_points!.map(p => `<li style="font-size:14px;color:#881337;padding:4px 0;padding-left:14px;line-height:1.6">• ${p}</li>`).join('')}</ul></div>` : ''}
  </div>` : ''}
  ${(intel.ai_insights?.length ?? 0) > 0 ? `<div><div class="il">AI Insights</div>${intel.ai_insights!.map(ins => `<div class="ins"><span class="ins-arrow">→</span>${ins}</div>`).join('')}</div>` : ''}
  ${(r.pages_visited?.length ?? 0) > 0 ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #f1f5f9"><div class="il">Pages Scanned (${r.pages_visited!.length})</div><div class="pages">${r.pages_visited!.map(p => { try { return `<span class="tag">${new URL(p).pathname||'/'}</span>` } catch { return `<span class="tag">${p}</span>` } }).join('')}</div></div>` : ''}
</div>` : ''}

<div class="footer">Generated by <strong>CooVex</strong> — AI Business Agent &nbsp;·&nbsp; ${today}</div>
</div>
</body>
</html>`
}

function exportFullPdf(audit: Audit, businessName: string) {
  const html = generateReportHtml(audit, businessName)
  const win = window.open('', '_blank', 'width=1060,height=860')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 700)
}

function exportFullHtml(audit: Audit, businessName: string) {
  const html = generateReportHtml(audit, businessName)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const date = new Date().toISOString().slice(0, 10)
  a.download = `coovex-audit-${businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${date}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
