'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'

interface IntegrationSettings {
  enabled?: boolean
  [key: string]: unknown
}

interface OtherIntegrationsProps {
  integrations: Record<string, IntegrationSettings>
}

type FieldDef = { key: string; label: string; placeholder: string; type?: string; hint?: string }

const TOOLS: {
  key: string
  icon: string
  name: string
  desc: string
  color: string
  fields: FieldDef[]
  docs?: string
  syncRevenue?: boolean  // can sync deals → revenue page
  oauthOnly?: boolean    // requires OAuth (no simple API key)
  badge?: string
}[] = [
  {
    key: 'hubspot',
    icon: '🔗',
    name: 'HubSpot CRM',
    desc: 'Sync contacts & deals from HubSpot into CooVex. Revenue page updates automatically after each sync.',
    color: 'text-orange-400',
    syncRevenue: true,
    fields: [
      { key: 'api_key', label: 'Private App Token', placeholder: 'pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', hint: 'HubSpot → Settings → Integrations → Private Apps → Create app' },
    ],
    docs: 'https://developers.hubspot.com/docs/api/private-apps',
  },
  {
    key: 'pipedrive',
    icon: '🎯',
    name: 'Pipedrive',
    desc: 'Sync all deals and pipeline stages from Pipedrive. Won deals appear in your Revenue page.',
    color: 'text-green-400',
    syncRevenue: true,
    fields: [
      { key: 'api_key', label: 'API Token', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'Pipedrive → Your name (top right) → Personal preferences → API → API Token' },
    ],
    docs: 'https://developers.pipedrive.com/docs/api/v1',
  },
  {
    key: 'quickbooks',
    icon: '💰',
    name: 'QuickBooks Online',
    desc: 'Sync invoices and revenue data from QuickBooks to power your Revenue & Forecast pages.',
    color: 'text-green-500',
    oauthOnly: true,
    fields: [],
    docs: 'https://developer.intuit.com/app/developer/qbo/docs/get-started',
  },
  {
    key: 'xero',
    icon: '💹',
    name: 'Xero',
    desc: 'Pull invoices, contacts, and cash flow data from Xero for AI-powered financial insights.',
    color: 'text-sky-400',
    oauthOnly: true,
    fields: [],
    docs: 'https://developer.xero.com/documentation/getting-started-guide',
  },
  {
    key: 'ga4',
    icon: '📊',
    name: 'Google Analytics 4',
    desc: 'Track page views and conversion events. Script is injected into every page automatically.',
    color: 'text-yellow-400',
    fields: [
      { key: 'measurement_id', label: 'Measurement ID', placeholder: 'G-XXXXXXXXXX', hint: 'GA4 → Admin → Data Streams → your stream → Measurement ID' },
    ],
    docs: 'https://support.google.com/analytics/answer/9539598',
  },
  {
    key: 'mailchimp',
    icon: '📣',
    name: 'Mailchimp',
    desc: 'Automatically subscribe new leads to your Mailchimp audience when they are added',
    color: 'text-yellow-300',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us1', hint: 'Mailchimp → Account → Extras → API Keys' },
      { key: 'list_id', label: 'Audience ID', placeholder: 'abc1234def', hint: 'Mailchimp → Audience → Settings → Audience name and defaults → Audience ID' },
    ],
    docs: 'https://mailchimp.com/developer/marketing/guides/quick-start/',
  },
  {
    key: 'zapier',
    icon: '⚡',
    name: 'Zapier',
    desc: 'CooVex sends events (new lead, post published, signal detected) to your Zapier webhook',
    color: 'text-orange-300',
    fields: [
      { key: 'webhook_url', label: 'Zapier Webhook URL', placeholder: 'https://hooks.zapier.com/hooks/catch/xxx/yyy/', hint: 'Zapier → Create Zap → Trigger: Webhooks by Zapier → Catch Hook → copy URL' },
    ],
    docs: 'https://zapier.com/apps/webhook/integrations',
  },
  {
    key: 'google_ads',
    icon: '🎯',
    name: 'Google Ads',
    desc: 'Add conversion tracking tag. Fires when a lead is added or a post is published.',
    color: 'text-blue-400',
    fields: [
      { key: 'tag_id', label: 'Conversion Tag ID', placeholder: 'AW-XXXXXXXXX', hint: 'Google Ads → Tools → Measurement → Conversions → Tag setup → Google tag ID' },
      { key: 'conversion_label', label: 'Conversion Label (optional)', placeholder: 'abcDEF123xyz', hint: 'Found in the conversion action setup alongside the tag ID' },
    ],
    docs: 'https://support.google.com/google-ads/answer/6095821',
  },
]

