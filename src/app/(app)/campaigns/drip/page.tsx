'use client'

import { useState } from 'react'

interface DripStep {
  id: string
  day: number
  subject: string
  content: string
  type: 'email' | 'wait'
}

interface DripSequence {
  id: string
  name: string
  trigger: string
  segment: string
  active: boolean
  steps: DripStep[]
  enrolledCount: number
  createdAt: string
}

const TRIGGERS = [
  { value: 'new_lead',      label: 'New Lead Added' },
  { value: 'lead_qualified', label: 'Lead Qualified' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'no_reply_7d',   label: 'No Reply in 7 Days' },
  { value: 'won_deal',      label: 'Deal Won (Onboarding)' },
]

const SEGMENTS = [
  { value: 'all',       label: 'All Leads' },
  { value: 'new',       label: 'New Leads' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'cold',      label: 'Cold Leads' },
]

const SAMPLE_SEQUENCES: DripSequence[] = [
  {
    id: 'demo-1',
    name: 'New Lead Welcome',
    trigger: 'new_lead',
    segment: 'new',
    active: true,
    enrolledCount: 24,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    steps: [
      { id: '1', day: 0, type: 'email', subject: 'Welcome — here\'s what to expect', content: 'Hi {{first_name}}, thanks for your interest. Here\'s what we\'ll help you achieve…' },
      { id: '2', day: 3, type: 'email', subject: 'Quick question about your goals', content: 'Hi {{first_name}}, I wanted to follow up and ask — what\'s your biggest challenge right now?' },
      { id: '3', day: 7, type: 'email', subject: 'How [similar business] grew 40% in 90 days', content: 'Hi {{first_name}}, I thought you\'d find this case study interesting…' },
    ],
  },
]

