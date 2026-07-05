'use client'

import { useState } from 'react'

interface Inquiry {
  id: string
  created_at: string
  name: string
  email: string
  service_type: string
  description: string
  budget: string | null
  business_name: string | null
  status: string
  proposal_sent_at: string | null
}

const STATUS_COLORS: Record<string, string> = {
  new:          'bg-blue-950/50 text-blue-400 border-blue-900/40',
  contacted:    'bg-amber-950/50 text-amber-400 border-amber-900/40',
  proposal_sent:'bg-violet-950/50 text-violet-400 border-violet-900/40',
  closed:       'bg-emerald-950/50 text-emerald-400 border-emerald-900/40',
  rejected:     'bg-red-950/50 text-red-400 border-red-900/40',
}

export function InquiriesClient({ inquiries: initial }: { inquiries: Inquiry[] }) {
  const [inquiries, setInquiries] = useState(initial)
  const [selected, setSelected] = useState<Inquiry | null>(initial[0] ?? null)
  const [proposal, setProposal] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function updateStatus(id: string, status: string) {
    const res = await fetch('/api/integration-service', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (res.ok) {
      setInquiries(prev => prev.map(i => i.id === id ? { ...i, status } : i))
      if (selected?.id === id) setSelected(s => s ? { ...s, status } : s)
      setMsg({ ok: true, text: 'Status updated' })
    } else {
      setMsg({ ok: false, text: 'Failed to update status' })
    }
    setTimeout(() => setMsg(null), 3000)
  }

  async function sendProposal() {
    if (!selected || !proposal.trim()) return
    setSending(true)
    const res = await fetch('/api/integration-service', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, proposal }),
    })
    if (res.ok) {
      setMsg({ ok: true, text: `Proposal sent to ${selected.email}` })
      setProposal('')
      await updateStatus(selected.id, 'proposal_sent')
    } else {
      setMsg({ ok: false, text: 'Failed to send proposal' })
    }
    setSending(false)
  }

  return (
    <div className="flex h-full" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Left panel */}
      <div className="w-80 flex-shrink-0 border-r border-slate-800 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-800">
          <h1 className="text-white font-bold text-base">Integration Inquiries</h1>
          <p className="text-slate-500 text-xs mt-0.5">{inquiries.length} total</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {inquiries.length === 0 && (
            <div className="p-6 text-center text-slate-600 text-sm">No inquiries yet</div>
          )}
          {inquiries.map(inq => (
            <button
              key={inq.id}
              onClick={() => setSelected(inq)}
              className={`w-full text-left px-4 py-3.5 border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors ${
                selected?.id === inq.id ? 'bg-slate-800/60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{inq.name}</p>
                  <p className="text-slate-500 text-xs truncate">{inq.service_type}</p>
                  {inq.budget && <p className="text-slate-600 text-xs">{inq.budget}</p>}
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLORS[inq.status] ?? STATUS_COLORS.new}`}>
                  {inq.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-slate-600 text-[10px] mt-1">
                {new Date(inq.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Right detail panel */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-slate-600">Select an inquiry</div>
        ) : (
          <div className="max-w-2xl">
            {msg && (
              <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${msg.ok
                ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900'
                : 'bg-red-950/50 text-red-400 border-red-900'}`}>
                {msg.text}
              </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-white font-bold text-lg">{selected.name}</h2>
                <p className="text-slate-400 text-sm">{selected.email}</p>
                {selected.business_name && <p className="text-slate-500 text-xs mt-0.5">{selected.business_name}</p>}
              </div>
              <select
                value={selected.status}
                onChange={e => updateStatus(selected.id, e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="proposal_sent">Proposal Sent</option>
                <option value="closed">Closed (Won)</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Details */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-5 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 text-xs mb-1">Service Type</p>
                  <p className="text-white text-sm font-medium">{selected.service_type}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1">Budget</p>
                  <p className="text-white text-sm font-medium">{selected.budget ?? '—'}</p>
                </div>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Description</p>
                <p className="text-slate-300 text-sm leading-relaxed">{selected.description}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Submitted {new Date(selected.created_at).toLocaleString()}</p>
                {selected.proposal_sent_at && (
                  <p className="text-violet-400 text-xs mt-0.5">Proposal sent {new Date(selected.proposal_sent_at).toLocaleString()}</p>
                )}
              </div>
            </div>

            {/* Send proposal */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-white font-semibold text-sm mb-3">Send Proposal to Client</h3>
              <textarea
                value={proposal}
                onChange={e => setProposal(e.target.value)}
                placeholder="Write your proposal here — pricing, timeline, deliverables..."
                rows={8}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-none mb-3"
              />
              <button
                onClick={sendProposal}
                disabled={sending || !proposal.trim()}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Sending…' : 'Send Proposal →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
