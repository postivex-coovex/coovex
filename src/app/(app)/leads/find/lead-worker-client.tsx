'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface AuditOption {
  id: string
  score: number
  url: string
  created_at: string
  hasIntel: boolean
}

interface ICP {
  company_types: string[]
  company_size: string
  decision_maker_titles: string[]
  industries: string[]
  pain_points: string[]
  search_queries: string[]
}

interface LeadCandidate {
  name: string
  company: string
  title?: string
  website?: string
  email?: string
  phone?: string
  all_emails?: string[]
  all_phones?: string[]
  fit_score: number
  fit_reason: string
  source?: string
  is_real: boolean
}

interface LeadWorkerClientProps {
  audits: AuditOption[]
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#2563eb' : score >= 60 ? '#64748b' : '#6366f1'
  return (
    <div className="flex items-center gap-1.5">
      <svg width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="10" fill="none" stroke="#e2e8f0" strokeWidth="4" className="dark:stroke-slate-700" />
        <circle cx="14" cy="14" r="10" fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${(score / 100) * 62.8} 62.8`}
          strokeLinecap="round" transform="rotate(-90 14 14)" />
        <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="8" fontWeight="700">{score}</text>
      </svg>
    </div>
  )
}

function FitBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-blue-600' : score >= 60 ? 'bg-slate-600' : 'bg-slate-400'
  const textColor = score >= 80 ? 'text-blue-600 dark:text-blue-400' : score >= 60 ? 'text-slate-600 dark:text-slate-500' : 'text-slate-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold w-7 text-right ${textColor}`}>{score}</span>
    </div>
  )
}

