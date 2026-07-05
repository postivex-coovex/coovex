'use client'

import { useState } from 'react'
import { DollarSign, Zap, Clock, CheckCircle2, Shield, ChevronDown, ChevronUp } from 'lucide-react'

interface AgentConfig {
  // Existing automation
  auto_respond_reviews: boolean
  auto_score_leads: boolean
  auto_schedule_posts: boolean
  auto_run_audits: boolean
  daily_brief: boolean
  signal_threshold: 'low' | 'medium' | 'high'
  response_tone: 'professional' | 'friendly' | 'casual'
  max_posts_per_week: number
  working_hours_only: boolean
  // Execution permissions
  auto_exec_spend_limit: number
  auto_publish_confidence: number
  auto_publish_reviews: boolean
  auto_publish_posts: boolean
  auto_publish_emails: boolean
  // Auto follow-up
  auto_followup_enabled: boolean
  auto_followup_days: number
  // Brand guardrails
  brand_voice: string
  blocked_words: string
  auto_max_words: number
  require_signature: boolean
  signature_text: string
  // Cross-module orchestration rule toggles
  orch_competitor_price_threat: boolean
  orch_lead_score_drop: boolean
  orch_goal_at_risk: boolean
}

const DEFAULT_CONFIG: AgentConfig = {
  auto_respond_reviews: false,
  auto_score_leads: true,
  auto_schedule_posts: false,
  auto_run_audits: true,
  daily_brief: true,
  signal_threshold: 'medium',
  response_tone: 'professional',
  max_posts_per_week: 5,
  working_hours_only: true,
  auto_exec_spend_limit: 0,
  auto_publish_confidence: 85,
  auto_publish_reviews: false,
  auto_publish_posts: false,
  auto_publish_emails: false,
  auto_followup_enabled: false,
  auto_followup_days: 3,
  // Brand guardrails
  brand_voice: '',
  blocked_words: '',
  auto_max_words: 150,
  require_signature: false,
  signature_text: '',
  // Orchestration
  orch_competitor_price_threat: true,
  orch_lead_score_drop: true,
  orch_goal_at_risk: true,
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-violet-600' : 'bg-slate-700'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="px-5 py-4 border-b border-slate-800">
      <h2 className="text-white font-semibold">{title}</h2>
      <p className="text-slate-500 text-xs mt-0.5">{subtitle}</p>
    </div>
  )
}

