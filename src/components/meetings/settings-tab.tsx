'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Loader2, Video } from 'lucide-react'
import type { HostSettings } from './meetings-client'
import { api, btnOutline, btnPrimary, inputCls, labelCls } from './ui'
import { browserTimeZone, allTimeZones } from './timezone-select'

export function SettingsTab({ settings, onSaved }: { settings: HostSettings; onSaved: (s: HostSettings) => void }) {
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const zones = allTimeZones([settings.timezone, browserTimeZone(), 'UTC'])

  const set = <K extends keyof HostSettings>(k: K, v: HostSettings[K]) => setForm(f => ({ ...f, [k]: v }))

  const save = async (): Promise<boolean> => {
    setSaving(true)
    setError('')
    try {
      const { zoom_connected: _zc, ...body } = form
      void _zc
      const r = await api<{ settings: HostSettings }>('/api/meetings/settings', { method: 'PUT', body: JSON.stringify(body) })
      setForm(r.settings)
      onSaved(r.settings)
      toast.success('Settings saved')
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
      return false
    } finally {
      setSaving(false)
    }
  }

  const testZoom = async () => {
    if (!(await save())) return
    setTesting(true)
    try {
      await api('/api/meetings/zoom-test', { method: 'POST' })
      toast.success('Zoom connected. Meeting links will be created automatically.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Zoom test failed')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">Public profile</h2>
        <div>
          <label className={labelCls}>Your booking link</label>
          <div className="flex items-center gap-1 text-sm text-slate-500">
            <span className="shrink-0">{typeof window !== 'undefined' ? window.location.origin : ''}/book/</span>
            <input value={form.slug} onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className={inputCls} />
          </div>
          <p className="text-xs text-slate-500 mt-1">Changing this breaks links you already shared.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className={labelCls}>Display name</label>
            <input value={form.display_name || ''} onChange={e => set('display_name', e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Notification email</label>
            <input type="email" value={form.host_email || ''} onChange={e => set('host_email', e.target.value)} placeholder="Where booking alerts are sent" className={inputCls} /></div>
        </div>
        <div><label className={labelCls}>Bio</label>
          <textarea rows={2} value={form.bio || ''} onChange={e => set('bio', e.target.value)} placeholder="Shown on your booking page" className={inputCls} /></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className={labelCls}>Your timezone</label>
            <div className="flex gap-2">
              <select value={form.timezone} onChange={e => set('timezone', e.target.value)} className={inputCls}>
                {zones.map(z => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
              </select>
              <button type="button" className={btnOutline} onClick={() => set('timezone', browserTimeZone())}>Detect</button>
            </div>
            <p className="text-xs text-slate-500 mt-1">Clients always see times in their own timezone.</p></div>
          <div><label className={labelCls}>Brand color</label>
            <input type="color" value={form.brand_color} onChange={e => set('brand_color', e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1" /></div>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Video className="w-4 h-4 text-blue-600" />Zoom</h2>
          {settings.zoom_connected && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-600 text-white inline-flex items-center gap-1"><Check className="w-3 h-3" />Credentials saved</span>}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Connect Zoom so a unique meeting link is created automatically for every confirmed booking.
          No Zoom? Use a custom link, or choose “I will add the link when confirming” on a meeting type.
        </p>
        <ol className="text-xs text-slate-500 list-decimal pl-5 space-y-1">
          <li>Open the Zoom App Marketplace → Develop → Build App → <strong>Server-to-Server OAuth</strong>.</li>
          <li>Copy the Account ID, Client ID and Client Secret into the fields below.</li>
          <li>Under Scopes add <code>meeting:write:meeting:admin</code>, <code>meeting:update:meeting:admin</code> and <code>meeting:delete:meeting:admin</code>.</li>
          <li>Activate the app, then press “Save &amp; test connection”.</li>
        </ol>
        <div className="grid sm:grid-cols-3 gap-4">
          <div><label className={labelCls}>Account ID</label>
            <input value={form.zoom_account_id || ''} onChange={e => set('zoom_account_id', e.target.value)} className={inputCls} autoComplete="off" /></div>
          <div><label className={labelCls}>Client ID</label>
            <input value={form.zoom_client_id || ''} onChange={e => set('zoom_client_id', e.target.value)} className={inputCls} autoComplete="off" /></div>
          <div><label className={labelCls}>Client Secret</label>
            <input type="password" value={form.zoom_client_secret} onChange={e => set('zoom_client_secret', e.target.value)} className={inputCls} autoComplete="new-password" /></div>
        </div>
        <button className={btnOutline} disabled={testing || saving} onClick={testZoom}>
          {testing && <Loader2 className="w-4 h-4 animate-spin" />}Save &amp; test connection
        </button>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button className={btnPrimary} disabled={saving} onClick={save}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}Save settings
        </button>
      </div>
    </div>
  )
}
