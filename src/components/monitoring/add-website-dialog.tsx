'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Globe, Mail, Bell, X } from 'lucide-react'

export function AddWebsiteDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    url: '',
    name: '',
    alert_emails: '',
    alert_on_down: true,
    alert_on_ssl_expiry: true,
    alert_on_domain_expiry: true,
    alert_on_slow_load: true,
    slow_load_threshold_ms: 3000,
  })

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.url) return
    setLoading(true)
    try {
      const res = await fetch('/api/monitoring/websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed')
      }
      toast.success('Website added successfully')
      setOpen(false)
      setForm({ url: '', name: '', alert_emails: '', alert_on_down: true, alert_on_ssl_expiry: true, alert_on_domain_expiry: true, alert_on_slow_load: true, slow_load_threshold_ms: 3000 })
      router.refresh()
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Website
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Add Website</h2>
          </div>
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Website URL <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="https://example.com"
              value={form.url}
              onChange={e => set('url', e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Display Name <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              type="text"
              placeholder="My Website"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Alert emails */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              <Mail className="inline w-3.5 h-3.5 mr-1" />
              Alert Emails <span className="text-slate-400 font-normal">(comma-separated)</span>
            </label>
            <input
              type="text"
              placeholder="you@example.com, team@example.com"
              value={form.alert_emails}
              onChange={e => set('alert_emails', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Alert toggles */}
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              <Bell className="inline w-3.5 h-3.5 mr-1" />
              Alert me when:
            </p>
            <div className="space-y-2.5">
              {[
                { key: 'alert_on_down',          label: 'Website goes down' },
                { key: 'alert_on_ssl_expiry',    label: 'SSL certificate is expiring (30d / 7d)' },
                { key: 'alert_on_domain_expiry', label: 'Domain is expiring (30d / 7d)' },
                { key: 'alert_on_slow_load',     label: 'Response time exceeds threshold' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                  <div className={`relative w-8 h-4.5 rounded-full transition-colors ${form[key as keyof typeof form] ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                    onClick={() => set(key, !form[key as keyof typeof form])}>
                    <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${form[key as keyof typeof form] ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Slow load threshold */}
          {form.alert_on_slow_load && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Slow load threshold (ms)
              </label>
              <input
                type="number"
                min={500}
                max={30000}
                step={500}
                value={form.slow_load_threshold_ms}
                onChange={e => set('slow_load_threshold_ms', parseInt(e.target.value))}
                className="w-32 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-slate-400">{(form.slow_load_threshold_ms / 1000).toFixed(1)}s</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setOpen(false)}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
              {loading ? 'Adding...' : 'Add Website'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