function StepCard({
  step,
  index,
  onUpdate,
  onDelete,
  onGenerate,
  generating,
}: {
  step: DripStep
  index: number
  onUpdate: (s: DripStep) => void
  onDelete: () => void
  onGenerate: (stepId: string) => void
  generating: string | null
}) {
  return (
    <div className="relative pl-8">
      {/* Timeline line */}
      <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-800" />
      <div className="absolute left-1.5 top-4 w-3 h-3 rounded-full bg-blue-600 border-2 border-slate-950" />

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-slate-500 text-xs">
            {step.day === 0 ? 'Immediately' : `Day ${step.day}`}
          </span>
          <span className="text-blue-400 text-xs font-medium">— Email {index + 1}</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => onGenerate(step.id)}
              disabled={generating === step.id}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              {generating === step.id ? '…' : '✨ AI Write'}
            </button>
            <button onClick={onDelete} className="text-xs text-slate-600 hover:text-red-400 transition-colors">×</button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 w-12 flex-shrink-0">Day</label>
            <input
              type="number" min={0}
              value={step.day}
              onChange={e => onUpdate({ ...step, day: parseInt(e.target.value) || 0 })}
              className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <input
              value={step.subject}
              onChange={e => onUpdate({ ...step, subject: e.target.value })}
              placeholder="Email subject line"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <textarea
              value={step.content}
              onChange={e => onUpdate({ ...step, content: e.target.value })}
              placeholder="Email body preview…"
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function SequenceBuilder({ onSave, onCancel }: { onSave: (s: DripSequence) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState('new_lead')
  const [segment, setSegment] = useState('all')
  const [steps, setSteps] = useState<DripStep[]>([
    { id: '1', day: 0, type: 'email', subject: '', content: '' },
    { id: '2', day: 3, type: 'email', subject: '', content: '' },
    { id: '3', day: 7, type: 'email', subject: '', content: '' },
  ])
  const [generating, setGenerating] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const addStep = () => {
    const lastDay = steps[steps.length - 1]?.day ?? 0
    setSteps(prev => [...prev, {
      id: Date.now().toString(),
      day: lastDay + 3,
      type: 'email',
      subject: '',
      content: '',
    }])
  }

  const updateStep = (id: string, updated: DripStep) =>
    setSteps(prev => prev.map(s => s.id === id ? updated : s))

  const deleteStep = (id: string) =>
    setSteps(prev => prev.filter(s => s.id !== id))

  const generateContent = async (stepId: string) => {
    setGenerating(stepId)
    const step = steps.find(s => s.id === stepId)
    if (!step) { setGenerating(null); return }
    try {
      const res = await fetch('/api/campaigns/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: `${TRIGGERS.find(t => t.value === trigger)?.label} — email ${steps.indexOf(step) + 1} of ${steps.length}`,
          tone: 'Professional',
        }),
      })
      const data = await res.json()
      if (data.content) {
        const lines = data.content.split('\n').filter(Boolean)
        updateStep(stepId, {
          ...step,
          subject: step.subject || lines[0]?.slice(0, 80) || 'Follow-up',
          content: data.content,
        })
      }
    } finally {
      setGenerating(null)
    }
  }

  const save = () => {
    if (!name.trim()) return
    setSaving(true)
    const seq: DripSequence = {
      id: Date.now().toString(),
      name,
      trigger,
      segment,
      active: false,
      steps: steps.filter(s => s.subject.trim()),
      enrolledCount: 0,
      createdAt: new Date().toISOString(),
    }
    setTimeout(() => {
      onSave(seq)
      setSaving(false)
    }, 500)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h2 className="text-white font-semibold">New Drip Sequence</h2>
            <p className="text-slate-500 text-xs mt-0.5">Automated email series triggered by lead actions</p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white text-xl transition-colors">×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Sequence settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <label className="block text-xs text-slate-400 mb-1.5">Sequence Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. New Lead Welcome Sequence"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Trigger</label>
              <select
                value={trigger}
                onChange={e => setTrigger(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              >
                {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Segment</label>
              <select
                value={segment}
                onChange={e => setSegment(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              >
                {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <p className="text-slate-500 text-xs">{steps.filter(s => s.subject.trim()).length} of {steps.length} steps ready</p>
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs text-slate-400 font-medium">Email Steps</label>
              <button onClick={addStep} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">+ Add Step</button>
            </div>
            <div>
              {steps.map((step, i) => (
                <StepCard
                  key={step.id}
                  step={step}
                  index={i}
                  onUpdate={updated => updateStep(step.id, updated)}
                  onDelete={() => deleteStep(step.id)}
                  onGenerate={generateContent}
                  generating={generating}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={onCancel} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !name.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save Sequence'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DripPage() {
  const [sequences, setSequences] = useState<DripSequence[]>(SAMPLE_SEQUENCES)
  const [showBuilder, setShowBuilder] = useState(false)

  const toggleActive = (id: string) =>
    setSequences(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s))

  const deleteSeq = (id: string) => {
    if (!confirm('Delete this sequence?')) return
    setSequences(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <a href="/campaigns" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Campaigns</a>
            <span className="text-slate-700">/</span>
            <h1 className="text-sm font-medium text-white">Drip Sequences</h1>
          </div>
          <p className="text-slate-400 text-sm">Automated email series triggered by lead behavior</p>
        </div>
        <button
          onClick={() => setShowBuilder(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <span className="text-lg leading-none">+</span> New Sequence
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-500 text-xs mb-1">Total Sequences</p>
          <p className="text-white text-2xl font-bold">{sequences.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-500 text-xs mb-1">Active</p>
          <p className="text-blue-400 text-2xl font-bold">{sequences.filter(s => s.active).length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-500 text-xs mb-1">Total Enrolled</p>
          <p className="text-white text-2xl font-bold">{sequences.reduce((n, s) => n + s.enrolledCount, 0)}</p>
        </div>
      </div>

      <div className="bg-slate-950/20 border border-slate-700/30 rounded-xl p-4 mb-6 flex items-start gap-3">
        <span className="text-slate-500 text-lg flex-shrink-0">⚡</span>
        <div>
          <p className="text-slate-400 text-sm font-medium">Email sending requires Resend</p>
          <p className="text-slate-400 text-xs mt-0.5">Sequences can be designed now. Connect Resend to start enrolling leads automatically.</p>
        </div>
      </div>

      {sequences.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 text-center">
          <div className="text-5xl mb-4">🔄</div>
          <h2 className="text-white font-semibold mb-2">No sequences yet</h2>
          <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
            Build automated email sequences that nurture leads on autopilot — triggered by their actions.
          </p>
          <button onClick={() => setShowBuilder(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
            Build First Sequence
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {sequences.map(seq => (
            <div key={seq.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 group hover:border-slate-700 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-semibold text-sm">{seq.name}</h3>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${seq.active ? 'bg-slate-900/50 text-blue-300' : 'bg-slate-800 text-slate-400'}`}>
                      {seq.active ? '● Active' : '○ Paused'}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs">
                    Trigger: {TRIGGERS.find(t => t.value === seq.trigger)?.label} ·
                    Segment: {SEGMENTS.find(s => s.value === seq.segment)?.label} ·
                    {seq.steps.length} emails ·
                    {seq.enrolledCount} enrolled
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleActive(seq.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      seq.active
                        ? 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                        : 'border-slate-700/40 text-blue-400 hover:bg-slate-900/20'
                    }`}
                  >
                    {seq.active ? 'Pause' : 'Activate'}
                  </button>
                  <button
                    onClick={() => deleteSeq(seq.id)}
                    className="text-xs text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all px-2 py-1.5"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Step timeline */}
              <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
                {seq.steps.map((step, i) => (
                  <div key={step.id} className="flex items-center gap-2 flex-shrink-0">
                    {i > 0 && (
                      <div className="flex items-center gap-1 text-slate-600 text-[10px]">
                        <div className="w-6 h-px bg-slate-700" />
                        <span>{`+${step.day - seq.steps[i - 1].day}d`}</span>
                        <div className="w-6 h-px bg-slate-700" />
                      </div>
                    )}
                    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 min-w-0">
                      <p className="text-slate-300 text-[10px] font-medium">Email {i + 1}</p>
                      <p className="text-slate-500 text-[10px] truncate max-w-28">{step.subject || 'Untitled'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showBuilder && (
        <SequenceBuilder
          onSave={seq => { setSequences(prev => [seq, ...prev]); setShowBuilder(false) }}
          onCancel={() => setShowBuilder(false)}
        />
      )}
    </div>
  )
}
