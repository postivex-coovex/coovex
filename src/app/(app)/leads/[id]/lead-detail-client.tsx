'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type LeadStage = 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost'
type LeadSource = 'website_form' | 'linkedin' | 'facebook' | 'google_ads' | 'referral' | 'manual' | 'email' | 'other' | 'web_search' | 'map_search' | 'keyword_scraper'
type ActivityType = 'email_sent' | 'email_opened' | 'link_clicked' | 'form_submitted' | 'call' | 'meeting' | 'note' | 'stage_change' | 'score_change' | 'ad_click'

interface ResearchData {
  summary: string
  website?: string | null
  icon_url?: string | null
  found_email?: string | null
  found_phone?: string | null
  decision_maker: string
  best_time_to_contact: string
  insights: string[]
  talking_points: string[]
  context_for_ai: string
  sources?: { title: string; url: string }[]
}

interface Lead {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  job_title: string | null
  website: string | null
  source: LeadSource
  score: number
  stage: LeadStage
  notes: string | null
  tags: string[] | null
  research_data: ResearchData | null
  created_at: string
  updated_at: string
}

interface Activity {
  id: string
  lead_id: string
  type: ActivityType
  data_json: Record<string, unknown> | null
  created_at: string
}

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
}

interface Product {
  id: string
  name: string
  tagline?: string | null
  description?: string | null
  price?: number | null
  price_unit?: string | null
  currency?: string | null
  key_benefits?: string | null
  target_audience?: string | null
}

interface LeadDetailClientProps {
  lead: Lead
  activities: Activity[]
  assignedTo?: string | null
  products?: Product[]
}

const STAGE_META: Record<LeadStage, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-slate-700 text-slate-300' },
  contacted: { label: 'Contacted', color: 'bg-blue-950/60 text-blue-400' },
  qualified: { label: 'Qualified', color: 'bg-violet-950/60 text-violet-400' },
  proposal_sent: { label: 'Proposal Sent', color: 'bg-amber-950/60 text-amber-400' },
  won: { label: 'Won', color: 'bg-emerald-950/60 text-emerald-400' },
  lost: { label: 'Lost', color: 'bg-red-950/60 text-red-400' },
}

const SOURCE_META: Record<LeadSource, { label: string; icon: string }> = {
  website_form: { label: 'Website Form', icon: '🌐' },
  linkedin:     { label: 'LinkedIn',     icon: '💼' },
  facebook:     { label: 'Facebook',     icon: '📘' },
  google_ads:   { label: 'Google Ads',   icon: '💸' },
  referral:     { label: 'Referral',     icon: '🤝' },
  manual:       { label: 'Manual',       icon: '✋' },
  email:        { label: 'Email',        icon: '📧' },
  other:        { label: 'Other',        icon: '📌' },
  web_search:        { label: 'Web Search',      icon: '🔎' },
  map_search:        { label: 'Map Search',      icon: '📍' },
  keyword_scraper:   { label: 'Keyword Scraper', icon: '🎯' },
}

const ACTIVITY_META: Record<ActivityType, { label: string; icon: string; color: string }> = {
  email_sent: { label: 'Email Sent', icon: '📧', color: 'text-blue-400' },
  email_opened: { label: 'Email Opened', icon: '📨', color: 'text-cyan-400' },
  link_clicked: { label: 'Link Clicked', icon: '🔗', color: 'text-violet-400' },
  form_submitted: { label: 'Form Submitted', icon: '📝', color: 'text-green-400' },
  call: { label: 'Call', icon: '📞', color: 'text-emerald-400' },
  meeting: { label: 'Meeting', icon: '🤝', color: 'text-amber-400' },
  note: { label: 'Note', icon: '📌', color: 'text-slate-400' },
  stage_change: { label: 'Stage Changed', icon: '🔄', color: 'text-violet-400' },
  score_change: { label: 'Score Updated', icon: '⭐', color: 'text-yellow-400' },
  ad_click: { label: 'Ad Click', icon: '🎯', color: 'text-orange-400' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function LeadAvatar({ domain, initials, iconUrl }: { domain: string | null; initials: string; iconUrl?: string | null }) {
  type Step = 'direct' | 'clearbit' | 'favicon' | 'initials'
  const initial: Step = iconUrl ? 'direct' : domain ? 'clearbit' : 'initials'
  const [step, setStep] = useState<Step>(initial)

  if (step === 'initials') {
    return (
      <div className="w-16 h-16 rounded-full bg-violet-600 flex items-center justify-center text-white text-xl font-bold">
        {initials}
      </div>
    )
  }

  const src =
    step === 'direct'   ? iconUrl! :
    step === 'clearbit' ? `https://logo.clearbit.com/${domain}` :
                          `https://www.google.com/s2/favicons?domain=${domain}&sz=128`

  const nextStep = (): Step =>
    step === 'direct'   ? (domain ? 'clearbit' : 'initials') :
    step === 'clearbit' ? (domain ? 'favicon'  : 'initials') :
                          'initials'

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt=""
      className="w-16 h-16 rounded-full object-contain bg-white p-1 border border-slate-700"
      onError={() => setStep(nextStep())}
    />
  )
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-white font-bold text-sm w-8 text-right">{score}</span>
    </div>
  )
}

