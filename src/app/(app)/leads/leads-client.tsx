'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Lead } from '@/types'
import { cn } from '@/lib/utils'
import { AIPageContext } from '@/components/ui/ai-page-context'
import { FindLeadsTab } from '@/components/leads/find-leads-tab'

interface LeadsClientProps {
  leads: Lead[]
  businessId: string
}

function LeadAvatar({ name, email, website, size = 7 }: { name: string; email?: string | null; website?: string | null; size?: number }) {
  const initial  = name[0]?.toUpperCase() ?? '?'
  const domain   = (() => {
    if (website) { try { return new URL(website).hostname.replace('www.', '') } catch {} }
    if (email)   { const d = email.split('@')[1]; if (d) return d }
    return null
  })()
  const [step, setStep] = useState<'clearbit' | 'favicon' | 'initials'>(domain ? 'clearbit' : 'initials')
  const sizeClass = `w-${size} h-${size}`

  if (!domain || step === 'initials') {
    return (
      <div className={`${sizeClass} rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-300 text-xs font-bold flex-shrink-0`}>
        {initial}
      </div>
    )
  }

  const src = step === 'clearbit'
    ? `https://logo.clearbit.com/${domain}`
    : `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt={name}
      className={`${sizeClass} rounded-full object-contain bg-white p-0.5 border border-slate-700 flex-shrink-0`}
      onError={() => setStep(prev => prev === 'clearbit' ? 'favicon' : 'initials')}
    />
  )
}

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal_sent: 'Proposal Sent',
  won: 'Won',
  lost: 'Lost',
}

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  contacted: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  qualified: 'bg-slate-600/20 text-slate-400 border-slate-500/30',
  proposal_sent: 'bg-blue-600/20 text-slate-400 border-slate-500/30',
  won: 'bg-blue-600/20 text-blue-300 border-blue-500/30',
  lost: 'bg-red-500/20 text-red-300 border-red-500/30',
}

const SOURCE_LABELS: Record<string, string> = {
  website_form: 'Website', linkedin: 'LinkedIn', facebook: 'Facebook',
  google_ads: 'Google Ads', referral: 'Referral', manual: 'Manual',
  email: 'Email', other: 'Other',
}

type ViewType = 'list' | 'pipeline'
type TabType  = 'leads' | 'reddit'

export function LeadsClient({ leads, businessId }: LeadsClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab]     = useState<TabType>('leads')
  const [view, setView]               = useState<ViewType>('list')
  const [search, setSearch]           = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [showAdd, setShowAdd]         = useState(false)
  const [importing, setImporting]     = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [localLeads, setLocalLeads]   = useState<Lead[]>(leads)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [campaignName, setCampaignName] = useState('')
  const [campaignSubject, setCampaignSubject] = useState('')
  const [creatingCampaign, setCreatingCampaign] = useState(false)

  // Sync when server re-sends fresh leads after router.refresh()
  useEffect(() => { setLocalLeads(leads) }, [leads])

  const stages = ['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost']

  function toggleSelectLead(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleSelectAll() {
    setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(l => l.id)))
  }

  async function createCampaign() {
    if (!campaignName.trim() || !campaignSubject.trim()) return
    setCreatingCampaign(true)
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName.trim(),
          subject: campaignSubject.trim(),
          lead_ids: [...selectedIds],
        }),
      })
      if (res.ok) {
        setShowCampaignModal(false)
        setCampaignName('')
        setCampaignSubject('')
        setSelectedIds(new Set())
        router.push('/campaigns')
      }
    } finally { setCreatingCampaign(false) }
  }

  async function moveStage(leadId: string, newStage: string) {
    setLocalLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage as Lead['stage'] } : l))
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    })
  }

  const filtered = localLeads.filter(lead => {
    const matchSearch = !search ||
      lead.name.toLowerCase().includes(search.toLowerCase()) ||
      lead.email?.toLowerCase().includes(search.toLowerCase()) ||
      lead.company?.toLowerCase().includes(search.toLowerCase())
    const matchStage = stageFilter === 'all' || lead.stage === stageFilter
    return matchSearch && matchStage
  })

  const byStage = stages.reduce<Record<string, Lead[]>>((acc, s) => {
    acc[s] = localLeads.filter(l => l.stage === s)
    return acc
  }, {})

  const totalPipeline = localLeads
    .filter(l => !['won', 'lost'].includes(l.stage))
    .reduce((sum, l) => sum + (l.score || 0), 0)
  const wonCount = localLeads.filter(l => l.stage === 'won').length
  const newToday = localLeads.filter(l => {
    const d = new Date(l.created_at)
    return d.toDateString() === new Date().toDateString()
  }).length

  async function handleImport(file: File) {
    setImporting(true)
    setImportResult(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res  = await fetch('/api/leads/import', { method: 'POST', body: form })
      const data = await res.json()
      if (data.ok) {
        setImportResult({ imported: data.imported, skipped: data.skipped })
        router.refresh()
      } else {
        alert(data.error || 'Import failed')
      }
    } catch {
      alert('Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <AIPageContext
        title="AI Lead Intelligence"
        subtitle="Every lead is automatically scored, categorized, and matched to your products — so you know exactly who to follow up with first."
        accent="emerald"
        automations={[
          'Auto-scores leads by engagement, source & profile quality',
          'Matches each lead to your products/services',
          'Flags hot leads that need immediate follow-up',
          'Detects duplicate and cold leads automatically',
          'Tracks lead journey from capture to close',
        ]}
        manual={['Follow up with qualified leads', 'Move leads through pipeline stages', 'Add notes & context']}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">Track and manage your sales pipeline</p>
        </div>
        {activeTab === 'leads' && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer">
              <span>📥</span>
              <span>{importing ? 'Importing…' : 'Import CSV'}</span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) { handleImport(file); e.target.value = '' }
                }}
              />
            </label>
            <Link href="/leads/find"
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              🤖 AI Find Leads
            </Link>
            <Link href="/leads/integrations"
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              🔗 Integrations
            </Link>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <span className="text-lg leading-none">+</span> Add Lead
            </button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('leads')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeTab === 'leads'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          )}
        >
          <span>👥</span> AI Leads
        </button>
        <button
          onClick={() => setActiveTab('reddit')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeTab === 'reddit'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          )}
        >
          <span>🔍</span> Find Leads
        </button>
      </div>

      {/* ── Find Leads tab ── */}
      {activeTab === 'reddit' && <FindLeadsTab businessId={businessId} />}

      {/* ── AI Leads tab ── */}
      {activeTab === 'leads' && (
        <>
          {/* Import toast */}
          {(importing || importResult) && (
            <div className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm',
              importing
                ? 'bg-slate-900 border-slate-700 text-slate-300'
                : 'bg-slate-950/50 border-slate-700/50 text-blue-300'
            )}>
              {importing ? (
                <><span className="animate-spin">⏳</span> Importing CSV...</>
              ) : (
                <>
                  <span>✅</span>
                  <span>
                    <strong>{importResult!.imported}</strong> leads imported,{' '}
                    <strong>{importResult!.skipped}</strong> skipped (duplicates or missing name).
                  </span>
                  <button onClick={() => setImportResult(null)} className="ml-auto text-slate-500 hover:text-slate-300">✕</button>
                </>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Leads',    value: leads.length,   icon: '👥' },
              { label: 'New Today',      value: newToday,       icon: '🆕' },
              { label: 'Won This Month', value: wonCount,       icon: '🏆' },
              { label: 'Pipeline Score', value: totalPipeline,  icon: '📊' },
            ].map(stat => (
              <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-500 text-xs">{stat.label}</span>
                  <span className="text-lg">{stat.icon}</span>
                </div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Filters + view toggle */}
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search leads..."
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors flex-1 min-w-48 max-w-xs"
            />
            <select
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors appearance-none"
            >
              <option value="all">All stages</option>
              {stages.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
            <div className="ml-auto flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 gap-1">
              {(['list', 'pipeline'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                    view === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  )}
                >
                  {v === 'pipeline' ? '🎯 Pipeline' : '☰ List'}
                </button>
              ))}
            </div>
          </div>

          {/* List view */}
          {view === 'list' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {filtered.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="text-4xl mb-4">👥</div>
                  <p className="text-slate-400 font-medium">No leads yet</p>
                  <p className="text-slate-600 text-sm mt-1">Add your first lead or connect your lead sources</p>
                  <button
                    onClick={() => setShowAdd(true)}
                    className="mt-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    + Add First Lead
                  </button>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-4 py-3 w-8" onClick={toggleSelectAll}>
                        <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                          selectedIds.size === filtered.length && filtered.length > 0 ? 'bg-blue-600 border-blue-600' : 'border-slate-600 hover:border-slate-400'
                        }`}>
                          {selectedIds.size === filtered.length && filtered.length > 0 && (
                            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M5 12l5 5L20 7"/></svg>
                          )}
                        </div>
                      </th>
                      <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Name</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Company</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Source</th>
                      <th className="text-center text-xs font-medium text-slate-500 px-3 py-3">Research</th>
                      <th className="text-center text-xs font-medium text-slate-500 px-3 py-3">Email</th>
                      <th className="text-center text-xs font-medium text-slate-500 px-3 py-3">Call</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Stage</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Score</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(lead => (
                      <tr
                        key={lead.id}
                        onClick={() => router.push(`/leads/${lead.id}`)}
                        className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer ${selectedIds.has(lead.id) ? 'bg-slate-950/20' : ''}`}
                      >
                        <td className="px-4 py-3 w-8" onClick={e => toggleSelectLead(lead.id, e)}>
                          <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors ${
                            selectedIds.has(lead.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-600 hover:border-blue-500'
                          }`}>
                            {selectedIds.has(lead.id) && (
                              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M5 12l5 5L20 7"/></svg>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <LeadAvatar name={lead.name} email={lead.email} website={lead.website} size={7} />
                            <div>
                              <p className="text-white text-sm font-medium">{lead.name}</p>
                              {lead.email && <p className="text-slate-500 text-xs">{lead.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-sm">{lead.company || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-slate-400 text-xs">{SOURCE_LABELS[lead.source] || lead.source}</span>
                        </td>
                        {/* Research done */}
                        <td className="px-3 py-3 text-center">
                          {lead.research_data
                            ? <span title="Research done" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs">✓</span>
                            : <span title="No research" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-slate-600 text-xs">—</span>
                          }
                        </td>
                        {/* Email draft done */}
                        <td className="px-3 py-3 text-center">
                          {lead.research_data?.email_draft_done
                            ? <span title="Email drafted" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs">✓</span>
                            : <span title="No email drafted" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-slate-600 text-xs">—</span>
                          }
                        </td>
                        {/* Call script done */}
                        <td className="px-3 py-3 text-center">
                          {lead.research_data?.call_script_done
                            ? <span title="Call script ready" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs">✓</span>
                            : <span title="No call script" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-slate-600 text-xs">—</span>
                          }
                        </td>
                        {/* Inline stage change */}
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <select
                            value={lead.stage}
                            onChange={e => moveStage(lead.id, e.target.value)}
                            className={cn(
                              'text-xs font-medium px-2 py-1 rounded-full border bg-transparent cursor-pointer outline-none',
                              STAGE_COLORS[lead.stage]
                            )}
                          >
                            {stages.map(s => (
                              <option key={s} value={s} className="bg-slate-900 text-slate-200">
                                {STAGE_LABELS[s]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-800 rounded-full h-1.5">
                              <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${lead.score}%` }} />
                            </div>
                            <span className="text-slate-400 text-xs">{lead.score}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Selection action bar */}
          {selectedIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 border border-slate-700/50 shadow-2xl shadow-violet-900/30 px-5 py-3 rounded-2xl">
              <span className="text-slate-300 text-sm font-medium">{selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''} selected</span>
              <div className="w-px h-4 bg-slate-700" />
              <button
                onClick={() => setShowCampaignModal(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-1.5 rounded-xl transition-colors"
              >
                📣 Create Campaign
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
                Clear
              </button>
            </div>
          )}

          {/* Campaign creation modal */}
          {showCampaignModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md mx-4 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-semibold">New Campaign</h3>
                    <p className="text-slate-500 text-xs mt-0.5">{selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''} will be added as recipients</p>
                  </div>
                  <button onClick={() => setShowCampaignModal(false)} className="text-slate-400 hover:text-white text-xl transition-colors">×</button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">Campaign Name</label>
                    <input
                      value={campaignName}
                      onChange={e => setCampaignName(e.target.value)}
                      placeholder="e.g. Digital Marketing Outreach July"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">Email Subject</label>
                    <input
                      value={campaignSubject}
                      onChange={e => setCampaignSubject(e.target.value)}
                      placeholder="e.g. Quick question about your business"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setShowCampaignModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium py-2.5 rounded-xl transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={createCampaign}
                    disabled={creatingCampaign || !campaignName.trim() || !campaignSubject.trim()}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    {creatingCampaign
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</>
                      : '📣 Create Campaign'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pipeline view */}
          {view === 'pipeline' && (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-4 min-w-max">
                {stages.map((stage, stageIdx) => {
                  const stageLeads = byStage[stage] || []
                  const prevStage = stages[stageIdx - 1]
                  const nextStage = stages[stageIdx + 1]
                  return (
                    <div key={stage} className="w-64 flex-shrink-0">
                      <div className="flex items-center justify-between mb-3">
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', STAGE_COLORS[stage])}>
                          {STAGE_LABELS[stage]}
                        </span>
                        <span className="text-slate-600 text-xs">{stageLeads.length}</span>
                      </div>
                      <div className="space-y-2 min-h-32">
                        {stageLeads.map(lead => (
                          <div
                            key={lead.id}
                            className="bg-slate-900 border border-slate-800 rounded-xl p-3 hover:border-slate-700 transition-colors group"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div
                                className="flex-1 min-w-0 cursor-pointer"
                                onClick={() => router.push(`/leads/${lead.id}`)}
                              >
                                <p className="text-white text-sm font-medium truncate">{lead.name}</p>
                                {lead.company && <p className="text-slate-500 text-xs mt-0.5 truncate">{lead.company}</p>}
                              </div>
                              {/* Stage move buttons */}
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                {prevStage && (
                                  <button
                                    onClick={e => { e.stopPropagation(); moveStage(lead.id, prevStage) }}
                                    title={`Move to ${STAGE_LABELS[prevStage]}`}
                                    className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors text-xs"
                                  >←</button>
                                )}
                                {nextStage && (
                                  <button
                                    onClick={e => { e.stopPropagation(); moveStage(lead.id, nextStage) }}
                                    title={`Move to ${STAGE_LABELS[nextStage]}`}
                                    className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors text-xs"
                                  >→</button>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-slate-600 text-xs">{SOURCE_LABELS[lead.source]}</span>
                              <div className="flex items-center gap-1">
                                <div className="w-10 bg-slate-800 rounded-full h-1">
                                  <div className="h-1 bg-blue-500 rounded-full" style={{ width: `${lead.score}%` }} />
                                </div>
                                <span className="text-slate-500 text-xs">{lead.score}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {stageLeads.length === 0 && (
                          <div className="border-2 border-dashed border-slate-800 rounded-xl p-4 text-center">
                            <p className="text-slate-700 text-xs">No leads</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {showAdd && (
            <AddLeadModal businessId={businessId} onClose={() => setShowAdd(false)} />
          )}
        </>
      )}
    </div>
  )
}

function AddLeadModal({ businessId, onClose }: { businessId: string; onClose: () => void }) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '', job_title: '',
    source: 'manual', stage: 'new', notes: '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) return
    setSaving(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, business_id: businessId, score: 50 }),
      })
      if (res.status === 409) {
        const data = await res.json()
        if (!confirm(`A lead with this email already exists: "${data.duplicate_name}". Add anyway?`)) {
          setSaving(false)
          return
        }
      }
    } finally {
      setSaving(false)
    }
    onClose()
    window.location.reload()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">Add Lead</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">✕</button>
        </div>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: 'name',      label: 'Name *',    type: 'text',  req: true },
              { k: 'email',     label: 'Email',     type: 'email', req: false },
              { k: 'company',   label: 'Company',   type: 'text',  req: false },
              { k: 'job_title', label: 'Job Title', type: 'text',  req: false },
            ].map(({ k, label, type, req }) => (
              <div key={k}>
                <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
                <input
                  type={type}
                  required={req}
                  value={form[k as keyof typeof form]}
                  onChange={e => set(k, e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Source</label>
              <select value={form.source} onChange={e => set('source', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors appearance-none">
                {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Stage</label>
              <select value={form.stage} onChange={e => set('stage', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors appearance-none">
                {Object.entries(STAGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
              {saving ? 'Saving...' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
