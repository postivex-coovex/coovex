'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { RefreshCw, Snowflake, Mail, Clock, ChevronRight, ExternalLink } from 'lucide-react'

interface ColdLead {
  id: string
  name: string
  email: string | null
  company: string | null
  job_title: string | null
  source: string | null
  stage: string
  lead_score: number | null
  created_at: string
  updated_at: string
  notes: string | null
}

interface EmailDraft {
  subject: string
  email: string
}

const STAGE_COLORS: Record<string, string> = {
  new: 'text-slate-400 bg-slate-800',
  contacted: 'text-blue-400 bg-blue-950/40',
  qualified: 'text-blue-400 bg-slate-950/40',
  proposal_sent: 'text-slate-500 bg-slate-950/40',
}

function daysAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ColdLeadsPage() {
  const [leads, setLeads] = useState<ColdLead[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, EmailDraft>>({})
  const [drafting, setDrafting] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState<string | null>(null)

  function load() {
    setLoading(true)
    fetch('/api/leads/cold')
      .then(r => r.json())
      .then(d => { setLeads(d.leads ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function draftEmail(lead: ColdLead) {
    if (drafts[lead.id]) {
      setExpanded(e => ({ ...e, [lead.id]: !e[lead.id] }))
      return
    }
    setDrafting(d => ({ ...d, [lead.id]: true }))
    try {
      const res = await fetch(`/api/leads/${lead.id}/draft-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone: 'friendly' }),
      })
      const data = await res.json()
      setDrafts(d => ({ ...d, [lead.id]: { subject: data.email?.subject ?? data.subject ?? '', email: data.email?.body ?? data.email ?? '' } }))
      setExpanded(e => ({ ...e, [lead.id]: true }))
    } finally {
      setDrafting(d => ({ ...d, [lead.id]: false }))
    }
  }

  function copy(leadId: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(leadId)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const coldCount = leads.length
  const avgDays = coldCount > 0 ? Math.round(leads.reduce((s, l) => s + daysAgo(l.updated_at), 0) / coldCount) : 0

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Snowflake className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Cold Leads</h1>
          </div>
          <p className="text-slate-400 text-base">Leads with no activity in 30+ days — re-engage them with AI</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats — only show when there are cold leads */}
      {!loading && leads.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
            <p className="text-4xl font-bold text-blue-400">{coldCount}</p>
            <p className="text-slate-500 text-sm mt-1">Cold Leads</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
            <p className="text-4xl font-bold text-slate-500">{avgDays}d</p>
            <p className="text-slate-500 text-sm mt-1">Avg. Inactive</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
            <p className="text-4xl font-bold text-blue-400">{Object.keys(drafts).length}</p>
            <p className="text-slate-500 text-sm mt-1">Emails Drafted</p>
          </div>
        </div>
      )}

      {/* How it works banner — always visible when empty */}
      {!loading && leads.length === 0 && (
        <div className="space-y-4 mb-8">
          {/* What is this */}
          <div className="bg-blue-950/30 border border-blue-800/40 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Snowflake className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-base mb-1">What are Cold Leads?</h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Leads with <span className="text-slate-500 font-medium">no activity for 30+ days</span> automatically appear here.
                  Use AI to draft personalized re-engagement emails and bring them back into your pipeline.
                </p>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-sm mb-3">1</div>
              <p className="text-white text-sm font-medium mb-1">Add your leads</p>
              <p className="text-slate-500 text-xs leading-relaxed">Add leads via AI Find Leads or manually. The more leads you track, the more opportunities you have.</p>
              <Link href="/leads/find" className="inline-flex items-center gap-1 mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                AI Find Leads <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="w-8 h-8 rounded-lg bg-slate-600/20 flex items-center justify-center text-slate-500 font-bold text-sm mb-3">2</div>
              <p className="text-white text-sm font-medium mb-1">They go cold after 30 days</p>
              <p className="text-slate-500 text-xs leading-relaxed">Any lead with no activity for 30+ days is automatically moved here so nothing slips through the cracks.</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold text-sm mb-3">3</div>
              <p className="text-white text-sm font-medium mb-1">Re-engage with AI</p>
              <p className="text-slate-500 text-xs leading-relaxed">Click "Draft email" and AI generates a personalized re-engagement email for that lead in seconds.</p>
            </div>
          </div>

          {/* Current status */}
          <div className="bg-slate-950/20 border border-slate-700/30 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-400 text-sm">✓</span>
            </div>
            <div className="flex-1">
              <p className="text-blue-400 text-sm font-medium">All leads are active!</p>
              <p className="text-slate-500 text-xs mt-0.5">All your leads have had recent activity. Any lead inactive for 30+ days will appear here automatically.</p>
            </div>
            <Link href="/leads" className="flex-shrink-0 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors">
              View all leads →
            </Link>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-600 text-base">Loading…</div>
      ) : leads.length === 0 ? null : (
        <div className="space-y-4">
          {leads.map(lead => {
            const days = daysAgo(lead.updated_at)
            const draft = drafts[lead.id]
            const isExpanded = expanded[lead.id]
            const isDrafting = drafting[lead.id]
            const stageColor = STAGE_COLORS[lead.stage] ?? 'text-slate-400 bg-slate-800'

            return (
              <div key={lead.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {/* Lead row */}
                <div className="p-6 flex items-start gap-5">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 text-base font-semibold text-slate-400">
                    {lead.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-semibold text-base">{lead.name}</p>
                      {lead.company && <span className="text-slate-500 text-sm">@ {lead.company}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${stageColor}`}>{lead.stage}</span>
                      {lead.lead_score != null && (
                        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">score {lead.lead_score}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1.5">
                      {lead.email && <span className="text-slate-500 text-sm truncate">{lead.email}</span>}
                      {lead.job_title && <span className="text-slate-600 text-sm">{lead.job_title}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Clock className="w-4 h-4 text-slate-600" />
                      <span className="text-slate-600 text-sm font-medium">{days} days inactive</span>
                      <span className="text-slate-600 text-sm">· last seen {fmtDate(lead.updated_at)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center transition-colors"
                      title="View lead"
                    >
                      <ExternalLink className="w-4 h-4 text-slate-500" />
                    </Link>
                    <button
                      onClick={() => draftEmail(lead)}
                      disabled={isDrafting}
                      className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 bg-slate-950/30 hover:bg-slate-950/50 border border-slate-700/30 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {isDrafting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                      {isDrafting ? 'Drafting…' : draft ? (isExpanded ? 'Hide' : 'Show email') : 'Draft email'}
                    </button>
                  </div>
                </div>

                {/* Email draft panel */}
                {draft && isExpanded && (
                  <div className="border-t border-slate-800 bg-slate-950/50 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-400" />
                        <span className="text-blue-300 text-sm font-medium">AI Re-engagement Email</span>
                        <span className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">friendly tone</span>
                      </div>
                      <button
                        onClick={() => copy(lead.id, `Subject: ${draft.subject}\n\n${draft.email}`)}
                        className="text-sm text-slate-500 hover:text-white transition-colors"
                      >
                        {copied === lead.id ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>

                    {draft.subject && (
                      <div className="mb-3">
                        <span className="text-xs text-slate-600 uppercase tracking-wide">Subject</span>
                        <p className="text-slate-300 text-sm mt-1 font-medium">{draft.subject}</p>
                      </div>
                    )}

                    <div>
                      <span className="text-xs text-slate-600 uppercase tracking-wide">Body</span>
                      <pre className="text-slate-400 text-sm mt-1 whitespace-pre-wrap leading-relaxed font-sans">{draft.email}</pre>
                    </div>

                    {lead.email && (
                      <div className="flex gap-3 mt-4 pt-4 border-t border-slate-800">
                        <a
                          href={`mailto:${lead.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.email)}`}
                          className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 bg-slate-950/30 border border-slate-700/30 px-4 py-2 rounded-xl transition-colors"
                        >
                          <Mail className="w-4 h-4" />
                          Open in email client
                        </a>
                        <Link
                          href={`/leads/${lead.id}`}
                          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                          View full lead
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!loading && leads.length > 0 && (
        <p className="text-slate-600 text-sm text-center mt-6">
          Showing {leads.length} leads inactive for 30+ days · <Link href="/leads" className="text-blue-500 hover:text-blue-400">View all leads</Link>
        </p>
      )}
    </div>
  )
}
