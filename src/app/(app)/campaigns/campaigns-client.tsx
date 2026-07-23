'use client'

import { useState, useEffect } from 'react'
import { AIPageContext } from '@/components/ui/ai-page-context'

interface Campaign {
  id: string
  name: string
  subject: string
  from_name: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent'
  recipient_count: number
  sent_count: number
  open_count: number
  click_count: number
  scheduled_at: string | null
  sent_at: string | null
  created_at: string
}

const STATUS_BADGE: Record<Campaign['status'], string> = {
  draft:     'bg-slate-800 text-slate-300 border-slate-700',
  scheduled: 'bg-blue-900/50 text-blue-300 border-blue-800/40',
  sending:   'bg-slate-900/50 text-blue-300 border-slate-700/40',
  sent:      'bg-slate-900/50 text-blue-300 border-slate-700/40',
}

const STATUS_LABEL: Record<Campaign['status'], string> = {
  draft: 'Draft', scheduled: 'Scheduled', sending: 'Sending…', sent: 'Sent',
}

const SEGMENTS = [
  { value: 'all',       label: 'All Leads' },
  { value: 'new',       label: 'New Leads' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal',  label: 'Proposal Sent' },
  { value: 'won',       label: 'Won Clients' },
]

const TONES = ['Professional', 'Friendly', 'Urgent', 'Inspirational', 'Concise']

function CreateCampaignModal({
  onClose, onCreated, businessName,
}: {
  onClose: () => void
  onCreated: (c: Campaign) => void
  businessName: string
}) {
  const [step, setStep] = useState<'details' | 'content'>('details')
  const [form, setForm] = useState({ name: '', subject: '', from_name: '', segment: 'all', scheduled_at: '' })
  const [content, setContent] = useState('')
  const [aiGoal, setAiGoal] = useState('')
  const [aiTone, setAiTone] = useState('Professional')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function generateContent() {
    setGenerating(true)
    try {
      const res = await fetch('/api/campaigns/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: aiGoal || form.name, tone: aiTone, business_name: businessName }),
      })
      const data = await res.json()
      if (data.content) setContent(data.content)
    } finally {
      setGenerating(false)
    }
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, content, scheduled_at: form.scheduled_at || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      onCreated(data.campaign)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h2 className="text-white font-semibold">New Campaign</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              {step === 'details' ? 'Step 1 of 2 — Campaign setup' : 'Step 2 of 2 — Email content'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl transition-colors">×</button>
        </div>

        <div className="p-5">
          {step === 'details' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Campaign Name *</label>
                  <input value={form.name} onChange={set('name')} placeholder="e.g. Q3 Newsletter"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">From Name</label>
                  <input value={form.from_name} onChange={set('from_name')} placeholder={`The ${businessName} Team`}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Email Subject Line *</label>
                <input value={form.subject} onChange={set('subject')} placeholder="e.g. Our biggest update yet — here's what's new"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Recipient Segment</label>
                  <select value={form.segment} onChange={set('segment')}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors">
                    {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Schedule (optional)</label>
                  <input type="datetime-local" value={form.scheduled_at} onChange={set('scheduled_at')}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={() => setStep('content')} disabled={!form.name || !form.subject}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
                  Next: Write Content →
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-950/20 border border-slate-700/30 rounded-xl p-4 space-y-3">
                <p className="text-blue-300 text-sm font-medium">✨ AI Content Generator</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Campaign goal</label>
                    <input value={aiGoal} onChange={e => setAiGoal(e.target.value)} placeholder="e.g. announce new feature, drive sales"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Tone</label>
                    <select value={aiTone} onChange={e => setAiTone(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors">
                      {TONES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={generateContent} disabled={generating}
                  className="w-full bg-blue-600/80 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
                  {generating
                    ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating…</>
                    : '✨ Generate Email Content'}
                </button>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Email Body</label>
                <textarea value={content} onChange={e => setContent(e.target.value)} rows={10}
                  placeholder={'Write your email body here, or use the AI generator above…\n\nTip: Use {{first_name}} for personalization.'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-none font-mono text-xs" />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep('details')}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-lg transition-colors">
                  ← Back
                </button>
                <button onClick={save} disabled={saving || !content.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
                  {saving ? 'Saving…' : form.scheduled_at ? 'Schedule Campaign' : 'Save as Draft'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PreviewModal({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h2 className="text-white font-semibold">{campaign.name}</h2>
            <p className="text-slate-500 text-xs mt-0.5">Campaign details</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl transition-colors">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-900 rounded-xl p-4 space-y-2.5">
            {[
              { label: 'From',       value: campaign.from_name },
              { label: 'Subject',    value: campaign.subject },
              { label: 'Recipients', value: `${campaign.recipient_count} contacts` },
              { label: 'Status',     value: null },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{row.label}:</span>
                {row.value
                  ? <span className="text-slate-300">{row.value}</span>
                  : <span className={`inline-flex px-2.5 py-0.5 rounded-full border text-xs font-medium ${STATUS_BADGE[campaign.status]}`}>{STATUS_LABEL[campaign.status]}</span>
                }
              </div>
            ))}
          </div>

          {campaign.status === 'sent' && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Sent',    value: campaign.sent_count },
                { label: 'Opened',  pct: campaign.sent_count ? Math.round(campaign.open_count / campaign.sent_count * 100) : 0 },
                { label: 'Clicked', pct: campaign.sent_count ? Math.round(campaign.click_count / campaign.sent_count * 100) : 0 },
              ].map(m => (
                <div key={m.label} className="bg-slate-900 rounded-xl p-4 text-center">
                  <p className="text-white font-bold text-2xl">{m.pct !== undefined ? `${m.pct}%` : m.value}</p>
                  <p className="text-slate-500 text-xs mt-1">{m.label}</p>
                </div>
              ))}
            </div>
          )}

          {campaign.scheduled_at && campaign.status === 'scheduled' && (
            <div className="bg-blue-950/30 border border-blue-800/30 rounded-xl p-3 text-center">
              <p className="text-blue-300 text-sm font-medium">
                Scheduled for {new Date(campaign.scheduled_at).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
              </p>
              <p className="text-slate-500 text-xs mt-1">Auto-sends when time arrives (cron every 15 min)</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type EmailSettings = Record<string, string | boolean>


function getEmailStatus(settings: EmailSettings, serverResend: boolean) {
  const method  = settings.method as string | undefined
  const hasName = !!(settings.from_name)

  if (method === 'gmail' && settings.smtp_user && settings.smtp_pass) {
    return { ready: true, icon: '📧', label: 'Gmail', from: settings.from_email as string || settings.smtp_user as string }
  }
  if (method === 'outlook' && settings.smtp_user && settings.smtp_pass) {
    return { ready: true, icon: '📨', label: 'Outlook / 365', from: settings.from_email as string || settings.smtp_user as string }
  }
  if (method === 'smtp' && settings.smtp_host && settings.smtp_user && settings.smtp_pass) {
    return { ready: true, icon: '🔧', label: 'Custom SMTP', from: settings.from_email as string || settings.smtp_user as string }
  }
  if (method === 'resend' && settings.resend_api_key && settings.resend_from_email) {
    return { ready: true, icon: '⚡', label: 'Resend', from: settings.resend_from_email as string }
  }
  if (method === 'sendgrid' && settings.sendgrid_api_key && settings.sendgrid_from_email) {
    return { ready: true, icon: '📮', label: 'SendGrid', from: settings.sendgrid_from_email as string }
  }
  if (method === 'mailgun' && settings.mailgun_api_key && settings.mailgun_domain) {
    return { ready: true, icon: '🔫', label: 'Mailgun', from: settings.from_email as string || `noreply@${settings.mailgun_domain}` }
  }
  if (method === 'brevo' && settings.brevo_api_key && settings.brevo_login) {
    return { ready: true, icon: '💌', label: 'Brevo', from: settings.brevo_from_email as string || settings.brevo_login as string }
  }
  if (method === 'postmark' && settings.postmark_api_key && settings.postmark_from_email) {
    return { ready: true, icon: '📬', label: 'Postmark', from: settings.postmark_from_email as string }
  }
  // Default: CooVex platform (needs From Name)
  if (serverResend && hasName) {
    return { ready: true, icon: '🚀', label: 'CooVex platform', from: 'noreply@coovex.com' }
  }
  if (serverResend && !hasName) {
    return { ready: false, needsName: true }
  }
  return { ready: false, needsName: false }
}

function isEmailReady(settings: EmailSettings, serverResend: boolean): boolean {
  return getEmailStatus(settings, serverResend).ready
}

function EmailConnectionBanner({ settings, serverResend }: { settings: EmailSettings; serverResend: boolean }) {
  const status = getEmailStatus(settings, serverResend)

  if (status.ready) {
    return (
      <div className="bg-slate-950/20 border border-slate-700/30 rounded-2xl p-4 mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{status.icon}</span>
          <div>
            <p className="text-blue-300 text-sm font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block animate-pulse" />
              Email sending ready
            </p>
            <p className="text-slate-400 text-xs mt-0.5">
              Via {status.label}
              {status.from && <span className="text-slate-500"> · Reply-To: {String(settings.reply_to || status.from)}</span>}
            </p>
          </div>
        </div>
        <a href="/settings/email" className="text-xs text-slate-500 hover:text-slate-300 transition-colors whitespace-nowrap flex-shrink-0">
          Change settings →
        </a>
      </div>
    )
  }

  if (status.needsName) {
    // Platform Resend is ready, just needs From Name
    return (
      <div className="bg-blue-950/20 border border-blue-800/30 rounded-2xl p-5 mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">✉️</span>
          <div>
            <p className="text-blue-300 text-sm font-semibold">Almost ready — set your From Name</p>
            <p className="text-slate-400 text-xs mt-0.5">
              CooVex will send your campaigns. Just add your business name and a reply-to email so recipients know who it&apos;s from.
            </p>
          </div>
        </div>
        <a href="/settings/email"
          className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
          Set up now →
        </a>
      </div>
    )
  }

  // Nothing configured at all (shouldn't happen in production since platform always has Resend)
  return (
    <div className="bg-slate-900 border border-slate-700/40 rounded-2xl p-5 mb-6 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚙️</span>
        <div>
          <p className="text-slate-400 text-sm font-semibold">Set your sender details</p>
          <p className="text-slate-400 text-xs mt-0.5">
            Add your business name and reply-to email to start sending campaigns.
          </p>
        </div>
      </div>
      <a href="/settings/email"
        className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
        Configure →
      </a>
    </div>
  )
}

export default function CampaignsClient({
  businessName,
  emailSettings,
  serverResendReady,
}: {
  businessName: string
  emailSettings: EmailSettings
  serverResendReady: boolean
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [preview, setPreview] = useState<Campaign | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [sendMsg, setSendMsg] = useState<{ id: string; msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/campaigns')
      .then(r => r.json())
      .then(d => setCampaigns(d.campaigns || []))
      .finally(() => setLoading(false))
  }, [])

  const sentCampaigns = campaigns.filter(c => c.status === 'sent')
  const totalSent  = sentCampaigns.reduce((n, c) => n + c.sent_count, 0)
  const totalOpens = sentCampaigns.reduce((n, c) => n + c.open_count, 0)
  const avgOpenRate = totalSent ? Math.round(totalOpens / totalSent * 100) : 0

  async function sendNow(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!isEmailReady(emailSettings, serverResendReady)) {
      setSendMsg({ id, msg: 'Set up email sending first — go to Settings → Email Sending.', ok: false })
      setTimeout(() => setSendMsg(null), 4000)
      return
    }
    setSending(id)
    try {
      const res = await fetch(`/api/campaigns/${id}/send`, { method: 'POST' })
      const data = await res.json()
      if (data.status === 'resend_not_configured') {
        setSendMsg({ id, msg: 'Resend not configured.', ok: false })
      } else if (data.status === 'no_recipients') {
        setSendMsg({ id, msg: data.message, ok: false })
      } else if (data.status === 'ok') {
        setSendMsg({ id, msg: `✓ Sent to ${data.sent} recipient${data.sent !== 1 ? 's' : ''}`, ok: true })
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'sent', sent_count: data.sent } : c))
      }
    } finally {
      setSending(null)
      setTimeout(() => setSendMsg(null), 4000)
    }
  }

  async function deleteCampaign(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this campaign?')) return
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
    setCampaigns(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <AIPageContext
        title="AI Email Campaign Engine"
        subtitle="AI writes your campaign copy, segments your audience, schedules delivery, and tracks every open — you just review and send."
        accent="violet"
        automations={[
          'Writes complete email campaigns from a single goal/topic',
          'Auto-segments leads: new, qualified, won clients, etc.',
          'Schedules and sends campaigns at the right time',
          'Tracks open rate, click rate per campaign',
          'Auto-sends scheduled campaigns every 15 minutes via cron',
        ]}
        manual={['Write subject line & goal', 'Choose audience segment', 'Hit Send Now or schedule']}
      />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Email Campaigns</h1>
          <p className="text-slate-400 text-sm mt-1">AI-drafted campaigns sent to your lead segments</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/campaigns/drip"
            className="text-sm text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 px-4 py-2.5 rounded-lg transition-colors">
            🔄 Drip Sequences
          </a>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
            <span className="text-lg leading-none">+</span> New Campaign
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Campaigns', value: campaigns.length },
          { label: 'Sent',            value: sentCampaigns.length },
          { label: 'Avg Open Rate',   value: `${avgOpenRate}%` },
          { label: 'Scheduled',       value: campaigns.filter(c => c.status === 'scheduled').length },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-slate-500 text-sm mb-2">{s.label}</p>
            <p className="text-white text-4xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Email connection banner */}
      <EmailConnectionBanner settings={emailSettings} serverResend={serverResendReady} />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-900 rounded-xl animate-pulse" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 text-center">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-white font-semibold text-lg mb-2">No campaigns yet</h2>
          <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
            Create your first email campaign — AI will write compelling copy in seconds.
          </p>
          <button onClick={() => setShowCreate(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-6 py-3 rounded-xl transition-colors">
            Create First Campaign
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} onClick={() => setPreview(c)}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 cursor-pointer transition-colors group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-white font-semibold text-base">{c.name}</h3>
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full border text-xs font-medium ${STATUS_BADGE[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm truncate">{c.subject}</p>
                  <p className="text-slate-600 text-xs mt-1">From: {c.from_name} · {c.recipient_count} recipients</p>
                  {sendMsg?.id === c.id && (
                    <p className={`text-xs mt-1.5 font-medium ${sendMsg.ok ? 'text-blue-400' : 'text-slate-500'}`}>
                      {sendMsg.msg}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {c.status === 'sent' ? (
                    <>
                      <div className="text-center">
                        <p className="text-white text-sm font-bold">{c.sent_count ? Math.round(c.open_count / c.sent_count * 100) : 0}%</p>
                        <p className="text-slate-600 text-xs">Open</p>
                      </div>
                      <div className="text-center">
                        <p className="text-white text-sm font-bold">{c.sent_count ? Math.round(c.click_count / c.sent_count * 100) : 0}%</p>
                        <p className="text-slate-600 text-xs">Click</p>
                      </div>
                    </>
                  ) : c.status === 'scheduled' ? (
                    <div className="text-right">
                      <p className="text-blue-300 text-sm font-medium">
                        {new Date(c.scheduled_at!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-slate-600 text-xs">Scheduled</p>
                    </div>
                  ) : null}

                  {/* Send Now — only for draft/scheduled */}
                  {(c.status === 'draft' || c.status === 'scheduled') && (
                    <button
                      onClick={e => sendNow(c.id, e)}
                      disabled={sending === c.id}
                      className="text-sm bg-blue-600/20 hover:bg-blue-600/40 border border-slate-700/50 text-blue-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {sending === c.id
                        ? <span className="flex items-center gap-1.5"><span className="w-3 h-3 border border-blue-300/30 border-t-violet-300 rounded-full animate-spin inline-block" />Sending…</span>
                        : '▶ Send Now'}
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    onClick={e => deleteCampaign(c.id, e)}
                    className="text-sm text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all px-2 py-1.5"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onCreated={c => setCampaigns(prev => [c, ...prev])}
          businessName={businessName}
        />
      )}

      {preview && <PreviewModal campaign={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