export function LeadWorkerClient({ audits }: LeadWorkerClientProps) {
  const [selectedAuditId, setSelectedAuditId] = useState<string>(
    audits.find(a => a.hasIntel)?.id ?? audits[0]?.id ?? ''
  )
  const [icp, setIcp] = useState<ICP | null>(null)
  const [candidates, setCandidates] = useState<LeadCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingPrev, setLoadingPrev] = useState(true)
  const [error, setError] = useState('')
  const [addingId, setAddingId] = useState<number | null>(null)
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set())
  const [hasRealResults, setHasRealResults] = useState(false)
  const [setup, setSetup] = useState<{ tavily: boolean; hunter: boolean } | null>(null)
  const [lastSearchAt, setLastSearchAt] = useState<Date | null>(null)

  // Load last search from DB on mount
  useEffect(() => {
    fetch('/api/leads/find')
      .then(r => r.json())
      .then(data => {
        const s = data.search
        if (s) {
          setIcp(s.icp)
          setCandidates(s.candidates ?? [])
          setHasRealResults(s.has_real_results ?? false)
          setLastSearchAt(new Date(s.created_at))
          if (s.audit_id) setSelectedAuditId(s.audit_id)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPrev(false))
  }, [])

  const selectedAudit = audits.find(a => a.id === selectedAuditId)

  const findLeads = async () => {
    if (!selectedAuditId) return
    setLoading(true)
    setError('')
    setIcp(null)
    setCandidates([])
    try {
      const res = await fetch('/api/leads/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: selectedAuditId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to find leads')
      setIcp(data.icp)
      setCandidates(data.candidates || [])
      setHasRealResults(data.has_real_results ?? false)
      setSetup(data.setup ?? null)
      setLastSearchAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const addLead = async (candidate: LeadCandidate, idx: number) => {
    setAddingId(idx)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: candidate.name,
          company: candidate.company,
          title: candidate.title ?? '',
          email: candidate.email ?? candidate.all_emails?.[0] ?? '',
          phone: candidate.phone ?? candidate.all_phones?.[0] ?? '',
          website: candidate.website ?? '',
          source: 'ai_worker',
          stage: 'new',
          notes: [
            `AI Lead Worker — Fit Score: ${candidate.fit_score}/100`,
            candidate.fit_reason,
            candidate.all_emails && candidate.all_emails.length > 1
              ? `All emails: ${candidate.all_emails.join(', ')}`
              : '',
            candidate.all_phones && candidate.all_phones.length > 1
              ? `All phones: ${candidate.all_phones.join(', ')}`
              : '',
          ].filter(Boolean).join('\n'),
        }),
      })
      if (res.ok) setAddedIds(prev => new Set([...prev, idx]))
    } catch { /* ignore */ }
    finally { setAddingId(null) }
  }

  if (loadingPrev) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-96 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse mb-6" />
        <div className="h-48 bg-slate-100 dark:bg-slate-800/40 rounded-2xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/leads" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm transition-colors">← Leads</Link>
        <span className="text-slate-300 dark:text-slate-700">/</span>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AI Lead Worker</h1>
        <span className="text-xs bg-blue-50 dark:bg-slate-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-slate-700/40 px-2 py-0.5 rounded-full font-medium">Beta</span>
      </div>
      <p className="text-slate-500 text-sm mb-6">
        AI reads your selected Business Audit to understand your services, then builds an Ideal Customer Profile and searches for matching leads.
      </p>

      {/* Audit selector + trigger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <span>📋</span> Select Business Audit
        </h2>

        {audits.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-slate-500 text-sm mb-3">No audits found. Run a Business Audit first so AI knows your services and target market.</p>
            <Link href="/audit" className="text-blue-600 hover:text-blue-500 text-sm font-medium">→ Run Business Audit</Link>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {audits.map(audit => (
              <label
                key={audit.id}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  selectedAuditId === audit.id
                    ? 'border-blue-500 bg-white dark:bg-slate-800'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="audit"
                  value={audit.id}
                  checked={selectedAuditId === audit.id}
                  onChange={() => setSelectedAuditId(audit.id)}
                  className="accent-violet-600"
                />
                <ScoreRing score={audit.score} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{audit.url}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(audit.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {audit.hasIntel && <span className="ml-2 text-blue-500">✓ AI intel available</span>}
                    {!audit.hasIntel && <span className="ml-2 text-slate-600">⚠ Re-run audit for better results</span>}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}

        <button
          onClick={findLeads}
          disabled={loading || !selectedAuditId || audits.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Building ICP & Searching…
            </>
          ) : '⚡ Find Leads with AI'}
        </button>
        {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
      </div>

      {/* API Setup Status */}
      {setup && (!setup.tavily || !setup.hunter) && (
        <div className="bg-blue-50 dark:bg-blue-950/10 border border-blue-200 dark:border-blue-800/30 rounded-2xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1 flex items-center gap-2">
            <span>🔌</span> Unlock Real Lead Search
          </h3>
          <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
            Add these free API keys to <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">.env.local</code> to enable real web search and email discovery.
          </p>
          <div className="space-y-2">
            {!setup.tavily && (
              <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 rounded-xl px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Tavily Search <span className="text-[10px] bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-500 px-1.5 py-0.5 rounded ml-1">Not configured</span></p>
                  <p className="text-xs text-slate-500">AI-powered web search — 1,000 free calls/month</p>
                  <code className="text-[10px] text-slate-400">TAVILY_API_KEY=tvly-...</code>
                </div>
                <a href="https://tavily.com" target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                  Get Free Key ↗
                </a>
              </div>
            )}
            {!setup.hunter && (
              <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 rounded-xl px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Hunter.io Email Finder <span className="text-[10px] bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-500 px-1.5 py-0.5 rounded ml-1">Not configured</span></p>
                  <p className="text-xs text-slate-500">Finds decision-maker emails from company domains — 25 free/month</p>
                  <code className="text-[10px] text-slate-400">HUNTER_API_KEY=...</code>
                </div>
                <a href="https://hunter.io" target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                  Get Free Key ↗
                </a>
              </div>
            )}
            {setup.tavily && !setup.hunter && (
              <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                <span>✓</span> Tavily configured — real web search active
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {icp && lastSearchAt && !loading && (
        <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
          <span>
            Last search: {lastSearchAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={() => { setIcp(null); setCandidates([]); setAddedIds(new Set()); setLastSearchAt(null) }}
            className="text-rose-400 hover:text-rose-300 transition-colors"
          >
            ✕ Clear results
          </button>
        </div>
      )}
      {icp && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ICP */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span>🎯</span> Ideal Customer Profile
                <span className="text-[10px] bg-blue-50 dark:bg-slate-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded ml-auto">AI Generated</span>
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Company Types</p>
                  <div className="flex flex-wrap gap-1.5">
                    {icp.company_types.map((t, i) => (
                      <span key={i} className="text-xs bg-blue-50 dark:bg-slate-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-slate-700/40 px-2 py-0.5 rounded-md">{t}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Company Size</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{icp.company_size}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Decision Makers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {icp.decision_maker_titles.map((t, i) => (
                      <span key={i} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md">{t}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Industries</p>
                  <div className="flex flex-wrap gap-1.5">
                    {icp.industries.map((ind, i) => (
                      <span key={i} className="text-xs bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/30 px-2 py-0.5 rounded-md">{ind}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Pain Points</p>
                  <div className="space-y-1">
                    {icp.pain_points.map((p, i) => (
                      <div key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                        <span className="text-slate-600 mt-0.5 flex-shrink-0">•</span> {p}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={findLeads}
              disabled={loading}
              className="w-full text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2 rounded-xl transition-colors"
            >
              🔄 Search Again
            </button>
          </div>

          {/* Candidates */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Lead Candidates
                <span className="ml-2 text-slate-400 font-normal">({candidates.length} found)</span>
              </h2>
              <div className="flex items-center gap-2">
                {!hasRealResults && (
                  <span className="text-xs bg-slate-100 dark:bg-slate-950/20 text-slate-700 dark:text-slate-500 border border-slate-300 dark:border-slate-700/30 px-2 py-0.5 rounded-full">
                    ⚠ AI-Generated (web search unavailable)
                  </span>
                )}
                {hasRealResults && (
                  <span className="text-xs bg-blue-50 dark:bg-slate-950/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-slate-700/30 px-2 py-0.5 rounded-full">
                    ✓ From web search
                  </span>
                )}
              </div>
            </div>

            {!hasRealResults && (
              <div className="bg-slate-100 dark:bg-slate-950/10 border border-slate-300 dark:border-slate-700/30 rounded-xl px-4 py-3 mb-4 text-xs text-slate-700 dark:text-slate-500">
                <strong>Note:</strong> Web search is currently unavailable. These profiles were generated by AI based on your ICP — they represent the <em>type</em> of company you should target, not real verified contacts. Use them as outreach templates or search manually on LinkedIn/Apollo.
              </div>
            )}

            <div className="space-y-3">
              {[...candidates].sort((a, b) => b.fit_score - a.fit_score).map((c, i) => {
                const isAdded = addedIds.has(i)
                const isAdding = addingId === i
                return (
                  <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {c.name.trim()[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-slate-900 dark:text-white text-sm">{c.name}</p>
                              {!c.is_real && <span className="text-[10px] text-slate-600 dark:text-slate-500 bg-slate-100 dark:bg-slate-950/20 border border-slate-300 dark:border-slate-700/30 px-1.5 py-0.5 rounded">AI Profile</span>}
                              {c.is_real && <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-slate-950/20 border border-blue-200 dark:border-slate-700/30 px-1.5 py-0.5 rounded">Real</span>}
                            </div>
                            <p className="text-slate-500 text-xs">
                              {c.title ? `${c.title} @ ` : ''}<span className="text-slate-700 dark:text-slate-300">{c.company}</span>
                              {c.website && (
                                <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="ml-1.5 text-blue-500 hover:text-blue-600"
                                  title="Visit website"
                                >↗</a>
                              )}
                            </p>
                            {/* Contact info */}
                            <div className="mt-1.5 space-y-1">
                              {/* Emails */}
                              {(c.all_emails?.length ?? 0) > 0 ? (
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                  {c.all_emails!.map((e, ei) => (
                                    <a key={ei} href={`mailto:${e}`}
                                      className={`text-xs flex items-center gap-1 ${ei === 0 ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-400'}`}>
                                      <span className="text-slate-400">✉</span> {e}
                                    </a>
                                  ))}
                                </div>
                              ) : c.email ? (
                                <a href={`mailto:${c.email}`} className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                  <span className="text-slate-400">✉</span> {c.email}
                                </a>
                              ) : c.website ? (
                                <p className="text-xs text-slate-400">
                                  Email not found —{' '}
                                  <a href={`https://${c.website.replace(/^https?:\/\//, '')}/contact`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="text-blue-500 hover:text-blue-600">
                                    check contact page ↗
                                  </a>
                                </p>
                              ) : null}

                              {/* Phones */}
                              {(c.all_phones?.length ?? 0) > 0 ? (
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                  {c.all_phones!.map((p, pi) => (
                                    <a key={pi} href={`tel:${p.replace(/\s/g, '')}`}
                                      className={`text-xs flex items-center gap-1 ${pi === 0 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>
                                      <span className="text-slate-400">📞</span> {p}
                                    </a>
                                  ))}
                                </div>
                              ) : c.phone ? (
                                <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                  <span className="text-slate-400">📞</span> {c.phone}
                                </a>
                              ) : null}
                            </div>
                          </div>
                          <button
                            onClick={() => addLead(c, i)}
                            disabled={isAdded || isAdding}
                            className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                              isAdded
                                ? 'bg-blue-50 dark:bg-slate-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-slate-700/40 cursor-default'
                                : 'bg-blue-600 hover:bg-blue-500 text-white'
                            }`}
                          >
                            {isAdding ? '…' : isAdded ? '✓ Added' : '+ Add Lead'}
                          </button>
                        </div>
                        <div className="mt-2">
                          <FitBar score={c.fit_score} />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 leading-relaxed">{c.fit_reason}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="text-slate-400 text-xs mt-4 text-center">
              {hasRealResults
                ? 'Leads added to your pipeline with source "AI Worker". Verify email/phone before outreach.'
                : 'These are AI-generated profile templates. Search on LinkedIn/Apollo/Hunter.io to find real contacts matching this profile.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
