'use client'

import { useState, useEffect } from 'react'
import { AIPageContext } from '@/components/ui/ai-page-context'

interface ProposalSection {
  heading: string
  body: string
}

interface GeneratedProposal {
  title: string
  sections: ProposalSection[]
  footer: string
}

interface SavedProposal {
  id: string
  client_name: string
  client_company: string | null
  title: string
  sections_json: string
  footer: string
  budget: string | null
  timeline: string | null
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined'
  share_token: string | null
  view_count: number
  last_viewed_at: string | null
  created_at: string
}

const STATUS_META: Record<SavedProposal['status'], { label: string; color: string }> = {
  draft:    { label: 'Draft',    color: 'bg-slate-800 text-slate-300 border-slate-700' },
  sent:     { label: 'Sent',     color: 'bg-blue-900/50 text-blue-300 border-blue-800/40' },
  viewed:   { label: 'Viewed',   color: 'bg-slate-900/50 text-slate-400 border-slate-700/40' },
  accepted: { label: 'Accepted', color: 'bg-slate-900/50 text-blue-300 border-slate-700/40' },
  declined: { label: 'Declined', color: 'bg-red-900/50 text-red-300 border-red-800/40' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function ProposalsPage() {
  const [tab, setTab] = useState<'generator' | 'saved'>('generator')
  const [savedProposals, setSavedProposals] = useState<SavedProposal[]>([])
  const [loadingSaved, setLoadingSaved] = useState(false)

  const [form, setForm] = useState({
    client_name: '',
    client_company: '',
    service_description: '',
    budget: '',
    timeline: '',
    notes: '',
  })
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [proposal, setProposal] = useState<GeneratedProposal | null>(null)
  const [copied, setCopied] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [genError, setGenError] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    if (tab === 'saved') loadSaved()
  }, [tab])

  async function loadSaved() {
    setLoadingSaved(true)
    try {
      const res = await fetch('/api/proposals')
      const data = await res.json()
      setSavedProposals(data.proposals || [])
    } finally {
      setLoadingSaved(false)
    }
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_name || !form.service_description) return
    setGenerating(true)
    setProposal(null)
    setSavedOk(false)
    setSaveError(null)
    setGenError(null)
    try {
      const res = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.proposal) {
        setProposal(data.proposal)
      } else {
        setGenError(data.error || 'Generation failed — try again.')
      }
    } catch {
      setGenError('Network error — check your connection.')
    } finally {
      setGenerating(false)
    }
  }

  async function saveProposal() {
    if (!proposal) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name:    form.client_name,
          client_company: form.client_company || null,
          title:          proposal.title,
          sections:       proposal.sections,
          footer:         proposal.footer,
          budget:         form.budget || null,
          timeline:       form.timeline || null,
        }),
      })
      if (res.ok) {
        setSavedOk(true)
        setTimeout(() => setSavedOk(false), 3000)
      } else {
        const data = await res.json()
        setSaveError(data.error || 'Save failed — run the DB migration first.')
        setTimeout(() => setSaveError(null), 6000)
      }
    } catch {
      setSaveError('Network error.')
      setTimeout(() => setSaveError(null), 5000)
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: SavedProposal['status']) {
    const res = await fetch(`/api/proposals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setSavedProposals(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    }
  }

  async function deleteProposal(id: string) {
    if (!confirm('Delete this proposal?')) return
    await fetch(`/api/proposals/${id}`, { method: 'DELETE' })
    setSavedProposals(prev => prev.filter(p => p.id !== id))
  }

  function copyShareLink(token: string) {
    const url = `${window.location.origin}/p/${token}`
    navigator.clipboard.writeText(url)
    setCopiedLink(token)
    setTimeout(() => setCopiedLink(null), 2500)
  }

  function copyToClipboard() {
    if (!proposal) return
    const text = [
      proposal.title, '',
      ...proposal.sections.flatMap(s => [s.heading, s.body, '']),
      proposal.footer,
    ].join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function printProposal(shareUrl?: string) {
    if (!proposal) return
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`
      <html><head><title>${proposal.title}</title>
      <style>
        body { font-family: Georgia, serif; max-width: 800px; margin: 60px auto; color: #1e293b; line-height: 1.7; }
        h1 { font-size: 28px; color: #1e293b; margin-bottom: 8px; }
        .meta { color: #64748b; font-size: 14px; margin-bottom: 40px; }
        h2 { font-size: 18px; color: #4f46e5; margin-top: 36px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        p { margin: 0 0 16px; white-space: pre-wrap; }
        .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 13px; font-style: italic; }
        .share-box { margin-top: 32px; padding: 16px; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; }
        .share-box p { margin: 0; font-size: 12px; color: #1d4ed8; }
        .share-box a { color: #4f46e5; word-break: break-all; }
        @media print { .share-box { background: #f5f3ff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style></head><body>
      <h1>${proposal.title}</h1>
      <div class="meta">
        Prepared for: <strong>${form.client_name}${form.client_company ? ', ' + form.client_company : ''}</strong><br/>
        Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        ${form.budget ? '<br/>Budget: ' + form.budget : ''}
        ${form.timeline ? '<br/>Timeline: ' + form.timeline : ''}
      </div>
      ${proposal.sections.map(s => `<h2>${s.heading}</h2><p>${s.body}</p>`).join('')}
      <div class="footer">${proposal.footer}</div>
      ${shareUrl ? `<div class="share-box"><p>📎 View & respond to this proposal online:</p><p><a href="${shareUrl}">${shareUrl}</a></p></div>` : ''}
      </body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  function printSavedProposal(p: SavedProposal) {
    let secs: ProposalSection[] = []
    try { secs = JSON.parse(p.sections_json || '[]') } catch { secs = [] }
    const shareUrl = p.share_token ? `${window.location.origin}/p/${p.share_token}` : null
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`
      <html><head><title>${p.title}</title>
      <style>
        body { font-family: Georgia, serif; max-width: 800px; margin: 60px auto; color: #1e293b; line-height: 1.7; }
        h1 { font-size: 28px; color: #1e293b; margin-bottom: 8px; }
        .meta { color: #64748b; font-size: 14px; margin-bottom: 40px; }
        h2 { font-size: 18px; color: #4f46e5; margin-top: 36px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        p { margin: 0 0 16px; white-space: pre-wrap; }
        .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 13px; font-style: italic; }
        .share-box { margin-top: 32px; padding: 16px; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; }
        .share-box p { margin: 0; font-size: 12px; color: #1d4ed8; }
        .share-box a { color: #4f46e5; word-break: break-all; }
        @media print { .share-box { background: #f5f3ff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style></head><body>
      <h1>${p.title}</h1>
      <div class="meta">
        Prepared for: <strong>${p.client_name}${p.client_company ? ', ' + p.client_company : ''}</strong><br/>
        Date: ${new Date(p.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        ${p.budget ? '<br/>Budget: ' + p.budget : ''}
        ${p.timeline ? '<br/>Timeline: ' + p.timeline : ''}
      </div>
      ${secs.map(s => `<h2>${s.heading}</h2><p>${s.body}</p>`).join('')}
      ${p.footer ? `<div class="footer">${p.footer}</div>` : ''}
      ${shareUrl ? `<div class="share-box"><p>📎 View & respond to this proposal online:</p><p><a href="${shareUrl}">${shareUrl}</a></p></div>` : ''}
      </body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <AIPageContext
        title="AI Proposal Generator"
        subtitle="Generate professional, client-ready proposals in seconds. AI writes every section — overview, pricing, timeline, terms — then gives you a trackable share link."
        accent="amber"
        automations={[
          'Generates full proposals from client name + project brief',
          'Writes executive summary, scope, pricing, timeline, terms',
          'Creates a unique share link with view tracking',
          'Auto-updates proposal status: Draft → Sent → Viewed → Accepted',
          'Tracks who opened it and when',
        ]}
        manual={['Enter client name & project brief', 'Review & edit sections', 'Share the link with client']}
      />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Proposals</h1>
          <p className="text-slate-400 text-sm mt-1">AI-generated proposals — share with clients, track when they view</p>
        </div>
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          {(['generator', 'saved'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {t === 'generator' ? '✨ Generator' : `📋 Saved${savedProposals.length > 0 ? ` (${savedProposals.length})` : ''}`}
            </button>
          ))}
        </div>
      </div>

      {tab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-white font-semibold text-base mb-5">Proposal Details</h2>
              <form onSubmit={generate} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Client Name *</label>
                    <input value={form.client_name} onChange={set('client_name')} placeholder="Jane Smith" required
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-600" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Company</label>
                    <input value={form.client_company} onChange={set('client_company')} placeholder="Acme Corp"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-600" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Service / Project Description *</label>
                  <textarea value={form.service_description} onChange={set('service_description')} required rows={3}
                    placeholder="e.g. 6-month SEO and content marketing campaign to increase organic traffic by 40%"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-600 resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Budget / Pricing</label>
                    <input value={form.budget} onChange={set('budget')} placeholder="$2,500/month"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-600" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Timeline</label>
                    <input value={form.timeline} onChange={set('timeline')} placeholder="3 months, Q3 2026"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-600" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Additional Notes</label>
                  <textarea value={form.notes} onChange={set('notes')} rows={2}
                    placeholder="Any specific requirements, pain points, or context to include..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-600 resize-none" />
                </div>

                {genError && (
                  <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2 text-red-300 text-sm">
                    {genError}
                  </div>
                )}

                <button type="submit" disabled={generating || !form.client_name || !form.service_description}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
                  {generating
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating proposal…</>
                    : '✨ Generate Proposal'}
                </button>
              </form>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5 mt-4">
              <p className="text-slate-400 text-sm font-medium mb-3">Tips for better proposals</p>
              <ul className="space-y-2">
                {['Be specific about the service — "Facebook Ads" beats "marketing"',
                  'Include a budget range to get realistic pricing sections',
                  'Mention any pain points the client expressed'].map(t => (
                  <li key={t} className="text-slate-500 text-sm flex gap-2">
                    <span className="text-blue-500 flex-shrink-0">•</span>{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Preview */}
          <div>
            {proposal ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
                  <span className="text-slate-400 text-sm font-medium">Preview</span>
                  <div className="flex items-center gap-2">
                    <button onClick={saveProposal} disabled={saving || savedOk}
                      className="text-sm bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors">
                      {savedOk ? '✓ Saved' : saving ? 'Saving…' : '💾 Save & Track'}
                    </button>
                    <button onClick={copyToClipboard}
                      className="text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors">
                      {copied ? '✓ Copied' : '📋 Copy'}
                    </button>
                    <button onClick={() => printProposal(undefined)}
                      className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                      📄 Export PDF
                    </button>
                  </div>
                </div>

                {saveError && (
                  <div className="px-5 py-2.5 bg-red-900/30 border-b border-red-800/30 text-red-300 text-sm">
                    {saveError}
                  </div>
                )}

                <div className="p-6 space-y-5 max-h-[600px] overflow-y-auto">
                  <div>
                    <h2 className="text-white text-xl font-bold">{proposal.title}</h2>
                    <p className="text-slate-500 text-sm mt-1">
                      {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  {proposal.sections.map((s, i) => (
                    <div key={i} className="border-t border-slate-800 pt-4">
                      <h3 className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">{s.heading}</h3>
                      <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{s.body}</p>
                    </div>
                  ))}
                  <div className="border-t border-slate-800 pt-4">
                    <p className="text-slate-600 text-xs italic">{proposal.footer}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 border-dashed rounded-2xl p-12 text-center h-full min-h-[300px] flex flex-col items-center justify-center">
                <div className="text-5xl mb-4">📄</div>
                <p className="text-slate-400 text-base font-medium">Proposal preview</p>
                <p className="text-slate-600 text-sm mt-1">Fill in the details and click generate</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'saved' && (
        <div>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
            {(['draft', 'sent', 'viewed', 'accepted', 'declined'] as const).map(s => {
              const count = savedProposals.filter(p => p.status === s).length
              const meta = STATUS_META[s]
              return (
                <div key={s} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
                  <p className="text-white text-4xl font-bold">{count}</p>
                  <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full border mt-2 ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>
              )
            })}
          </div>

          {loadingSaved ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-900 rounded-xl animate-pulse" />)}
            </div>
          ) : savedProposals.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 text-center">
              <div className="text-5xl mb-4">📋</div>
              <h2 className="text-white font-semibold text-lg mb-2">No saved proposals</h2>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
                Generate a proposal and click &ldquo;Save &amp; Track&rdquo; to start tracking its status.
              </p>
              <button
                onClick={() => setTab('generator')}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-6 py-3 rounded-xl transition-colors"
              >
                Generate First Proposal
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {savedProposals.map(p => {
                const meta = STATUS_META[p.status]
                const shareUrl = p.share_token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${p.share_token}` : null
                return (
                  <div key={p.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition-colors group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h3 className="text-white font-semibold text-base">{p.title}</h3>
                          <span className={`inline-flex text-xs font-medium px-2.5 py-0.5 rounded-full border ${meta.color}`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-slate-400 text-sm">
                          {p.client_name}{p.client_company ? ` · ${p.client_company}` : ''}
                          {p.budget ? ` · ${p.budget}` : ''}
                          {p.timeline ? ` · ${p.timeline}` : ''}
                        </p>
                        {/* Tracking info */}
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-slate-600 text-xs">
                            Created {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          {p.view_count > 0 ? (
                            <span className="text-slate-500 text-xs font-medium flex items-center gap-1">
                              👁 {p.view_count} view{p.view_count !== 1 ? 's' : ''}
                              {p.last_viewed_at && <span className="text-slate-500 font-normal">· last {timeAgo(p.last_viewed_at)}</span>}
                            </span>
                          ) : (
                            <span className="text-slate-700 text-xs">Not viewed yet</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Share link */}
                        {shareUrl && (
                          <button
                            onClick={() => copyShareLink(p.share_token!)}
                            title="Copy shareable link"
                            className={`text-sm px-3 py-2 rounded-lg border transition-colors ${
                              copiedLink === p.share_token
                                ? 'bg-slate-900/40 border-slate-700 text-blue-300'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {copiedLink === p.share_token ? '✓ Link copied' : '🔗 Share'}
                          </button>
                        )}
                        <button
                          onClick={() => printSavedProposal(p)}
                          title="Export as PDF"
                          className="text-sm bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 px-3 py-2 rounded-lg transition-colors"
                        >
                          📄 PDF
                        </button>
                        <select
                          value={p.status}
                          onChange={e => updateStatus(p.id, e.target.value as SavedProposal['status'])}
                          className="text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-blue-500 transition-colors"
                        >
                          {(['draft', 'sent', 'viewed', 'accepted', 'declined'] as const).map(s => (
                            <option key={s} value={s}>{STATUS_META[s].label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => deleteProposal(p.id)}
                          className="text-sm text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all px-2 py-2"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