export default function AgentSettingsClient({ savedConfig }: { savedConfig: AgentConfig }) {
  const [config, setConfig] = useState<AgentConfig>({ ...DEFAULT_CONFIG, ...savedConfig })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function set<K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) {
    setConfig(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    await fetch('/api/settings/agent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const anyAutoPublish = config.auto_publish_reviews || config.auto_publish_posts || config.auto_publish_emails
  const spendEnabled = config.auto_exec_spend_limit > 0

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Settings</h1>
          <p className="text-slate-400 text-sm mt-0.5">Configure what your AI agent does automatically vs. asks you first</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            saved ? 'bg-emerald-600 text-white' :
            'bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white'
          }`}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      <div className="space-y-4">

        {/* ── EXECUTION PERMISSIONS ─────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <SectionHeader
            title="Execution Permissions"
            subtitle="Set spending limits and confidence thresholds — AI acts autonomously within these bounds, asks for approval outside them"
          />
          <div className="divide-y divide-slate-800/60 px-5">

            {/* Spending threshold */}
            <div className="py-5">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <p className="text-white text-sm font-medium">Marketing spend limit (without approval)</p>
              </div>
              <p className="text-slate-500 text-xs mb-4">
                AI can adjust ad bids, boost posts, or buy tools below this amount without asking you.
                Set to <strong className="text-slate-300">$0</strong> to require approval for all spend.
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0} max={2000} step={50}
                  value={config.auto_exec_spend_limit}
                  onChange={e => set('auto_exec_spend_limit', Number(e.target.value))}
                  className="flex-1 accent-emerald-500"
                />
                <div className={`min-w-[72px] text-center px-3 py-1.5 rounded-lg border text-sm font-bold ${
                  spendEnabled
                    ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}>
                  {spendEnabled ? `$${config.auto_exec_spend_limit}` : 'Off'}
                </div>
              </div>
              {spendEnabled && (
                <p className="text-emerald-400 text-xs mt-2">
                  ✓ AI can spend up to ${config.auto_exec_spend_limit} per action without approval
                </p>
              )}
            </div>

            {/* Confidence threshold */}
            <div className="py-5">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-amber-400" />
                <p className="text-white text-sm font-medium">Auto-execute confidence threshold</p>
              </div>
              <p className="text-slate-500 text-xs mb-4">
                When AI confidence is at or above this score, it executes the action directly.
                Below this score, the action appears in your approval queue.
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={50} max={100} step={5}
                  value={config.auto_publish_confidence}
                  onChange={e => set('auto_publish_confidence', Number(e.target.value))}
                  className="flex-1 accent-amber-500"
                />
                <div className="min-w-[56px] text-center px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-400 text-sm font-bold">
                  {config.auto_publish_confidence}%
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                {[
                  { label: 'Conservative', value: 95, desc: '95% — very selective' },
                  { label: 'Balanced', value: 85, desc: '85% — recommended' },
                  { label: 'Aggressive', value: 70, desc: '70% — acts more often' },
                ].map(p => (
                  <button
                    key={p.value}
                    onClick={() => set('auto_publish_confidence', p.value)}
                    title={p.desc}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      config.auto_publish_confidence === p.value
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Per-category auto-publish */}
            <div className="py-5">
              <p className="text-white text-sm font-medium mb-1">What can AI publish automatically?</p>
              <p className="text-slate-500 text-xs mb-4">
                AI only auto-publishes when its confidence score is ≥ {config.auto_publish_confidence}%.
                Everything else lands in your approval queue.
              </p>
              <div className="space-y-3">
                {[
                  {
                    key: 'auto_publish_reviews' as const,
                    label: 'Review responses',
                    desc: 'Post replies to Google, Trustpilot, and App Store reviews',
                    warn: true,
                  },
                  {
                    key: 'auto_publish_posts' as const,
                    label: 'Social media posts',
                    desc: 'Publish to LinkedIn, Facebook, and Instagram at scheduled times',
                    warn: true,
                  },
                  {
                    key: 'auto_publish_emails' as const,
                    label: 'Lead follow-up emails',
                    desc: 'Send follow-up emails to stale leads automatically',
                    warn: true,
                  },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm">{item.label}</p>
                        {config[item.key] && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-950/50 text-amber-400 border border-amber-900/50 rounded-full">Live</span>
                        )}
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5">{item.desc}</p>
                    </div>
                    <Toggle checked={config[item.key]} onChange={v => set(item.key, v)} />
                  </div>
                ))}
              </div>
              {anyAutoPublish && (
                <div className="mt-4 p-3 bg-amber-950/20 border border-amber-800/30 rounded-xl">
                  <p className="text-amber-400 text-xs font-medium">
                    Auto-publish is active — all executions are logged in your Agent Activity feed.
                    You can review and undo any action within 24 hours.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── AUTO FOLLOW-UP ────────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <SectionHeader
            title="Auto Follow-up"
            subtitle="AI detects stale leads and sends follow-up messages without you having to draft them"
          />
          <div className="divide-y divide-slate-800/60 px-5">

            <div className="flex items-start gap-4 py-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <p className="text-white text-sm font-medium">Enable auto follow-up</p>
                  {config.auto_followup_enabled && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-950/50 text-blue-400 border border-blue-900/50 rounded-full">Active</span>
                  )}
                </div>
                <p className="text-slate-500 text-xs mt-0.5">
                  When a lead is stuck in the same pipeline stage, AI sends a follow-up
                  {config.auto_followup_enabled ? ` after ${config.auto_followup_days} day${config.auto_followup_days !== 1 ? 's' : ''}` : ''}.
                </p>
              </div>
              <Toggle checked={config.auto_followup_enabled} onChange={v => set('auto_followup_enabled', v)} />
            </div>

            {config.auto_followup_enabled && (
              <div className="py-4">
                <p className="text-white text-sm font-medium mb-1">Follow-up delay</p>
                <p className="text-slate-500 text-xs mb-4">
                  How many days a lead must be stale before AI sends a follow-up
                </p>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={1} max={14} step={1}
                    value={config.auto_followup_days}
                    onChange={e => set('auto_followup_days', Number(e.target.value))}
                    className="flex-1 accent-blue-500"
                  />
                  <div className="min-w-[64px] text-center px-3 py-1.5 rounded-lg bg-blue-950/40 border border-blue-800/50 text-blue-400 text-sm font-bold">
                    {config.auto_followup_days}d
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {[
                    { label: '1 day', value: 1 },
                    { label: '3 days', value: 3 },
                    { label: '7 days', value: 7 },
                    { label: '14 days', value: 14 },
                  ].map(p => (
                    <button
                      key={p.value}
                      onClick={() => set('auto_followup_days', p.value)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        config.auto_followup_days === p.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="text-slate-500 text-xs mt-3">
                  Follow-ups are generated by AI using your saved tone and sent via your connected email account.
                  {!config.auto_publish_emails && (
                    <span className="text-amber-400 ml-1">Enable "Lead follow-up emails" auto-publish above to send without approval.</span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── AUTOMATION ───────────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <SectionHeader
            title="Automation"
            subtitle="Background tasks the agent runs on a schedule"
          />
          <div className="divide-y divide-slate-800/60">
            {[
              {
                key: 'auto_respond_reviews' as const,
                label: 'Draft review responses',
                desc: 'Agent drafts responses for all new reviews and queues them for approval',
              },
              {
                key: 'auto_score_leads' as const,
                label: 'Auto-score new leads',
                desc: 'Calculate lead score automatically when new leads are added',
              },
              {
                key: 'auto_schedule_posts' as const,
                label: 'Auto-schedule drafted posts',
                desc: 'Agent schedules approved drafts at optimal engagement times',
              },
              {
                key: 'auto_run_audits' as const,
                label: 'Weekly website audit',
                desc: 'Run a full website health audit every Monday',
              },
              {
                key: 'daily_brief' as const,
                label: 'Daily morning brief',
                desc: 'Email summary of overnight activity every morning',
              },
            ].map(item => (
              <div key={item.key} className="flex items-start gap-4 px-5 py-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium">{item.label}</p>
                    {config[item.key] && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">{item.desc}</p>
                </div>
                <Toggle checked={config[item.key]} onChange={v => set(item.key, v)} />
              </div>
            ))}
          </div>
        </div>

        {/* ── BEHAVIOR ─────────────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <SectionHeader title="Behavior" subtitle="How the agent communicates and prioritizes" />
          <div className="divide-y divide-slate-800/60 px-5">

            <div className="py-4">
              <p className="text-white text-sm font-medium mb-1">Signal sensitivity</p>
              <p className="text-slate-500 text-xs mb-3">How urgent something needs to be before the agent alerts you</p>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map(level => (
                  <button
                    key={level}
                    onClick={() => set('signal_threshold', level)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                      config.signal_threshold === level
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {level === 'low' ? '🔔 All signals' : level === 'medium' ? '🔕 Medium+' : '🚨 High only'}
                  </button>
                ))}
              </div>
            </div>

            <div className="py-4">
              <p className="text-white text-sm font-medium mb-1">Default AI response tone</p>
              <p className="text-slate-500 text-xs mb-3">Tone used when generating review responses and messages</p>
              <div className="flex gap-2">
                {(['professional', 'friendly', 'casual'] as const).map(tone => (
                  <button
                    key={tone}
                    onClick={() => set('response_tone', tone)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                      config.response_tone === tone
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {tone === 'professional' ? '👔 Professional' : tone === 'friendly' ? '😊 Friendly' : '💬 Casual'}
                  </button>
                ))}
              </div>
            </div>

            <div className="py-4">
              <p className="text-white text-sm font-medium mb-1">Max posts per week</p>
              <p className="text-slate-500 text-xs mb-3">Cap on how many posts the agent can auto-schedule per week</p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1} max={21} step={1}
                  value={config.max_posts_per_week}
                  onChange={e => set('max_posts_per_week', Number(e.target.value))}
                  className="flex-1 accent-violet-500"
                />
                <span className="text-white font-bold text-lg w-8 text-center">{config.max_posts_per_week}</span>
              </div>
            </div>

            <div className="flex items-start gap-4 py-4">
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Working hours only</p>
                <p className="text-slate-500 text-xs mt-0.5">Limit agent actions to Mon–Fri 9am–6pm (your timezone)</p>
              </div>
              <Toggle checked={config.working_hours_only} onChange={v => set('working_hours_only', v)} />
            </div>
          </div>
        </div>

        {/* ── CROSS-MODULE AUTOMATION ──────────────────────────────────── */}
        <CrossModuleAutomation config={config} set={set} />

        {/* ── BRAND GUARDRAILS ─────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <SectionHeader
            title="Brand Guardrails"
            subtitle="Rules AI checks before auto-publishing any content — prevents off-brand or damaging output"
          />
          <div className="divide-y divide-slate-800/60 px-5">

            {/* Brand voice */}
            <div className="py-5">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-violet-400" />
                <p className="text-white text-sm font-medium">Brand voice description</p>
              </div>
              <p className="text-slate-500 text-xs mb-3">
                Describe your brand personality in plain language. AI checks every auto-published message against this before publishing.
              </p>
              <textarea
                rows={3}
                value={config.brand_voice}
                onChange={e => set('brand_voice', e.target.value)}
                placeholder="e.g. Professional but approachable. We never use jargon. We are direct, empathetic, and avoid hyperbole. We always acknowledge the customer's concern first."
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-violet-500 placeholder-slate-600"
              />
              {config.brand_voice && (
                <p className="text-emerald-400 text-xs mt-1.5">
                  ✓ AI will match this voice before publishing
                </p>
              )}
            </div>

            {/* Blocked words */}
            <div className="py-5">
              <p className="text-white text-sm font-medium mb-1">Blocked words & phrases</p>
              <p className="text-slate-500 text-xs mb-3">
                Comma-separated. AI will refuse to auto-publish content containing any of these. Use for competitor names, legal terms, or off-brand language.
              </p>
              <input
                type="text"
                value={config.blocked_words}
                onChange={e => set('blocked_words', e.target.value)}
                placeholder="e.g. amazing, incredible, guaranteed, [CompetitorName]"
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-violet-500 placeholder-slate-600"
              />
              {config.blocked_words && (
                <p className="text-slate-500 text-xs mt-1.5">
                  {config.blocked_words.split(',').filter(w => w.trim()).length} blocked term{config.blocked_words.split(',').filter(w => w.trim()).length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Max words */}
            <div className="py-5">
              <p className="text-white text-sm font-medium mb-1">Max words per auto-published message</p>
              <p className="text-slate-500 text-xs mb-3">
                AI will not auto-publish content longer than this. Longer drafts go to approval queue instead.
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={50} max={500} step={10}
                  value={config.auto_max_words}
                  onChange={e => set('auto_max_words', Number(e.target.value))}
                  className="flex-1 accent-violet-500"
                />
                <div className="min-w-[64px] text-center px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm font-bold">
                  {config.auto_max_words}w
                </div>
              </div>
            </div>

            {/* Email signature */}
            <div className="py-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">Append signature to follow-up emails</p>
                  <p className="text-slate-500 text-xs mt-0.5">Add a fixed sign-off below every auto-sent email</p>
                </div>
                <Toggle checked={config.require_signature} onChange={v => set('require_signature', v)} />
              </div>
              {config.require_signature && (
                <textarea
                  rows={2}
                  value={config.signature_text}
                  onChange={e => set('signature_text', e.target.value)}
                  placeholder="e.g. Best regards,&#10;[Your Name] | [Company] | [Phone]"
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-violet-500 placeholder-slate-600"
                />
              )}
            </div>
          </div>
        </div>

        {/* ── CONFIDENCE SCORE MODEL ───────────────────────────────────── */}
        <ConfidenceModelCard />
      </div>
    </div>
  )
}

// ── Cross-Module Automation ────────────────────────────────────────────────

type SetFn = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => void

interface OrchRule {
  key: 'orch_competitor_price_threat' | 'orch_lead_score_drop' | 'orch_goal_at_risk'
  name: string
  trigger: string
  chain: string[]
  modules: string[]
}

const ORCH_RULES: OrchRule[] = [
  {
    key:     'orch_competitor_price_threat',
    name:    'Competitor Price Threat → Counter-pitch + Content',
    trigger: 'A competitor intelligence threat about pricing is detected',
    chain: [
      'AI Coach drafts a counter-pitch prompt and talking points',
      'Content Calendar gets a competitive positioning post suggestion',
    ],
    modules: ['Competitor Intelligence', 'AI Coach', 'Content Calendar'],
  },
  {
    key:     'orch_lead_score_drop',
    name:    'Lead Score Sharp Drop → Auto Re-segment',
    trigger: 'A lead\'s score drops below 40 (warm threshold)',
    chain: [
      'Lead stage automatically moved to nurture',
      'Priority flag cleared from pipeline',
      'Lead enrolled in cold drip sequence (if one exists)',
    ],
    modules: ['Lead Management', 'Email Campaigns'],
  },
  {
    key:     'orch_goal_at_risk',
    name:    'Goal At-Risk → Best-Channel Reallocation',
    trigger: 'A business goal status changes to At Risk',
    chain: [
      'Attribution data pulled to find top lead source (last 30 days)',
      'Agent Inbox gets an attribution check signal',
      'Content Calendar gets a "shift extra posts to top channel" suggestion',
    ],
    modules: ['Goals', 'Analytics & Attribution', 'Content Calendar'],
  },
]

function CrossModuleAutomation({ config, set }: { config: AgentConfig; set: SetFn }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [running, setRunning]   = useState(false)
  const [runResult, setRunResult] = useState<{ total_chains: number; total_signals: number } | null>(null)

  async function runNow() {
    setRunning(true)
    setRunResult(null)
    try {
      const res = await fetch('/api/orchestration/process', { method: 'POST' })
      const data = await res.json() as { total_chains: number; total_signals: number }
      setRunResult(data)
    } finally {
      setRunning(false)
    }
  }

  const enabledCount = ORCH_RULES.filter(r => config[r.key]).length

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-400" />
            <h2 className="text-white font-semibold">Cross-Module Automation</h2>
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${
              enabledCount > 0
                ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50'
                : 'text-slate-500 bg-slate-800 border-slate-700'
            }`}>
              {enabledCount}/{ORCH_RULES.length} active
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Chain reactions that span multiple modules from a single trigger
          </p>
        </div>
        <button
          onClick={runNow}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-700/50 text-violet-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {running
            ? <><span className="w-3 h-3 border border-violet-400/40 border-t-violet-400 rounded-full animate-spin" />Running…</>
            : <><Zap className="w-3 h-3" />Run now</>
          }
        </button>
      </div>

      {runResult && (
        <div className="px-5 py-3 bg-emerald-950/20 border-b border-emerald-800/30 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <p className="text-emerald-400 text-xs">
            {runResult.total_chains === 0
              ? 'No new triggers found — all clear.'
              : `Fired ${runResult.total_chains} chain${runResult.total_chains !== 1 ? 's' : ''}, created ${runResult.total_signals} signal${runResult.total_signals !== 1 ? 's' : ''} in Agent Inbox.`
            }
          </p>
        </div>
      )}

      <div className="divide-y divide-slate-800/60">
        {ORCH_RULES.map(rule => {
          const isOn  = config[rule.key]
          const isExp = expanded === rule.key
          return (
            <div key={rule.key} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-white text-sm font-medium">{rule.name}</p>
                    {isOn && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-violet-950/50 text-violet-400 border border-violet-900/50 rounded-full">Active</span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs">
                    <span className="text-slate-400">Trigger:</span> {rule.trigger}
                  </p>

                  {isExp && (
                    <div className="mt-3 space-y-3">
                      <div className="bg-slate-800/50 rounded-xl p-3">
                        <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold mb-2">Action chain</p>
                        {rule.chain.map((step, i) => (
                          <div key={i} className="flex items-start gap-2 mb-1.5">
                            <span className="text-violet-400 text-[10px] font-bold w-4 flex-shrink-0">{i + 1}.</span>
                            <p className="text-slate-300 text-xs leading-relaxed">{step}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-slate-600 text-[10px]">Modules involved:</p>
                        {rule.modules.map(m => (
                          <span key={m} className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-full">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setExpanded(isExp ? null : rule.key)}
                    className="text-slate-600 hover:text-slate-400 text-[11px] mt-2 transition-colors"
                  >
                    {isExp ? '↑ Less' : '↓ See chain'}
                  </button>
                </div>
                <Toggle checked={isOn} onChange={v => set(rule.key, v)} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-5 py-3 border-t border-slate-800 bg-slate-800/30">
        <p className="text-slate-600 text-[11px]">
          Engine checks for triggers automatically on dashboard load. Use "Run now" for an immediate sweep.
          All executions are logged in <a href="/agent/report" className="text-violet-400 hover:underline">Agent Report → Execution History</a>.
        </p>
      </div>
    </div>
  )
}

// ── Confidence score explainer card ────────────────────────────────────────

function ConfidenceModelCard() {
  const [open, setOpen] = useState(false)

  const MODELS = [
    {
      label: 'Review Response',
      color: 'text-blue-400',
      factors: [
        { name: 'Tone matches brand voice description', weight: 40 },
        { name: 'Response length proportional to review', weight: 20 },
        { name: 'Sentiment acknowledged correctly', weight: 20 },
        { name: 'No blocked words present', weight: 20 },
      ],
    },
    {
      label: 'Social Post',
      color: 'text-violet-400',
      factors: [
        { name: 'Topic relevance to your industry', weight: 40 },
        { name: 'Brand voice match score', weight: 30 },
        { name: 'Estimated engagement vs your avg', weight: 30 },
      ],
    },
    {
      label: 'Lead Follow-up Email',
      color: 'text-emerald-400',
      factors: [
        { name: 'Lead score (from CRM)', weight: 40 },
        { name: 'Days since last contact vs threshold', weight: 30 },
        { name: 'Message personalization quality', weight: 30 },
      ],
    },
  ]

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/30 transition-colors text-left"
      >
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h2 className="text-white font-semibold">How Confidence Scores Are Calculated</h2>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">Understand what drives auto-execute decisions</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-slate-800">
          <p className="text-slate-400 text-sm leading-relaxed pt-4">
            Each action gets a score from 0–100 before execution. Scores are built from weighted rule checks —
            not just an LLM self-report (which is unreliable). Over time, scores will be calibrated against historical
            accuracy: if 90%+ confidence actions turn out wrong more than 10% of the time, the model self-adjusts.
          </p>

          <div className="space-y-4">
            {MODELS.map(model => (
              <div key={model.label} className="bg-slate-800/50 rounded-xl p-4">
                <p className={`text-sm font-semibold mb-3 ${model.color}`}>{model.label}</p>
                <div className="space-y-2">
                  {model.factors.map(f => (
                    <div key={f.name} className="flex items-center gap-3">
                      <div className="flex-1 bg-slate-700/50 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-violet-600 to-blue-500"
                          style={{ width: `${f.weight}%` }}
                        />
                      </div>
                      <span className="text-slate-400 text-xs w-6 text-right flex-shrink-0">{f.weight}</span>
                      <span className="text-slate-300 text-xs flex-1">{f.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-amber-950/20 border border-amber-800/30 rounded-xl">
            <p className="text-amber-400 text-xs font-medium mb-1">Why not just ask Claude "how confident are you?"</p>
            <p className="text-slate-500 text-xs">
              LLMs consistently over-report confidence — they say 90% even when wrong. Rule-based scoring tied to
              your specific guardrails (brand voice, blocked words, length) gives you a score you can trust and verify.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
