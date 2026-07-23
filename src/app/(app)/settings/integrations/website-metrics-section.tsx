'use client'

import { useState, useEffect } from 'react'

interface WebsiteMetrics {
  paying_customers?: number
  mrr?: number
  arr?: number
  dau?: number
  mau?: number
  trial_users?: number
  churn_rate?: number
  arpu?: number
  conversion_rate?: number
  total_signups?: number
  nps_score?: number
  updated_at?: string
  source?: string
}

const FIELD_META: { key: keyof WebsiteMetrics; label: string; placeholder: string; prefix?: string; suffix?: string; hint: string }[] = [
  { key: 'paying_customers', label: 'Paying Customers',  placeholder: '150',    hint: 'Total active paid subscribers/customers right now' },
  { key: 'mrr',             label: 'MRR ($)',            placeholder: '12500',  prefix: '$', hint: 'Monthly Recurring Revenue in USD' },
  { key: 'arr',             label: 'ARR ($)',            placeholder: '150000', prefix: '$', hint: 'Annual Recurring Revenue (optional)' },
  { key: 'dau',             label: 'Daily Active Users', placeholder: '320',    hint: 'Average DAU over last 7 days' },
  { key: 'mau',             label: 'Monthly Active Users', placeholder: '1200', hint: 'Unique users in last 30 days' },
  { key: 'trial_users',     label: 'Trial Users',        placeholder: '45',     hint: 'Active free trial or freemium users' },
  { key: 'total_signups',   label: 'Total Signups',      placeholder: '3200',   hint: 'All-time registered users' },
  { key: 'arpu',            label: 'ARPU ($)',           placeholder: '83',     prefix: '$', hint: 'Average Revenue Per User per month' },
  { key: 'churn_rate',      label: 'Monthly Churn Rate', placeholder: '2',     suffix: '%', hint: 'Monthly churn % (e.g. 2 = 2%)' },
  { key: 'conversion_rate', label: 'Conversion Rate',    placeholder: '3.5',   suffix: '%', hint: 'Trial→Paid or Visitor→Signup conversion %' },
  { key: 'nps_score',       label: 'NPS Score',          placeholder: '42',     hint: 'Net Promoter Score (-100 to 100)' },
]

const CODE_EXAMPLES = {
  curl: (token: string, appUrl: string) => `curl -X POST ${appUrl}/api/integrations/website-metrics \\
  -H "Content-Type: application/json" \\
  -H "x-coovex-token: ${token}" \\
  -d '{
    "paying_customers": 150,
    "mrr": 12500,
    "dau": 320,
    "mau": 1200,
    "churn_rate": 0.02,
    "arpu": 83,
    "conversion_rate": 0.035,
    "source": "stripe"
  }'`,

  js: (token: string, appUrl: string) => `// Call this from your backend/cron job (daily recommended)
await fetch('${appUrl}/api/integrations/website-metrics', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-coovex-token': '${token}',
  },
  body: JSON.stringify({
    paying_customers: await db.count('subscriptions', { status: 'active' }),
    mrr: await stripe.getMRR(),
    dau: await analytics.getDAU(),
    mau: await analytics.getMAU(),
    churn_rate: 0.02,
    source: 'my-backend',
  }),
})`,

  python: (token: string, appUrl: string) => `import requests

# Call from your cron job or admin panel
response = requests.post(
    '${appUrl}/api/integrations/website-metrics',
    headers={
        'Content-Type': 'application/json',
        'x-coovex-token': '${token}',
    },
    json={
        'paying_customers': 150,
        'mrr': 12500,
        'dau': 320,
        'mau': 1200,
        'churn_rate': 0.02,
        'arpu': 83.33,
        'source': 'python-cron',
    }
)
print(response.json())  # { "ok": true, "received": {...} }`,

  stripe: (token: string, appUrl: string) => `// Stripe webhook → CooVex sync
// Add to your Stripe webhook handler

async function syncToCooVex(event) {
  if (!['customer.subscription.updated', 'invoice.paid'].includes(event.type)) return

  const [customers, revenue] = await Promise.all([
    stripe.subscriptions.list({ status: 'active', limit: 1 }),
    stripe.charges.list({ limit: 100 }),
  ])

  await fetch('${appUrl}/api/integrations/website-metrics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-coovex-token': '${token}',
    },
    body: JSON.stringify({
      paying_customers: customers.data.length,
      mrr: revenue.data.reduce((s, c) => s + c.amount, 0) / 100 / 12,
      source: 'stripe-webhook',
    }),
  })
}`,
}

type Tab = 'manual' | 'curl' | 'js' | 'python' | 'stripe'