function IntegrationCard({ tool, saved }: { tool: typeof TOOLS[0]; saved: IntegrationSettings | undefined }) {
  const isEnabled = saved?.enabled === true
  const [open, setOpen]       = useState(false)
  const [fields, setFields]   = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    tool.fields.forEach(f => { init[f.key] = (saved?.[f.key] as string) ?? '' })
    return init
  })
  const [saving, setSaving]   = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null)

  const save = async (enable: boolean) => {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: tool.key, settings: { ...fields, enabled: enable } }),
      })
      if (res.ok) { setMsg({ ok: true, text: enable ? 'Saved and enabled' : 'Disabled' }); if (enable) setOpen(false) }
      else setMsg({ ok: false, text: 'Save failed' })
    } finally { setSaving(false) }
  }

  const test = async () => {
    setTesting(true); setMsg(null)
    try {
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: tool.key, settings: fields }),
      })
      const d = await res.json() as { ok: boolean; msg: string }
      setMsg({ ok: d.ok, text: d.msg })
    } finally { setTesting(false) }
  }

  const syncRevenue = async () => {
    setSyncing(true); setMsg(null)
    try {
      const res = await fetch('/api/integrations/crm/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crm_type: tool.key }),
      })
      const d = await res.json() as { ok?: boolean; synced?: number; error?: string }
      if (d.ok) setMsg({ ok: true, text: `Synced ${d.synced} deals → check your Revenue page` })
      else setMsg({ ok: false, text: d.error ?? 'Sync failed' })
    } finally { setSyncing(false) }
  }

  const hasValues = tool.fields.length === 0 || tool.fields.every(f => fields[f.key]?.trim())

  return (
    <div className={`bg-slate-900 border rounded-2xl overflow-hidden transition-colors ${
      isEnabled ? 'border-emerald-800/40' : 'border-slate-800'
    }`}>
      {/* Header */}
      <div
        className={`flex items-center gap-4 p-5 hover:bg-slate-800/20 transition-colors ${tool.oauthOnly ? '' : 'cursor-pointer'}`}
        onClick={() => !tool.oauthOnly && setOpen(o => !o)}
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
          isEnabled ? 'bg-emerald-950/40 border border-emerald-800/40' : 'bg-slate-800'
        }`}>
          {tool.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-medium">{tool.name}</h3>
            {tool.badge && (
              <span className="text-[10px] px-1.5 py-0.5 bg-teal-950/50 text-teal-400 border border-teal-800/40 rounded-full">{tool.badge}</span>
            )}
            {tool.syncRevenue && (
              <span className="text-[10px] px-1.5 py-0.5 bg-violet-950/50 text-violet-400 border border-violet-800/40 rounded-full">Syncs Revenue</span>
            )}
            {tool.oauthOnly && (
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-950/50 text-amber-400 border border-amber-800/40 rounded-full">OAuth — Coming Soon</span>
            )}
            {isEnabled && !tool.oauthOnly && (
              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-950/50 text-emerald-400 border border-emerald-800/40 rounded-full">Active</span>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-0.5 line-clamp-1">{tool.desc}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {tool.syncRevenue && isEnabled && (
            <button
              onClick={e => { e.stopPropagation(); syncRevenue() }}
              disabled={syncing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-900/40 hover:bg-violet-900/60 disabled:opacity-50 text-violet-300 border border-violet-800/40 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
          )}
          {isEnabled && (
            <button
              onClick={e => { e.stopPropagation(); save(false) }}
              disabled={saving}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-red-950/30 text-slate-500 hover:text-red-400 border border-slate-700 hover:border-red-800/40 rounded-lg transition-colors"
            >
              Disable
            </button>
          )}
          {!tool.oauthOnly && (
            <span className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
          )}
        </div>
      </div>

      {/* OAuth-only placeholder */}
      {tool.oauthOnly && (
        <div className="px-5 pb-5 border-t border-slate-800/60 pt-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="text-slate-500 text-sm">{tool.desc}</p>
            <Link
              href={`/chat?q=${encodeURIComponent(`Tell me about connecting ${tool.name} to CooVex — what are the benefits and what will I need?`)}`}
              className="flex-shrink-0 flex items-center gap-1.5 bg-violet-700/70 hover:bg-violet-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              🤖 Ask AI
            </Link>
          </div>
          <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-3">
            <p className="text-amber-400 text-xs font-medium">OAuth Connection Required</p>
            <p className="text-amber-400/70 text-xs mt-1">
              {tool.name} uses OAuth 2.0 authorization. This integration requires an OAuth flow that we are setting up. It will be available soon.
            </p>
          </div>
          {tool.docs && (
            <a href={tool.docs} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-600 hover:text-slate-400 mt-3 inline-block transition-colors">
              View documentation →
            </a>
          )}
        </div>
      )}

      {/* Expandable form */}
      {!tool.oauthOnly && open && (
        <div className="px-5 pb-5 border-t border-slate-800/60 pt-4 space-y-4">
          {/* Ask AI + benefit */}
          <div className="flex items-start justify-between gap-3 bg-violet-950/15 border border-violet-800/25 rounded-xl p-3">
            <p className="text-violet-300/80 text-xs leading-relaxed">{tool.desc}</p>
            <Link
              href={`/chat?q=${encodeURIComponent(`Help me connect ${tool.name} to CooVex. Walk me through the setup steps.`)}`}
              className="flex-shrink-0 flex items-center gap-1.5 bg-violet-700/70 hover:bg-violet-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
              onClick={e => e.stopPropagation()}
            >
              🤖 Ask AI
            </Link>
          </div>

          {tool.syncRevenue && (
            <div className="bg-violet-950/20 border border-violet-800/30 rounded-xl p-3">
              <p className="text-violet-400 text-xs font-medium">Revenue Sync Enabled</p>
              <p className="text-violet-400/70 text-xs mt-0.5">
                After saving, use &ldquo;Sync Now&rdquo; to pull all deals into CooVex. Your Revenue and Forecast pages will update with real data.
              </p>
            </div>
          )}

          {tool.fields.map(f => (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-400">{f.label}</label>
                {f.hint && <span className="text-[10px] text-slate-600 ml-2 text-right max-w-[60%]">{f.hint}</span>}
              </div>
              <input
                type={f.type ?? 'text'}
                value={fields[f.key]}
                onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors font-mono"
              />
            </div>
          ))}

          {msg && (
            <p className={`text-sm px-3 py-2 rounded-lg ${msg.ok ? 'bg-emerald-950/30 text-emerald-400' : 'bg-red-950/30 text-red-400'}`}>
              {msg.ok ? '✓' : '✗'} {msg.text}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            {tool.fields.length > 0 && (
              <button
                onClick={test}
                disabled={testing || !hasValues}
                className="text-sm px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 border border-slate-700 rounded-lg transition-colors"
              >
                {testing ? 'Testing…' : 'Test connection'}
              </button>
            )}
            <button
              onClick={() => save(true)}
              disabled={saving || !hasValues}
              className="text-sm px-4 py-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white rounded-lg transition-colors font-medium"
            >
              {saving ? 'Saving…' : 'Save & Enable'}
            </button>
            {tool.docs && (
              <a href={tool.docs} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-slate-600 hover:text-slate-400 transition-colors">
                Docs →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function OtherIntegrations({ integrations }: OtherIntegrationsProps) {
  return (
    <div className="space-y-3">
      {TOOLS.map(tool => (
        <IntegrationCard key={tool.key} tool={tool} saved={integrations[tool.key]} />
      ))}
    </div>
  )
}
