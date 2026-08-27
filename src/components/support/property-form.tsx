'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Globe, Mail, Palette, Zap, Eye, EyeOff, TestTube, Copy, Check, Users, Trash2, Loader2, Shield } from 'lucide-react'

interface Member {
  id: string
  member_email: string
  member_user_id: string | null
  role: string
  can_see_credentials: boolean
  invited_at: string
}

function TeamMembersSection({ propertyId }: { propertyId: string }) {
  const [members, setMembers]     = useState<Member[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [canSeeCreds, setCanSeeCreds] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    fetch(`/api/support/properties/${propertyId}/members`)
      .then(r => r.json())
      .then(d => setMembers(d.members || []))
      .finally(() => setLoading(false))
  }, [propertyId])

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/support/properties/${propertyId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_email: inviteEmail, can_see_credentials: canSeeCreds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMembers(m => {
        const without = m.filter(x => x.member_email !== data.member.member_email)
        return [data.member, ...without]
      })
      setInviteEmail('')
      setCanSeeCreds(false)
      toast.success('Member invited')
    } catch (err: unknown) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleCreds(member: Member) {
    const next = !member.can_see_credentials
    await fetch(`/api/support/properties/${propertyId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_email: member.member_email, can_see_credentials: next, role: member.role }),
    })
    setMembers(m => m.map(x => x.id === member.id ? { ...x, can_see_credentials: next } : x))
  }

  async function removeMember(memberId: string) {
    if (!confirm('Remove this team member?')) return
    await fetch(`/api/support/properties/${propertyId}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId }),
    })
    setMembers(m => m.filter(x => x.id !== memberId))
    toast.success('Member removed')
  }

  return (
    <div className="space-y-4">
      {/* Invite form */}
      <form onSubmit={invite} className="flex gap-2 flex-wrap">
        <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
          placeholder="teammate@email.com" required
          className="flex-1 min-w-40 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={canSeeCreds} onChange={e => setCanSeeCreds(e.target.checked)} className="rounded accent-blue-600" />
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          Can see credentials
        </label>
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Invite
        </button>
      </form>

      {/* Member list */}
      {loading ? (
        <p className="text-xs text-slate-400">Loading members…</p>
      ) : members.length === 0 ? (
        <p className="text-xs text-slate-400">No team members yet. Invite by email above.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 dark:text-slate-100 truncate">{m.member_email}</p>
                <p className="text-xs text-slate-400">
                  {m.member_user_id ? 'Active user' : 'Pending sign-up'} · {m.role}
                </p>
              </div>
              <button type="button" onClick={() => toggleCreds(m)}
                title="Toggle credential access"
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${m.can_see_credentials ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                <Shield className="w-3 h-3" />
                {m.can_see_credentials ? 'Credentials ✓' : 'No Credentials'}
              </button>
              <button type="button" onClick={() => removeMember(m.id)}
                className="text-slate-300 hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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

      {/* Team Members — edit mode only */}
      {mode === 'edit' && (
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-5">
            <Users className="w-4 h-4 text-blue-600" />
            Team Members
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Invited members can access this property&apos;s conversations in their own Support Manager after signing up with the same email.
          </p>
          <TeamMembersSection propertyId={String(initial.id)} />
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