export default function WebsiteMetricsSection() {
  const [metrics, setMetrics]   = useState<WebsiteMetrics | null>(null)
  const [token, setToken]       = useState('')
  const [appUrl, setAppUrl]     = useState('')
  const [tab, setTab]           = useState<Tab>('manual')
  const [form, setForm]         = useState<Partial<WebsiteMetrics>>({})
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [copied, setCopied]     = useState('')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setAppUrl(window.location.origin)
    fetch('/api/integrations/website-metrics')
      .then(r => r.json())
      .then((d: { metrics?: WebsiteMetrics; embed_token?: string }) => {
        setMetrics(d.metrics ?? null)
        setToken(d.embed_token ?? '')
        if (d.metrics) {
          // Pre-fill form with existing values
          const pre: Partial<WebsiteMetrics> = {}
          for (const f of FIELD_META) {
            const v = d.metrics[f.key]
            if (v !== undefined) {
              if (f.suffix === '%') (pre as Record<string, number>)[f.key] = Number(v) * 100
              else (pre as Record<string, number | string>)[f.key] = v
            }
          }
          setForm(pre)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    // Convert % fields back to decimals
    const payload: Partial<WebsiteMetrics> = { ...form }
    if (payload.churn_rate !== undefined) payload.churn_rate = Number(payload.churn_rate) / 100
    if (payload.conversion_rate !== undefined) payload.conversion_rate = Number(payload.conversion_rate) / 100

    const r = await fetch('/api/integrations/website-metrics', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const d = await r.json() as { metrics?: WebsiteMetrics }
    if (d.metrics) setMetrics(d.metrics)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  const TAB_LABELS: { id: Tab; label: string }[] = [
    { id: 'manual', label: 'Manual Entry' },
    { id: 'curl',   label: 'cURL' },
    { id: 'js',     label: 'JavaScript' },
    { id: 'python', label: 'Python' },
    { id: 'stripe', label: 'Stripe Webhook' },
  ]

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span className="text-lg">🔌</span> Website / Product Metrics
            </h3>
            <p className="text-slate-400 text-sm mt-0.5">
              Push your real business metrics so AI uses accurate data for goals, forecasts and insights.
            </p>
          </div>
          {metrics?.updated_at && (
            <span className="text-slate-600 text-xs shrink-0">
              Last synced: {new Date(metrics.updated_at).toLocaleDateString()} · {metrics.source}
            </span>
          )}
        </div>

        {/* Current metrics summary */}
        {metrics && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-4">
            {[
              { label: 'Paying', value: metrics.paying_customers?.toLocaleString() },
              { label: 'MRR',    value: metrics.mrr ? `$${metrics.mrr.toLocaleString()}` : null },
              { label: 'DAU',    value: metrics.dau?.toLocaleString() },
              { label: 'MAU',    value: metrics.mau?.toLocaleString() },
              { label: 'Churn',  value: metrics.churn_rate !== undefined ? `${(metrics.churn_rate * 100).toFixed(1)}%` : null },
            ].filter(x => x.value).map(s => (
              <div key={s.label} className="bg-slate-800/50 rounded-lg px-3 py-2">
                <p className="text-slate-500 text-[10px]">{s.label}</p>
                <p className="text-white text-sm font-semibold">{s.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Token */}
      {!loading && token && (
        <div className="px-5 pt-4 pb-0">
          <p className="text-slate-500 text-xs mb-1.5 font-medium uppercase tracking-wider">Your API Token</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-blue-300 text-xs font-mono truncate">
              {token}
            </code>
            <button onClick={() => copy(token, 'token')}
              className="text-xs px-3 py-2 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors shrink-0">
              {copied === 'token' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-5 pt-4">
        <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1 w-fit">
          {TAB_LABELS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors font-medium ${tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {tab === 'manual' ? (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">Enter your current metrics manually. AI will use these immediately for goals and suggestions.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {FIELD_META.map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                  <div className="relative">
                    {f.prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{f.prefix}</span>}
                    <input
                      type="number"
                      value={(form as Record<string, number | undefined>)[f.key] ?? ''}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) }))}
                      placeholder={f.placeholder}
                      className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-2 text-white text-sm focus:outline-none focus:border-blue-500 ${f.prefix ? 'pl-6 pr-3' : f.suffix ? 'pl-3 pr-6' : 'px-3'}`}
                    />
                    {f.suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{f.suffix}</span>}
                  </div>
                  <p className="text-slate-700 text-[10px] mt-0.5">{f.hint}</p>
                </div>
              ))}
            </div>
            <button onClick={save} disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : saved ? '✓ Saved — AI updated' : 'Save & Sync to AI'}
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-400 text-xs">
                {tab === 'stripe' ? 'Auto-sync from Stripe webhooks' : 'Call this from your backend or cron job (recommended: daily)'}
              </p>
              <button
                onClick={() => copy(CODE_EXAMPLES[tab](token || '<YOUR_TOKEN>', appUrl), tab)}
                className="text-xs px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors">
                {copied === tab ? '✓ Copied' : 'Copy code'}
              </button>
            </div>
            <pre className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-xs text-slate-300 overflow-x-auto leading-relaxed font-mono whitespace-pre">
              {CODE_EXAMPLES[tab](token || '<YOUR_TOKEN>', appUrl)}
            </pre>

            {/* Response format */}
            <div className="mt-4">
              <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold mb-2">Response</p>
              <pre className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-xs text-blue-400 font-mono">{`{
  "ok": true,
  "message": "Metrics saved. Your AI will use this data for goals and insights.",
  "received": { "paying_customers": 150, "mrr": 12500, ... }
}`}</pre>
            </div>
          </div>
        )}

        {/* Field reference */}
        {tab !== 'manual' && (
          <details className="mt-4">
            <summary className="text-slate-500 text-xs cursor-pointer hover:text-slate-400">All supported fields</summary>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {FIELD_META.map(f => (
                <div key={f.key} className="text-[10px]">
                  <code className="text-blue-400">{f.key}</code>
                  <span className="text-slate-600 ml-1">— {f.hint}</span>
                </div>
              ))}
              <div className="text-[10px]">
                <code className="text-blue-400">custom</code>
                <span className="text-slate-600 ml-1">— &#123; key: number | string &#125; any extra metrics</span>
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
