'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Globe, Mail, Palette, Zap, Eye, EyeOff, TestTube, Copy, Check } from 'lucide-react'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.coovex.com'

interface Props {
  initial?: Record<string, unknown>
  mode: 'create' | 'edit'
}

export function PropertyForm({ initial = {}, mode }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const [form, setForm] = useState({
    name:               (initial.name as string)               || '',
    domain:             (initial.domain as string)             || '',
    smtp_host:          (initial.smtp_host as string)          || '',
    smtp_port:          (initial.smtp_port as number)          || 587,
    smtp_user:          (initial.smtp_user as string)          || '',
    smtp_password:      (initial.smtp_password as string)      || '',
    smtp_secure:        (initial.smtp_secure as boolean)       ?? false,
    from_email:         (initial.from_email as string)         || '',
    from_name:          (initial.from_name as string)          || '',
    widget_color:       (initial.widget_color as string)       || '#2563eb',
    widget_position:    (initial.widget_position as string)    || 'bottom-right',
    widget_title:       (initial.widget_title as string)       || 'Support',
    widget_subtitle:    (initial.widget_subtitle as string)    || 'How can we help?',
    welcome_message:    (initial.welcome_message as string)    || 'Hi! How can we help you today?',
    inbound_email:      (initial.inbound_email as string)      || '',
    auto_reply_enabled: (initial.auto_reply_enabled as boolean) ?? false,
    auto_reply_message: (initial.auto_reply_message as string) || '',
  })

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const url  = mode === 'create' ? '/api/support/properties' : `/api/support/properties/${initial.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(mode === 'create' ? 'Property created' : 'Property updated')
      router.push(`/support/properties/${data.id}`)
      router.refresh()
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function testSmtp() {
    setTesting(true)
    try {
      const res = await fetch('/api/support/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: initial.id, test_to: form.from_email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(data.message)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setTesting(false)
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const webhookUrl = `${APP_URL}/api/support/email-webhook?key=${initial.api_key || 'YOUR_API_KEY'}`
  const embedSnippet = `<script>
  window.CooVexSupport = {
    key: '${initial.api_key || 'YOUR_API_KEY'}',
    title: '${form.widget_title}',
    color: '${form.widget_color}',
    position: '${form.widget_position}',
  };
</script>
<script src="${APP_URL}/support-widget.js" async></script>`

  return (
    <form onSubmit={submit} className="space-y-8 max-w-2xl">
      {/* Basic Info */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-5">
          <Globe className="w-4 h-4 text-blue-600" />
          Property Info
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Name <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={e => set('name', e.target.value)} required placeholder="My Website"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Domain</label>
            <input value={form.domain} onChange={e => set('domain', e.target.value)} placeholder="example.com"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </section>

      {/* SMTP */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600" />
            SMTP Email Settings
          </h2>
          {mode === 'edit' && (
            <button type="button" onClick={testSmtp} disabled={testing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300 disabled:opacity-60">
              <TestTube className="w-3.5 h-3.5" />
              {testing ? 'Testing…' : 'Test SMTP'}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">SMTP Host</label>
            <input value={form.smtp_host} onChange={e => set('smtp_host', e.target.value)} placeholder="smtp.gmail.com"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Port</label>
            <input type="number" value={form.smtp_port} onChange={e => set('smtp_port', parseInt(e.target.value))} placeholder="587"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">SMTP Username</label>
            <input value={form.smtp_user} onChange={e => set('smtp_user', e.target.value)} placeholder="you@gmail.com"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">SMTP Password</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={form.smtp_password} onChange={e => set('smtp_password', e.target.value)} placeholder="App password"
                className="w-full px-3 py-2.5 pr-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">From Email</label>
            <input value={form.from_email} onChange={e => set('from_email', e.target.value)} placeholder="support@yoursite.com"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">From Name</label>
            <input value={form.from_name} onChange={e => set('from_name', e.target.value)} placeholder="My Site Support"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.smtp_secure} onChange={e => set('smtp_secure', e.target.checked)} className="rounded accent-blue-600" />
          <span className="text-sm text-slate-600 dark:text-slate-300">Use SSL/TLS (port 465)</span>
        </label>
      </section>

      {/* Widget Appearance */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-5">
          <Palette className="w-4 h-4 text-blue-600" />
          Widget Appearance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Widget Title</label>
            <input value={form.widget_title} onChange={e => set('widget_title', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Widget Subtitle</label>
            <input value={form.widget_subtitle} onChange={e => set('widget_subtitle', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Accent Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.widget_color} onChange={e => set('widget_color', e.target.value)}
                className="w-10 h-10 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer" />
              <input value={form.widget_color} onChange={e => set('widget_color', e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Position</label>
            <select value={form.widget_position} onChange={e => set('widget_position', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Welcome Message</label>
          <textarea value={form.welcome_message} onChange={e => set('welcome_message', e.target.value)} rows={2}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </section>

      {/* Auto-reply */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-5">
          <Zap className="w-4 h-4 text-blue-600" />
          Auto-reply
        </h2>
        <label className="flex items-center gap-2 cursor-pointer mb-4">
          <input type="checkbox" checked={form.auto_reply_enabled} onChange={e => set('auto_reply_enabled', e.target.checked)} className="rounded accent-blue-600" />
          <span className="text-sm text-slate-600 dark:text-slate-300">Send automatic reply to new messages</span>
        </label>
        {form.auto_reply_enabled && (
          <textarea value={form.auto_reply_message} onChange={e => set('auto_reply_message', e.target.value)} rows={3}
            placeholder="Thanks for reaching out! We'll get back to you within 24 hours."
            className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        )}
      </section>

      {/* Embed codes — only in edit mode */}
      {mode === 'edit' && (
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Embed & Webhook</h2>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">JS Widget Snippet</label>
              <button type="button" onClick={() => copy(embedSnippet, 'widget')}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                {copied === 'widget' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                Copy
              </button>
            </div>
            <pre className="text-xs bg-slate-950 text-green-300 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">{embedSnippet}</pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Email Inbound Webhook URL
                <span className="ml-2 text-xs text-slate-400 font-normal">(Postmark / Mailgun / SendGrid)</span>
              </label>
              <button type="button" onClick={() => copy(webhookUrl, 'webhook')}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                {copied === 'webhook' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                Copy
              </button>
            </div>
            <pre className="text-xs bg-slate-950 text-green-300 p-3 rounded-lg overflow-x-auto break-all">{webhookUrl}</pre>
            <p className="text-xs text-slate-400 mt-1">
              Set this as the inbound webhook URL in your email provider. Forward emails to this URL and they&apos;ll appear in your inbox with source type &ldquo;Email&rdquo;.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Property API Key</label>
              <button type="button" onClick={() => copy(String(initial.api_key), 'apikey')}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                {copied === 'apikey' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                Copy
              </button>
            </div>
            <code className="text-xs bg-slate-950 text-green-300 px-3 py-2 rounded-lg block font-mono break-all">{String(initial.api_key)}</code>
          </div>
        </section>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={() => router.back()}
          className="px-5 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 sm:flex-none px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
          {loading ? 'Saving…' : mode === 'create' ? 'Create Property' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
