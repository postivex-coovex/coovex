'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Method = 'coovex' | 'gmail' | 'outlook' | 'resend' | 'sendgrid' | 'mailgun' | 'brevo' | 'postmark' | 'smtp'

interface Settings {
  from_name: string
  reply_to: string
  method: Method
  // Gmail / Outlook / SMTP
  smtp_user: string
  smtp_pass: string
  smtp_host: string
  smtp_port: string
  smtp_secure: boolean
  from_email: string
  // Resend
  resend_api_key: string
  resend_from_email: string
  // SendGrid
  sendgrid_api_key: string
  sendgrid_from_email: string
  // Mailgun
  mailgun_api_key: string
  mailgun_domain: string
  mailgun_region: 'us' | 'eu'
  // Brevo
  brevo_api_key: string
  brevo_login: string
  brevo_from_email: string
  // Postmark
  postmark_api_key: string
  postmark_from_email: string
}

const DEFAULT: Settings = {
  from_name: '',
  reply_to: '',
  method: 'coovex',
  smtp_user: '', smtp_pass: '', smtp_host: '', smtp_port: '587', smtp_secure: false, from_email: '',
  resend_api_key: '', resend_from_email: '',
  sendgrid_api_key: '', sendgrid_from_email: '',
  mailgun_api_key: '', mailgun_domain: '', mailgun_region: 'us',
  brevo_api_key: '', brevo_login: '', brevo_from_email: '',
  postmark_api_key: '', postmark_from_email: '',
}

const PROVIDERS: {
  key: Method
  name: string
  icon: string
  desc: string
  bg: string
  docs?: string
}[] = [
  { key: 'coovex',   name: 'CooVex',      icon: '🚀', desc: 'Zero setup',            bg: 'bg-slate-950/50 border-slate-700' },
  { key: 'gmail',    name: 'Gmail',        icon: '📧', desc: 'App Password',          bg: 'bg-red-950/40 border-red-700',     docs: 'https://myaccount.google.com/apppasswords' },
  { key: 'outlook',  name: 'Outlook',      icon: '📨', desc: 'Microsoft 365',         bg: 'bg-blue-950/40 border-blue-700' },
  { key: 'resend',   name: 'Resend',       icon: '⚡', desc: 'Custom domain',          bg: 'bg-slate-800 border-slate-600',    docs: 'https://resend.com/signup' },
  { key: 'sendgrid', name: 'SendGrid',     icon: '📮', desc: 'Twilio SendGrid',        bg: 'bg-sky-950/40 border-sky-700',     docs: 'https://app.sendgrid.com/settings/api_keys' },
  { key: 'mailgun',  name: 'Mailgun',      icon: '🔫', desc: 'Mailgun API',            bg: 'bg-red-950/30 border-red-800',     docs: 'https://app.mailgun.com/settings/api_security' },
  { key: 'brevo',    name: 'Brevo',        icon: '💌', desc: 'Sendinblue / Brevo',     bg: 'bg-slate-950/40 border-slate-700',   docs: 'https://app.brevo.com/settings/keys/api' },
  { key: 'postmark', name: 'Postmark',     icon: '📬', desc: 'Transactional email',    bg: 'bg-slate-950/40 border-slate-700', docs: 'https://account.postmarkapp.com/servers' },
  { key: 'smtp',     name: 'Custom SMTP',  icon: '🔧', desc: 'Any SMTP server',        bg: 'bg-slate-800 border-slate-600' },
]

const MASKED = '••••••••'
const SECRET_FIELDS: (keyof Settings)[] = [
  'smtp_pass', 'resend_api_key', 'sendgrid_api_key', 'mailgun_api_key', 'brevo_api_key', 'postmark_api_key',
]