interface Deal {
  id: string
  value: number
  currency: string
  close_date: string | null
  probability: number
  status: 'open' | 'won' | 'lost'
  created_at: string
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'BDT', 'INR', 'AED', 'CAD', 'AUD']

function DealCard({ leadId }: { leadId: string }) {
  const [deals, setDeals]       = useState<Deal[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm] = useState({ value: '', currency: 'USD', close_date: '', probability: '50', status: 'open' })

  function loadDeals() {
    fetch(`/api/leads/${leadId}/deals`).then(r => r.json()).then(d => { setDeals(d.deals ?? []); setLoading(false) })
  }
  useEffect(() => { loadDeals() }, [leadId])

  function openAdd() { setForm({ value: '', currency: 'USD', close_date: '', probability: '50', status: 'open' }); setEditId(null); setShowForm(true) }
  function openEdit(d: Deal) {
    setForm({ value: String(d.value), currency: d.currency, close_date: d.close_date ?? '', probability: String(d.probability), status: d.status })
    setEditId(d.id); setShowForm(true)
  }

  async function save() {
    if (!form.value) return
    setSaving(true)
    const payload = { value: parseFloat(form.value), currency: form.currency, close_date: form.close_date || null, probability: parseInt(form.probability), status: form.status }
    if (editId) {
      await fetch(`/api/leads/${leadId}/deals`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deal_id: editId, ...payload }) })
    } else {
      await fetch(`/api/leads/${leadId}/deals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
    setSaving(false); setShowForm(false); loadDeals()
  }

  async function remove(dealId: string) {
    if (!confirm('Delete this deal?')) return
    await fetch(`/api/leads/${leadId}/deals`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deal_id: dealId }) })
    loadDeals()
  }

  const fmtVal = (v: number, c: string) => `${c} ${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  const statusColor = (s: string) => s === 'won' ? 'text-emerald-400' : s === 'lost' ? 'text-red-400' : 'text-violet-400'

  if (loading) return null

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider">Deal Value</h2>
        <button onClick={openAdd} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">+ Add Deal</button>
      </div>

      {deals.length === 0 && !showForm && (
        <div className="py-3 text-center">
          <p className="text-slate-600 text-xs">No deals yet.</p>
          <button onClick={openAdd} className="mt-2 text-xs text-violet-500 hover:text-violet-400 border border-violet-800/40 px-3 py-1.5 rounded-lg transition-colors">
            + Add Deal Value
          </button>
        </div>
      )}

      {deals.map(d => (
        <div key={d.id} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
          <div>
            <p className={`text-sm font-semibold ${statusColor(d.status)}`}>{fmtVal(d.value, d.currency)}</p>
            <p className="text-slate-600 text-[10px]">
              {d.status.toUpperCase()} · {d.probability}%{d.close_date ? ` · ${new Date(d.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
            </p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => openEdit(d)} className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1 rounded border border-slate-800 hover:border-slate-700 transition-colors">Edit</button>
            <button onClick={() => remove(d.id)} className="text-[10px] text-slate-600 hover:text-red-400 px-2 py-1 rounded border border-slate-800 hover:border-red-900 transition-colors">✕</button>
          </div>
        </div>
      ))}

      {showForm && (
        <div className="mt-3 pt-3 border-t border-slate-800 space-y-2.5">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 mb-1 block">Value</label>
              <input
                type="number" min="0" step="0.01"
                value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                placeholder="e.g. 2500"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="w-20">
              <label className="text-[10px] text-slate-500 mb-1 block">Currency</label>
              <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-violet-500">
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 mb-1 block">Close Date</label>
              <input type="date" value={form.close_date} onChange={e => setForm(p => ({ ...p, close_date: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="w-20">
              <label className="text-[10px] text-slate-500 mb-1 block">Prob %</label>
              <input type="number" min="0" max="100"
                value={form.probability} onChange={e => setForm(p => ({ ...p, probability: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 mb-1 block">Status</label>
            <div className="flex gap-1.5">
              {(['open', 'won', 'lost'] as const).map(s => (
                <button key={s} onClick={() => setForm(p => ({ ...p, status: s }))}
                  className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors capitalize ${
                    form.status === s
                      ? s === 'won' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                        : s === 'lost' ? 'bg-red-950/40 text-red-400 border-red-800/40'
                        : 'bg-violet-950/40 text-violet-400 border-violet-800/40'
                      : 'text-slate-500 border-slate-800 hover:border-slate-700'
                  }`}>{s}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving || !form.value}
              className="flex-1 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white text-xs py-2 rounded-lg transition-colors font-medium">
              {saving ? 'Saving…' : editId ? 'Update Deal' : 'Save Deal'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-xs text-slate-500 hover:text-slate-300 px-3">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function LeadDetailClient({ lead: initialLead, activities: initialActivities, assignedTo: initialAssignedTo, products = [] }: LeadDetailClientProps) {
  const router = useRouter()
  const [lead, setLead] = useState<Lead>(initialLead)
  const [activities, setActivities] = useState<Activity[]>(initialActivities)
  const [editing, setEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()
  const [activityType, setActivityType] = useState<ActivityType>('note')
  const [activityNote, setActivityNote] = useState('')
  const [isLoggingActivity, setIsLoggingActivity] = useState(false)
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [isScoringAI, setIsScoringAI] = useState(false)
  const [scoreReasoning, setScoreReasoning] = useState('')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [assignedTo, setAssignedTo] = useState<string | null>(initialAssignedTo || null)
  const [isAssigning, setIsAssigning] = useState(false)
  const [isDraftingEmail, setIsDraftingEmail] = useState(false)
  const [emailDraft, setEmailDraft] = useState<{ subject: string; email: string } | null>(null)
  const [emailTone, setEmailTone] = useState<'professional' | 'friendly' | 'urgent'>('professional')
  const [showEmailDraft, setShowEmailDraft] = useState(false)
  const [emailCopied, setEmailCopied] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [isRequestingReview, setIsRequestingReview] = useState(false)
  const [reviewRequested, setReviewRequested] = useState(false)

  // AI Tools panel
  const [aiTab, setAiTab] = useState<'research' | 'email' | 'call'>('research')
  const [callScript, setCallScript]       = useState<{ opening: string; discovery: string; pitch: string; objections: { obj: string; response: string }[]; closing: string } | null>(null)
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [scriptCopied, setScriptCopied]   = useState(false)
  const [research, setResearch]           = useState<ResearchData | null>(initialLead.research_data ?? null)
  const [isResearching, setIsResearching] = useState(false)
  const [contactSuggestion, setContactSuggestion] = useState<{ email?: string; phone?: string; website?: string } | null>(null)
  const [updatingContact, setUpdatingContact] = useState(false)

  useEffect(() => {
    fetch('/api/team').then(r => r.json()).then(d => setTeamMembers(d.members || []))
  }, [])

  // Edit form state
  const [form, setForm] = useState({
    name: lead.name,
    email: lead.email || '',
    phone: lead.phone || '',
    company: lead.company || '',
    job_title: lead.job_title || '',
    stage: lead.stage,
    score: lead.score,
    notes: lead.notes || '',
  })

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.lead) {
        setLead(data.lead)
        setEditing(false)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = () => {
    if (!confirm('Delete this lead? This cannot be undone.')) return
    startDeleteTransition(async () => {
      await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' })
      router.push('/leads')
    })
  }

  const handleStageChange = async (stage: LeadStage) => {
    const oldStage = lead.stage
    setLead(prev => ({ ...prev, stage }))
    await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    })
    // Log the stage change activity
    const res = await fetch(`/api/leads/${lead.id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'stage_change', data_json: { from: oldStage, to: stage } }),
    })
    const data = await res.json()
    if (data.activity) setActivities(prev => [data.activity, ...prev])
  }

  const handleLogActivity = async () => {
    if (!activityNote.trim() && activityType === 'note') return
    setIsLoggingActivity(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activityType, data_json: activityNote ? { note: activityNote } : null }),
      })
      const data = await res.json()
      if (data.activity) {
        setActivities(prev => [data.activity, ...prev])
        setActivityNote('')
        setShowActivityForm(false)
      }
    } finally {
      setIsLoggingActivity(false)
    }
  }

  const stageMeta  = STAGE_META[lead.stage]
  const sourceMeta = SOURCE_META[lead.source] ?? { label: lead.source, icon: '📌' }
  const initials   = lead.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const logoDomain = (() => {
    const site = lead.website || research?.website
    if (site) { try { return new URL(site).hostname.replace('www.', '') } catch {} }
    if (lead.email) { const d = lead.email.split('@')[1]; if (d) return d }
    return null
  })()

  const handleAssign = async (userId: string | null) => {
    setIsAssigning(true)
    await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: userId }),
    })
    setAssignedTo(userId)
    setIsAssigning(false)
  }

  const LOGGABLE: ActivityType[] = ['call', 'meeting', 'email_sent', 'note']

  async function draftEmail() {
    setIsDraftingEmail(true)
    setEmailDraft(null)
    const res = await fetch(`/api/leads/${lead.id}/draft-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tone: emailTone, research_context: research?.context_for_ai ?? '', product_id: selectedProductId }),
    })
    const d = await res.json()
    setEmailDraft(d)
    setShowEmailDraft(true)
    setIsDraftingEmail(false)
    // Mark email draft done in DB
    const merged = { ...(research ?? {}), email_draft_done: true }
    await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ research_data: merged }),
    })
    if (research) setResearch({ ...research, email_draft_done: true } as ResearchData & { email_draft_done: boolean })
  }

  function copyEmail() {
    if (!emailDraft) return
    const text = `Subject: ${emailDraft.subject}\n\n${emailDraft.email}`
    navigator.clipboard.writeText(text)
    setEmailCopied(true)
    setTimeout(() => setEmailCopied(false), 2000)
  }

  async function requestReview() {
    setIsRequestingReview(true)
    try {
      await fetch(`/api/leads/${lead.id}/request-review`, { method: 'POST' })
      setReviewRequested(true)
    } finally {
      setIsRequestingReview(false)
    }
  }

  async function generateCallScript() {
    setIsGeneratingScript(true)
    setCallScript(null)
    try {
      const res = await fetch(`/api/leads/${lead.id}/call-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ research_context: research?.context_for_ai ?? '' }),
      })
      const d = await res.json()
      setCallScript(d)
      // Mark call script done in DB
      const merged = { ...(research ?? {}), call_script_done: true }
      await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ research_data: merged }),
      })
      if (research) setResearch({ ...research, call_script_done: true } as ResearchData & { call_script_done: boolean })
    } finally { setIsGeneratingScript(false) }
  }

  async function researchLead() {
    setIsResearching(true)
    setResearch(null)
    setContactSuggestion(null)
    try {
      const res = await fetch(`/api/leads/${lead.id}/research`, { method: 'POST' })
      const d: ResearchData = await res.json()
      setResearch(d)
      // Save research_data to DB
      await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ research_data: d }),
      })
      // Check if research found new contact info
      const suggestion: { email?: string; phone?: string; website?: string } = {}
      if (d.found_email && d.found_email !== lead.email) suggestion.email = d.found_email
      if (d.found_phone && d.found_phone !== lead.phone) suggestion.phone = d.found_phone
      if (d.website && d.website !== lead.website) suggestion.website = d.website
      if (Object.keys(suggestion).length > 0) setContactSuggestion(suggestion)
    } finally { setIsResearching(false) }
  }

  async function applyContactSuggestion() {
    if (!contactSuggestion) return
    setUpdatingContact(true)
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contactSuggestion),
    })
    const d = await res.json()
    if (d.lead) {
      setLead(d.lead)
      setContactSuggestion(null)
    }
    setUpdatingContact(false)
  }

  function copyCallScript() {
    if (!callScript) return
    const text = [
      `OPENING:\n${callScript.opening}`,
      `\nDISCOVERY QUESTIONS:\n${callScript.discovery}`,
      `\nPITCH:\n${callScript.pitch}`,
      `\nOBJECTIONS:\n${callScript.objections.map(o => `Q: ${o.obj}\nA: ${o.response}`).join('\n\n')}`,
      `\nCLOSING:\n${callScript.closing}`,
    ].join('\n')
    navigator.clipboard.writeText(text)
    setScriptCopied(true)
    setTimeout(() => setScriptCopied(false), 2000)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Back nav */}
      <div className="mb-5">
        <Link href="/leads" className="text-slate-500 hover:text-slate-300 text-sm transition-colors flex items-center gap-1">
          ← Back to Leads
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT — Lead profile */}
        <div className="lg:col-span-1 space-y-4">
          {/* Avatar + name card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-3">
              <LeadAvatar key={(research?.icon_url ?? logoDomain) ?? 'fallback'} domain={logoDomain} initials={initials} iconUrl={research?.icon_url} />
            </div>
            <h1 className="text-white font-semibold text-lg">{lead.name}</h1>
            {lead.job_title && <p className="text-slate-400 text-sm">{lead.job_title}</p>}
            {lead.company && <p className="text-slate-500 text-xs">{lead.company}</p>}
            <div className="flex justify-center gap-2 mt-3">
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${stageMeta.color}`}>{stageMeta.label}</span>
            </div>
          </div>

          {/* Contact info */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Contact</h2>
            <div className="space-y-2.5">
              {lead.email && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">📧</span>
                  <a href={`mailto:${lead.email}`} className="text-violet-400 hover:text-violet-300 truncate">{lead.email}</a>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">📞</span>
                  <a href={`tel:${lead.phone}`} className="text-slate-300 hover:text-white">{lead.phone}</a>
                </div>
              )}
              {lead.company && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">🏢</span>
                  <span className="text-slate-300">{lead.company}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">{sourceMeta.icon}</span>
                <span className="text-slate-400">{sourceMeta.label}</span>
              </div>
            </div>
          </div>

          {/* Deal value */}
          <DealCard leadId={lead.id} />

          {/* Lead score */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider">Lead Score</h2>
              <button
                onClick={async () => {
                  setIsScoringAI(true)
                  setScoreReasoning('')
                  try {
                    const res = await fetch('/api/leads/score', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ lead_id: lead.id }),
                    })
                    const data = await res.json()
                    if (data.score !== undefined) {
                      setLead(prev => ({ ...prev, score: data.score }))
                      setScoreReasoning(data.reasoning || '')
                    }
                  } finally {
                    setIsScoringAI(false)
                  }
                }}
                disabled={isScoringAI}
                className="text-xs text-violet-400 hover:text-violet-300 disabled:opacity-50 transition-colors"
              >
                {isScoringAI ? '…' : '✨ AI Score'}
              </button>
            </div>
            <ScoreBar score={lead.score} />
            <p className="text-slate-500 text-xs mt-2">
              {scoreReasoning || (lead.score >= 70 ? 'Hot lead — prioritize follow-up' : lead.score >= 40 ? 'Warm lead — nurture further' : 'Cold lead — needs engagement')}
            </p>
          </div>

          {/* Stage pipeline */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Move Stage</h2>
            <div className="space-y-1.5">
              {(Object.keys(STAGE_META) as LeadStage[]).map(s => (
                <button
                  key={s}
                  onClick={() => handleStageChange(s)}
                  className={`w-full text-left text-xs font-medium px-3 py-2 rounded-lg transition-colors ${
                    lead.stage === s
                      ? STAGE_META[s].color
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {lead.stage === s ? '● ' : '○ '}{STAGE_META[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Assign to team member */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Assigned To</h2>
            {isAssigning ? (
              <p className="text-slate-500 text-xs">Saving…</p>
            ) : (
              <div className="space-y-1.5">
                <button
                  onClick={() => handleAssign(null)}
                  className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
                    !assignedTo ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {!assignedTo ? '● ' : '○ '}Unassigned
                </button>
                {teamMembers.map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleAssign(m.id)}
                    className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
                      assignedTo === m.id ? 'bg-violet-900/50 text-violet-300' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {assignedTo === m.id ? '● ' : '○ '}{m.name}
                    <span className="ml-1 text-slate-600 capitalize">({m.role})</span>
                  </button>
                ))}
                {teamMembers.length === 0 && (
                  <p className="text-slate-600 text-xs px-3">No team members yet</p>
                )}
              </div>
            )}
          </div>

          {/* AI Email Drafter */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">AI Outreach Email</h2>
            <div className="flex gap-1.5 mb-3">
              {(['professional', 'friendly', 'urgent'] as const).map(t => (
                <button key={t} onClick={() => setEmailTone(t)}
                  className={`flex-1 text-[10px] py-1.5 rounded-lg capitalize transition-colors ${
                    emailTone === t ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
            <button
              onClick={draftEmail}
              disabled={isDraftingEmail}
              className="w-full text-xs text-violet-400 hover:text-violet-300 bg-violet-950/30 border border-violet-800/30 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {isDraftingEmail ? '✨ Drafting…' : '✨ Draft Email'}
            </button>
            {showEmailDraft && emailDraft && (
              <div className="mt-3 bg-slate-800 rounded-lg p-3">
                <p className="text-violet-300 text-[10px] font-medium mb-1">Subject: {emailDraft.subject}</p>
                <p className="text-slate-300 text-[10px] leading-relaxed whitespace-pre-wrap">{emailDraft.email}</p>
                <button
                  onClick={copyEmail}
                  className="mt-2 text-[10px] text-slate-400 hover:text-white transition-colors"
                >
                  {emailCopied ? '✓ Copied!' : '📋 Copy email'}
                </button>
              </div>
            )}
          </div>

          {/* Review Request — shown when lead is won */}
          {lead.stage === 'won' && (
            <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-5">
              <h2 className="text-emerald-400 text-xs font-medium uppercase tracking-wider mb-1">Request a Review</h2>
              <p className="text-slate-500 text-xs mb-3">This lead is won — ask them to leave you a review.</p>
              {reviewRequested ? (
                <div className="flex items-center gap-2 text-emerald-400 text-xs">
                  <span>✓</span>
                  <span>Review request logged! Check your Agent Inbox.</span>
                </div>
              ) : (
                <button
                  onClick={requestReview}
                  disabled={isRequestingReview}
                  className="w-full text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isRequestingReview ? '…' : '⭐ Send Review Request'}
                </button>
              )}
            </div>
          )}

          {/* Danger zone */}
          <div className="bg-slate-900 border border-red-900/30 rounded-2xl p-5">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full text-sm text-red-400 hover:text-red-300 py-1 transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Deleting…' : 'Delete Lead'}
            </button>
          </div>
        </div>

        {/* RIGHT — Details + activity */}
        <div className="lg:col-span-2 space-y-4">
          {/* Profile detail card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Lead Details</h2>
              {!editing ? (
                <button onClick={() => setEditing(true)} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
                  <button onClick={handleSave} disabled={isSaving} className="text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-3 py-1 rounded-md transition-colors">
                    {isSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Full Name', key: 'name' as const },
                    { label: 'Email', key: 'email' as const },
                    { label: 'Phone', key: 'phone' as const },
                    { label: 'Company', key: 'company' as const },
                    { label: 'Job Title', key: 'job_title' as const },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                      <input
                        value={form[f.key]}
                        onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Score (0-100)</label>
                    <input
                      type="number" min="0" max="100"
                      value={form.score}
                      onChange={e => setForm(prev => ({ ...prev, score: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={4}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                {[
                  { label: 'Email', value: lead.email },
                  { label: 'Phone', value: lead.phone },
                  { label: 'Company', value: lead.company },
                  { label: 'Job Title', value: lead.job_title },
                  { label: 'Source', value: `${sourceMeta.icon} ${sourceMeta.label}` },
                  { label: 'Added', value: new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                ].map(f => (
                  <div key={f.label}>
                    <p className="text-slate-500 text-xs mb-0.5">{f.label}</p>
                    <p className="text-slate-200 text-sm">{f.value || <span className="text-slate-600">—</span>}</p>
                  </div>
                ))}
                {lead.notes && (
                  <div className="col-span-2">
                    <p className="text-slate-500 text-xs mb-1">Notes</p>
                    <p className="text-slate-200 text-sm whitespace-pre-wrap">{lead.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── AI Tools Panel ─────────────────────────────────────────── */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/40">
              <div className="flex items-center gap-2">
                <span className="text-lg">✨</span>
                <h2 className="text-white font-semibold">AI Assistant</h2>
              </div>
              {/* Tabs — Research first */}
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                {([
                  { key: 'research', label: '🔍 Research',    color: 'bg-blue-600' },
                  { key: 'email',    label: '📧 Email',       color: 'bg-violet-600' },
                  { key: 'call',     label: '📞 Call Script', color: 'bg-emerald-600' },
                ] as const).map(t => (
                  <button key={t.key} onClick={() => setAiTab(t.key)}
                    className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
                      aiTab === t.key ? `${t.color} text-white` : 'text-slate-400 hover:text-slate-200'
                    }`}>
                    {t.label}
                    {t.key === 'research' && research && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {/* ── EMAIL TAB ── */}
              {aiTab === 'email' && (
                <div className="space-y-4">
                  {research
                    ? <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-800/30 px-3 py-2 rounded-lg">
                        <span>✓</span> Using research intelligence — email will be highly personalized
                      </div>
                    : <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/20 border border-amber-700/30 px-3 py-2 rounded-lg">
                        <span>💡</span> Run <button onClick={() => setAiTab('research')} className="underline hover:text-amber-300">Research</button> first for a more personalized email
                      </div>
                  }
                  {products.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Product / Service <span className="text-slate-600">(optional)</span></p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setSelectedProductId(null)}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                            selectedProductId === null
                              ? 'bg-slate-700 border-slate-600 text-slate-200'
                              : 'border-slate-700 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          General (business)
                        </button>
                        {products.map(p => (
                          <button
                            key={p.id}
                            onClick={() => setSelectedProductId(p.id === selectedProductId ? null : p.id)}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                              selectedProductId === p.id
                                ? 'bg-violet-600/20 border-violet-600/50 text-violet-300'
                                : 'border-slate-700 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-xs">Tone:</span>
                    <div className="flex gap-1.5">
                      {(['professional', 'friendly', 'urgent'] as const).map(t => (
                        <button key={t} onClick={() => setEmailTone(t)}
                          className={`text-xs px-3 py-1 rounded-full capitalize transition-colors ${
                            emailTone === t ? 'bg-violet-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}>
                          {t}
                        </button>
                      ))}
                    </div>
                    <button onClick={draftEmail} disabled={isDraftingEmail}
                      className="ml-auto flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
                      {isDraftingEmail
                        ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Drafting…</>
                        : '✨ Draft Email'}
                    </button>
                  </div>

                  {emailDraft && (
                    <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50 bg-slate-800/80">
                        <p className="text-violet-300 text-xs font-medium">Subject: {emailDraft.subject}</p>
                        <div className="flex items-center gap-2">
                          <button onClick={copyEmail}
                            className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                              emailCopied ? 'bg-emerald-600/30 border-emerald-600/40 text-emerald-300' : 'border-slate-600 text-slate-300 hover:bg-slate-700'
                            }`}>
                            {emailCopied ? '✓ Copied!' : '📋 Copy'}
                          </button>
                          {lead.email && (
                            <a href={`mailto:${lead.email}?subject=${encodeURIComponent(emailDraft.subject)}&body=${encodeURIComponent(emailDraft.email)}`}
                              className="text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1 rounded-lg transition-colors">
                              Open Mail →
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="p-4">
                        <textarea
                          defaultValue={emailDraft.email}
                          rows={8}
                          className="w-full bg-transparent text-slate-200 text-sm leading-relaxed resize-none focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {!emailDraft && !isDraftingEmail && (
                    <div className="py-8 text-center">
                      <p className="text-3xl mb-2">📧</p>
                      <p className="text-slate-500 text-sm">Click "Draft Email" to generate a personalized cold email for {lead.name}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── CALL SCRIPT TAB ── */}
              {aiTab === 'call' && (
                <div className="space-y-4">
                  {research
                    ? <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-800/30 px-3 py-2 rounded-lg">
                        <span>✓</span> Using research intelligence — script will be specific to {lead.company || lead.name}
                      </div>
                    : <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/20 border border-amber-700/30 px-3 py-2 rounded-lg">
                        <span>💡</span> Run <button onClick={() => setAiTab('research')} className="underline hover:text-amber-300">Research</button> first for a more targeted script
                      </div>
                  }
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400 text-sm">Personalized phone script for <strong className="text-slate-200">{lead.name}</strong></p>
                    <div className="flex items-center gap-2">
                      {callScript && (
                        <button onClick={copyCallScript}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                            scriptCopied ? 'bg-emerald-600/30 border-emerald-600/40 text-emerald-300' : 'border-slate-600 text-slate-300 hover:bg-slate-700'
                          }`}>
                          {scriptCopied ? '✓ Copied!' : '📋 Copy Script'}
                        </button>
                      )}
                      <button onClick={generateCallScript} disabled={isGeneratingScript}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
                        {isGeneratingScript
                          ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating…</>
                          : '✨ Generate Script'}
                      </button>
                    </div>
                  </div>

                  {callScript ? (
                    <div className="space-y-3">
                      {[
                        { label: '👋 Opening', content: callScript.opening, color: 'border-l-blue-500' },
                        { label: '❓ Discovery Questions', content: callScript.discovery, color: 'border-l-violet-500' },
                        { label: '💡 Value Pitch', content: callScript.pitch, color: 'border-l-emerald-500' },
                        { label: '🔒 Closing', content: callScript.closing, color: 'border-l-amber-500' },
                      ].map(section => (
                        <div key={section.label} className={`bg-slate-800/50 border border-slate-700 border-l-2 ${section.color} rounded-xl p-4`}>
                          <p className="text-xs font-semibold text-slate-300 mb-1.5">{section.label}</p>
                          <p className="text-slate-300 text-sm leading-relaxed">{section.content}</p>
                        </div>
                      ))}

                      {callScript.objections?.length > 0 && (
                        <div className="bg-slate-800/50 border border-slate-700 border-l-2 border-l-red-500 rounded-xl p-4">
                          <p className="text-xs font-semibold text-slate-300 mb-3">🛡️ Objection Handlers</p>
                          <div className="space-y-3">
                            {callScript.objections.map((o, i) => (
                              <div key={i} className="space-y-1">
                                <p className="text-red-300 text-xs font-medium">"{o.obj}"</p>
                                <p className="text-slate-300 text-sm leading-relaxed pl-3 border-l border-slate-600">→ {o.response}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : !isGeneratingScript ? (
                    <div className="py-8 text-center">
                      <p className="text-3xl mb-2">📞</p>
                      <p className="text-slate-500 text-sm">AI will write a complete phone script with opening, pitch, objection handlers, and closing</p>
                    </div>
                  ) : (
                    <div className="space-y-3 animate-pulse">
                      {[1,2,3,4].map(i => <div key={i} className="h-20 bg-slate-800 rounded-xl" />)}
                    </div>
                  )}
                </div>
              )}

              {/* ── RESEARCH TAB ── */}
              {aiTab === 'research' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400 text-sm">
                      Web research on <strong className="text-slate-200">{lead.company || lead.name}</strong>
                      {research && <span className="ml-2 text-emerald-400 text-xs">✓ Saved · used by Email & Call Script</span>}
                    </p>
                    <button onClick={researchLead} disabled={isResearching}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
                      {isResearching
                        ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Researching…</>
                        : research ? '🔄 Re-research' : '🔍 Research Lead'}
                    </button>
                  </div>

                  {/* Contact suggestion banner */}
                  {contactSuggestion && (
                    <div className="bg-amber-950/30 border border-amber-700/40 rounded-xl p-4 flex items-start gap-3">
                      <span className="text-amber-400 text-lg shrink-0">💡</span>
                      <div className="flex-1">
                        <p className="text-amber-300 text-xs font-semibold mb-1">Research found new contact info!</p>
                        <div className="space-y-0.5">
                          {contactSuggestion.email   && <p className="text-slate-300 text-xs">📧 {contactSuggestion.email}</p>}
                          {contactSuggestion.phone   && <p className="text-slate-300 text-xs">📞 {contactSuggestion.phone}</p>}
                          {contactSuggestion.website && <p className="text-slate-300 text-xs">🌐 {contactSuggestion.website}</p>}
                        </div>
                      </div>
                      <button onClick={applyContactSuggestion} disabled={updatingContact}
                        className="shrink-0 text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors">
                        {updatingContact ? 'Saving…' : 'Update Lead →'}
                      </button>
                    </div>
                  )}

                  {research ? (
                    <div className="space-y-4">
                      {/* Summary */}
                      <div className="bg-blue-950/20 border border-blue-800/30 rounded-xl p-4">
                        <p className="text-blue-300 text-xs font-semibold mb-1.5">📋 Summary</p>
                        <p className="text-slate-200 text-sm leading-relaxed">{research.summary}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                          <p className="text-xs font-semibold text-slate-400 mb-1">👤 Decision Maker</p>
                          <p className="text-slate-200 text-sm">{research.decision_maker}</p>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                          <p className="text-xs font-semibold text-slate-400 mb-1">📅 Best Time to Contact</p>
                          <p className="text-slate-200 text-sm">{research.best_time_to_contact}</p>
                        </div>
                        {research.website && (
                          <div className="col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                            <p className="text-xs font-semibold text-slate-400 mb-1">🌐 Website</p>
                            <a href={research.website.startsWith('http') ? research.website : `https://${research.website}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 text-sm underline-offset-2 hover:underline">
                              {research.website}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Insights */}
                      {research.insights?.length > 0 && (
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                          <p className="text-xs font-semibold text-slate-400 mb-2.5">💡 Key Insights</p>
                          <ul className="space-y-1.5">
                            {research.insights.map((ins, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                <span className="text-blue-400 shrink-0 mt-px">•</span>{ins}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Talking Points */}
                      {research.talking_points?.length > 0 && (
                        <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-4">
                          <p className="text-xs font-semibold text-emerald-400 mb-2.5">🎯 Talking Points</p>
                          <ul className="space-y-1.5">
                            {research.talking_points.map((tp, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                <span className="text-emerald-400 shrink-0 mt-px">→</span>{tp}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Sources */}
                      {research.sources && research.sources.length > 0 && (
                        <div className="border-t border-slate-800 pt-3">
                          <p className="text-xs text-slate-600 mb-1.5">Sources:</p>
                          <div className="flex flex-wrap gap-2">
                            {research.sources.map((s, i) => (
                              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-700 px-2 py-0.5 rounded-full transition-colors truncate max-w-[180px]">
                                {s.title || s.url}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : !isResearching ? (
                    <div className="py-8 text-center">
                      <p className="text-3xl mb-2">🔍</p>
                      <p className="text-slate-500 text-sm">AI searches the web and analyzes this lead — gives you insights, talking points, and who to contact</p>
                    </div>
                  ) : (
                    <div className="space-y-3 animate-pulse">
                      <div className="h-24 bg-slate-800 rounded-xl" />
                      <div className="grid grid-cols-2 gap-3">
                        <div className="h-16 bg-slate-800 rounded-xl" />
                        <div className="h-16 bg-slate-800 rounded-xl" />
                      </div>
                      <div className="h-28 bg-slate-800 rounded-xl" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Activity timeline */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Activity Timeline</h2>
              <button
                onClick={() => setShowActivityForm(prev => !prev)}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
              >
                + Log Activity
              </button>
            </div>

            {/* Log activity form */}
            {showActivityForm && (
              <div className="mb-5 bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {LOGGABLE.map(t => {
                    const m = ACTIVITY_META[t]
                    return (
                      <button
                        key={t}
                        onClick={() => setActivityType(t)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          activityType === t
                            ? 'border-violet-500/50 bg-violet-600/20 text-violet-300'
                            : 'border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        {m.icon} {m.label}
                      </button>
                    )
                  })}
                </div>
                <textarea
                  value={activityNote}
                  onChange={e => setActivityNote(e.target.value)}
                  placeholder="Add a note about this activity…"
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowActivityForm(false)} className="text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
                  <button
                    onClick={handleLogActivity}
                    disabled={isLoggingActivity}
                    className="text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition-colors"
                  >
                    {isLoggingActivity ? 'Saving…' : 'Log Activity'}
                  </button>
                </div>
              </div>
            )}

            {/* Timeline */}
            {activities.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-600 text-sm">No activity yet. Log a call, email, or note to get started.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {activities.map((activity, idx) => {
                  const m = ACTIVITY_META[activity.type] || { label: activity.type, icon: '📌', color: 'text-slate-400' }
                  const note = (activity.data_json as { note?: string; from?: string; to?: string } | null)
                  return (
                    <div key={activity.id} className="relative flex gap-4 pb-5">
                      {/* Line */}
                      {idx < activities.length - 1 && (
                        <div className="absolute left-4 top-8 bottom-0 w-px bg-slate-800" />
                      )}
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm ${m.color}`}>
                        {m.icon}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${m.color}`}>{m.label}</span>
                          <span className="text-slate-600 text-xs">{timeAgo(activity.created_at)}</span>
                        </div>
                        {note?.note && <p className="text-slate-400 text-sm mt-0.5">{note.note}</p>}
                        {note?.from && note?.to && (
                          <p className="text-slate-500 text-xs mt-0.5">
                            {STAGE_META[note.from as LeadStage]?.label || note.from} → {STAGE_META[note.to as LeadStage]?.label || note.to}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