function isMasked(val: string) { return val === MASKED }

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-slate-400">{label}</label>
        {hint && <span className="text-[10px] text-slate-600 ml-2 text-right max-w-[55%] leading-relaxed">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-600'
const inputMonoCls = inputCls + ' font-mono'

export default function EmailSettingsPage() {
  const [form, setForm]       = useState<Settings>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg]         = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/settings/email')
      .then(r => r.json())
      .then(d => {
        if (!d.settings) return
        const s = d.settings
        // Map old method field (reply_to → coovex)
        let method: Method = 'coovex'
        if (s.method === 'smtp' || s.method === 'gmail' || s.method === 'outlook') {
          if (s.smtp_host === 'smtp.gmail.com') method = 'gmail'
          else if (s.smtp_host === 'smtp.office365.com') method = 'outlook'
          else method = 'smtp'
        } else if (['resend', 'sendgrid', 'mailgun', 'brevo', 'postmark', 'smtp'].includes(s.method)) {
          method = s.method as Method
        }
        setForm(prev => ({
          ...prev,
          from_name:          s.from_name          || '',
          reply_to:           s.reply_to           || '',
          method,
          smtp_user:          s.smtp_user          || '',
          smtp_pass:          s.smtp_pass          || '',
          smtp_host:          s.smtp_host          || '',
          smtp_port:          s.smtp_port          || '587',
          smtp_secure:        s.smtp_secure        ?? false,
          from_email:         s.from_email         || '',
          resend_api_key:     s.resend_api_key     || '',
          resend_from_email:  s.resend_from_email  || '',
          sendgrid_api_key:   s.sendgrid_api_key   || '',
          sendgrid_from_email:s.sendgrid_from_email|| '',
          mailgun_api_key:    s.mailgun_api_key    || '',
          mailgun_domain:     s.mailgun_domain     || '',
          mailgun_region:     s.mailgun_region     || 'us',
          brevo_api_key:      s.brevo_api_key      || '',
          brevo_login:        s.brevo_login        || '',
          brevo_from_email:   s.brevo_from_email   || '',
          postmark_api_key:   s.postmark_api_key   || '',
          postmark_from_email:s.postmark_from_email|| '',
        }))
      })
      .finally(() => setLoading(false))
  }, [])

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function save() {
    setSaving(true); setMsg(null)
    try {
      const payload: Record<string, unknown> = { ...form }
      // Map gmail/outlook back to smtp with host set
      if (form.method === 'gmail')   { payload.method = 'gmail';   payload.smtp_host = 'smtp.gmail.com' }
      if (form.method === 'outlook') { payload.method = 'outlook'; payload.smtp_host = 'smtp.office365.com' }
      // Don't re-send masked values
      SECRET_FIELDS.forEach(k => { if (isMasked(form[k] as string)) delete payload[k] })
      const res = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setMsg(res.ok ? { text: 'Settings saved', ok: true } : { text: (await res.json()).error || 'Save failed', ok: false })
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 4000)
    }
  }

  async function testSend() {
    setTesting(true); setMsg(null)
    try {
      const payload: Record<string, unknown> = { settings: { ...form } }
      if (form.method === 'gmail')   { (payload.settings as Record<string,unknown>).smtp_host = 'smtp.gmail.com' }
      if (form.method === 'outlook') { (payload.settings as Record<string,unknown>).smtp_host = 'smtp.office365.com' }
      const res = await fetch('/api/settings/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json()
      setMsg(d.ok ? { text: 'Test email sent — check your inbox', ok: true } : { text: d.error || 'Test failed', ok: false })
    } finally {
      setTesting(false)
      setTimeout(() => setMsg(null), 8000)
    }
  }

  if (loading) return (
    <div className="p-8 max-w-2xl mx-auto space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-900 rounded-xl animate-pulse" />)}
    </div>
  )

  const activeProvider = PROVIDERS.find(p => p.key === form.method)!

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Email Sending</h1>
        <p className="text-slate-400 text-sm mt-1">Connect your email provider to send campaigns from your own address.</p>
      </div>

      {/* ── Sender Identity ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</div>
          <p className="text-white font-semibold text-sm">Sender Identity</p>
          <span className="ml-auto text-[10px] px-2 py-0.5 bg-slate-950/50 text-blue-400 border border-slate-700/40 rounded-full">Required</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="From Name" hint="Shown in inbox — e.g. Acme Team">
            <input value={form.from_name} onChange={e => set('from_name', e.target.value)}
              placeholder="Acme Team" className={inputCls} />
          </Field>
          <Field label="Reply-To Email" hint="Where replies land">
            <input value={form.reply_to} onChange={e => set('reply_to', e.target.value)}
              placeholder="hello@yourbusiness.com" className={inputCls} />
          </Field>
        </div>
      </div>

      {/* ── Provider Picker ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</div>
          <p className="text-white font-semibold text-sm">Email Provider</p>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {PROVIDERS.map(p => (
            <button
              key={p.key}
              onClick={() => set('method', p.key)}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center ${
                form.method === p.key
                  ? `${p.bg} ring-1 ring-blue-500`
                  : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
              }`}
            >
              <span className="text-2xl">{p.icon}</span>
              <span className={`text-xs font-semibold ${form.method === p.key ? 'text-white' : 'text-slate-300'}`}>{p.name}</span>
              <span className="text-[10px] text-slate-500">{p.desc}</span>
              {form.method === p.key && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Provider Config ── */}
      {form.method !== 'coovex' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{activeProvider.icon}</span>
            <div>
              <p className="text-white font-semibold text-sm">{activeProvider.name} Settings</p>
              {activeProvider.docs && (
                <a href={activeProvider.docs} target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
                  Get credentials →
                </a>
              )}
            </div>
          </div>

          {/* Gmail */}
          {form.method === 'gmail' && (
            <>
              <div className="bg-slate-950/20 border border-slate-700/30 rounded-xl px-4 py-3 text-xs text-slate-400">
                📌 Gmail requires an <strong>App Password</strong> — not your regular password.{' '}
                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline">Create one →</a>
              </div>
              <Field label="Gmail Address">
                <input value={form.smtp_user} onChange={e => set('smtp_user', e.target.value)}
                  placeholder="you@gmail.com" className={inputCls} />
              </Field>
              <Field label="App Password" hint="16-char password from Google Account settings">
                <input value={form.smtp_pass} onChange={e => set('smtp_pass', e.target.value)}
                  type="password" placeholder={isMasked(form.smtp_pass) ? form.smtp_pass : 'xxxx xxxx xxxx xxxx'} className={inputMonoCls} />
              </Field>
              <Field label="From Email" hint="Optional — defaults to Gmail address">
                <input value={form.from_email} onChange={e => set('from_email', e.target.value)}
                  placeholder="Same as Gmail address" className={inputCls} />
              </Field>
            </>
          )}

          {/* Outlook */}
          {form.method === 'outlook' && (
            <>
              <div className="bg-blue-950/20 border border-blue-800/30 rounded-xl px-4 py-3 text-xs text-blue-300">
                ℹ️ Works with Microsoft 365 / Outlook.com. If your org uses modern auth, you may need an App Password.
              </div>
              <Field label="Outlook / 365 Address">
                <input value={form.smtp_user} onChange={e => set('smtp_user', e.target.value)}
                  placeholder="you@yourcompany.com" className={inputCls} />
              </Field>
              <Field label="Password">
                <input value={form.smtp_pass} onChange={e => set('smtp_pass', e.target.value)}
                  type="password" placeholder="••••••••" className={inputMonoCls} />
              </Field>
              <Field label="From Email" hint="Optional — defaults to Outlook address">
                <input value={form.from_email} onChange={e => set('from_email', e.target.value)}
                  placeholder="Same as Outlook address" className={inputCls} />
              </Field>
            </>
          )}

          {/* Resend */}
          {form.method === 'resend' && (
            <>
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-300">
                Create account at <a href="https://resend.com/signup" target="_blank" rel="noreferrer" className="text-blue-400 underline">resend.com</a> → Verify your domain → Create API Key
              </div>
              <Field label="Resend API Key">
                <input value={form.resend_api_key} onChange={e => set('resend_api_key', e.target.value)}
                  type="password" placeholder={isMasked(form.resend_api_key) ? form.resend_api_key : 're_xxxxxxxxxxxx'} className={inputMonoCls} />
              </Field>
              <Field label="From Email" hint="Must be verified in Resend dashboard">
                <input value={form.resend_from_email} onChange={e => set('resend_from_email', e.target.value)}
                  placeholder="hello@yourdomain.com" className={inputCls} />
              </Field>
            </>
          )}

          {/* SendGrid */}
          {form.method === 'sendgrid' && (
            <>
              <div className="bg-sky-950/20 border border-sky-800/30 rounded-xl px-4 py-3 text-xs text-sky-300">
                <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noreferrer" className="underline">SendGrid</a> → Settings → API Keys → Create API Key (Full Access or Mail Send)
              </div>
              <Field label="SendGrid API Key">
                <input value={form.sendgrid_api_key} onChange={e => set('sendgrid_api_key', e.target.value)}
                  type="password" placeholder={isMasked(form.sendgrid_api_key) ? form.sendgrid_api_key : 'SG.xxxxxxxxxxxxxxxxxxxx'} className={inputMonoCls} />
              </Field>
              <Field label="From Email" hint="Must be verified sender in SendGrid">
                <input value={form.sendgrid_from_email} onChange={e => set('sendgrid_from_email', e.target.value)}
                  placeholder="hello@yourdomain.com" className={inputCls} />
              </Field>
            </>
          )}

          {/* Mailgun */}
          {form.method === 'mailgun' && (
            <>
              <div className="bg-red-950/20 border border-red-800/30 rounded-xl px-4 py-3 text-xs text-red-300">
                <a href="https://app.mailgun.com/settings/api_security" target="_blank" rel="noreferrer" className="underline">Mailgun</a> → Settings → API Security → Private API Key
              </div>
              <Field label="Mailgun API Key">
                <input value={form.mailgun_api_key} onChange={e => set('mailgun_api_key', e.target.value)}
                  type="password" placeholder={isMasked(form.mailgun_api_key) ? form.mailgun_api_key : 'key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'} className={inputMonoCls} />
              </Field>
              <Field label="Sending Domain" hint="Verified domain in Mailgun">
                <input value={form.mailgun_domain} onChange={e => set('mailgun_domain', e.target.value)}
                  placeholder="mg.yourdomain.com" className={inputCls} />
              </Field>
              <Field label="From Email" hint="Optional — defaults to noreply@{domain}">
                <input value={form.from_email} onChange={e => set('from_email', e.target.value)}
                  placeholder={`hello@${form.mailgun_domain || 'yourdomain.com'}`} className={inputCls} />
              </Field>
              <div>
                <p className="text-xs font-medium text-slate-400 mb-2">Region</p>
                <div className="flex gap-2">
                  {(['us', 'eu'] as const).map(r => (
                    <button key={r} onClick={() => set('mailgun_region', r)}
                      className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                        form.mailgun_region === r
                          ? 'bg-blue-700 border-blue-600 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}>
                      {r.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Brevo */}
          {form.method === 'brevo' && (
            <>
              <div className="bg-slate-950/20 border border-slate-700/30 rounded-xl px-4 py-3 text-xs text-blue-300">
                <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noreferrer" className="underline">Brevo</a> → Settings → API Keys → Generate a new API key. Your login email is used as the SMTP username.
              </div>
              <Field label="Brevo Login Email" hint="The email you use to log into Brevo">
                <input value={form.brevo_login} onChange={e => set('brevo_login', e.target.value)}
                  placeholder="you@example.com" className={inputCls} />
              </Field>
              <Field label="Brevo API Key">
                <input value={form.brevo_api_key} onChange={e => set('brevo_api_key', e.target.value)}
                  type="password" placeholder={isMasked(form.brevo_api_key) ? form.brevo_api_key : 'xkeysib-xxxxxxxxxxxx'} className={inputMonoCls} />
              </Field>
              <Field label="From Email" hint="Must be verified in Brevo senders">
                <input value={form.brevo_from_email} onChange={e => set('brevo_from_email', e.target.value)}
                  placeholder="hello@yourdomain.com" className={inputCls} />
              </Field>
            </>
          )}

          {/* Postmark */}
          {form.method === 'postmark' && (
            <>
              <div className="bg-slate-950/20 border border-slate-700/30 rounded-xl px-4 py-3 text-xs text-slate-400">
                <a href="https://account.postmarkapp.com/servers" target="_blank" rel="noreferrer" className="underline">Postmark</a> → Servers → Your server → API Tokens → Server API Token
              </div>
              <Field label="Server API Token">
                <input value={form.postmark_api_key} onChange={e => set('postmark_api_key', e.target.value)}
                  type="password" placeholder={isMasked(form.postmark_api_key) ? form.postmark_api_key : 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'} className={inputMonoCls} />
              </Field>
              <Field label="From Email" hint="Must be verified sender signature in Postmark">
                <input value={form.postmark_from_email} onChange={e => set('postmark_from_email', e.target.value)}
                  placeholder="hello@yourdomain.com" className={inputCls} />
              </Field>
            </>
          )}

          {/* Custom SMTP */}
          {form.method === 'smtp' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="SMTP Host">
                  <input value={form.smtp_host} onChange={e => set('smtp_host', e.target.value)}
                    placeholder="mail.yourdomain.com" className={inputCls} />
                </Field>
                <Field label="Port">
                  <input value={form.smtp_port} onChange={e => set('smtp_port', e.target.value)}
                    placeholder="587" className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Username / Email">
                  <input value={form.smtp_user} onChange={e => set('smtp_user', e.target.value)}
                    placeholder="you@domain.com" className={inputCls} />
                </Field>
                <Field label="Password">
                  <input value={form.smtp_pass} onChange={e => set('smtp_pass', e.target.value)}
                    type="password" placeholder="••••••••" className={inputMonoCls} />
                </Field>
              </div>
              <Field label="From Email" hint="Shown to recipients">
                <input value={form.from_email} onChange={e => set('from_email', e.target.value)}
                  placeholder="hello@yourdomain.com" className={inputCls} />
              </Field>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.smtp_secure} onChange={e => set('smtp_secure', e.target.checked)}
                  className="w-4 h-4 rounded accent-violet-500" />
                <span className="text-slate-400 text-sm">Use SSL/TLS (port 465)</span>
              </label>
            </>
          )}
        </div>
      )}

      {/* CooVex default notice */}
      {form.method === 'coovex' && (
        <div className="bg-slate-950/20 border border-slate-700/30 rounded-2xl p-5">
          <p className="text-blue-300 text-sm font-semibold mb-1">🚀 CooVex Default — Ready to use</p>
          <p className="text-blue-300/70 text-xs leading-relaxed">
            Campaigns are sent from <code className="bg-slate-900/40 px-1.5 py-0.5 rounded text-blue-200">noreply@coovex.com</code> with your From Name.
            For better deliverability and your own brand, connect a provider above.
          </p>
        </div>
      )}

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm ${
          msg.ok ? 'bg-slate-900/30 border border-slate-700/30 text-blue-300'
                 : 'bg-red-900/30 border border-red-800/30 text-red-300'
        }`}>
          {msg.ok ? '✓ ' : '✗ '}{msg.text}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={testSend} disabled={testing || saving || !form.from_name}
          className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 text-slate-300 text-sm font-medium py-3 rounded-xl transition-colors">
          {testing
            ? <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border border-slate-300/30 border-t-slate-300 rounded-full animate-spin inline-block" />
                Sending…
              </span>
            : '📧 Send Test Email'}
        </button>
        <button onClick={save} disabled={saving || testing || !form.from_name || !form.reply_to}
          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-3 rounded-xl transition-colors">
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      <p className="text-slate-600 text-xs text-center">
        Test email is sent to your CooVex account email. ·{' '}
        <Link href="/campaigns" className="text-blue-500 hover:text-blue-400">Back to Campaigns</Link>
      </p>
    </div>
  )
}
