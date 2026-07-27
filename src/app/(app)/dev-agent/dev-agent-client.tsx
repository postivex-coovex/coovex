'use client'

import { useState } from 'react'
import {
  Copy, Check, Download, RefreshCw, ExternalLink,
  ShieldCheck, Plug, Globe, Clock, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

interface License {
  id: string
  site_url: string
  plugin_version: string | null
  last_validated: string
  revoked: boolean
  mismatch_count: number
}

interface Props {
  apiKey: string
  businessName: string
  licenses: License[]
}

export default function DevAgentClient({ apiKey, businessName, licenses }: Props) {
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [currentKey, setCurrentKey] = useState(apiKey)

  async function copyKey() {
    await navigator.clipboard.writeText(currentKey)
    setCopied(true)
    toast.success('API key copied')
    setTimeout(() => setCopied(false), 2000)
  }

  async function regenerateKey() {
    if (!confirm('Regenerate API key? Existing WordPress installations will disconnect until updated.')) return
    setRegenerating(true)
    try {
      const res = await fetch('/api/business/api-key', { method: 'POST' })
      const json = await res.json()
      if (json.api_key) {
        setCurrentKey(json.api_key)
        toast.success('API key regenerated — update it in your WordPress plugin settings')
      }
    } catch {
      toast.error('Failed to regenerate key')
    } finally {
      setRegenerating(false)
    }
  }

  const downloadUrl = `/api/wp-dev/plugin?api_key=${encodeURIComponent(currentKey)}`
  const activeSites = licenses.filter(l => !l.revoked)
  const isConnected = activeSites.length > 0

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
          <Plug className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">WordPress Dev Agent</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Control your WordPress site with natural language</p>
        </div>
        {isConnected && (
          <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {activeSites.length} site{activeSites.length > 1 ? 's' : ''} connected
          </span>
        )}
      </div>

      {/* Setup steps — shown only when not connected */}
      {!isConnected && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Quick Setup — 3 steps</h2>
          <ol className="space-y-4">
            {[
              {
                n: 1,
                title: 'Download the plugin',
                body: 'Click the download button below and save the ZIP file.',
              },
              {
                n: 2,
                title: 'Install on WordPress',
                body: 'Go to WP Admin → Plugins → Add New → Upload Plugin → select the ZIP → Install Now → Activate.',
              },
              {
                n: 3,
                title: 'Paste your API key',
                body: 'In WP Admin → CooVex Dev, paste your API key below and click Connect. The AI agent will be ready instantly.',
              },
            ].map(step => (
              <li key={step.n} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {step.n}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{step.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* API Key card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">API Key</span>
          </div>
          <button
            onClick={regenerateKey}
            disabled={regenerating}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
            Regenerate
          </button>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm font-mono text-slate-700 dark:text-slate-300 truncate border border-slate-200 dark:border-slate-700">
            {currentKey || 'Generating…'}
          </code>
          <button
            onClick={copyKey}
            className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">Paste this key in WP Admin → CooVex Dev → Connect.</p>
      </div>

      {/* Download button */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">CooVex Dev Plugin</p>
            <p className="text-xs text-slate-400 mt-0.5">Version 1.4.1 · WordPress 5.9+ · PHP 7.4+</p>
          </div>
          <a
            href={downloadUrl}
            download="coovex-dev.zip"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Download ZIP
          </a>
        </div>
      </div>

      {/* Connected sites */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Connected Sites</h2>
        </div>

        {licenses.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Globe className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No sites connected yet</p>
            <p className="text-xs text-slate-400 mt-1">Install the plugin on your WordPress site to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="px-5 py-3 text-left font-medium">Site URL</th>
                <th className="px-5 py-3 text-left font-medium">Version</th>
                <th className="px-5 py-3 text-left font-medium">Last Seen</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map(lic => (
                <tr key={lic.id} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <a
                      href={lic.site_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      {lic.site_url.replace(/^https?:\/\//, '')}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    {lic.plugin_version ? `v${lic.plugin_version}` : '—'}
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(lic.last_validated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {lic.revoked ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> Revoked
                      </span>
                    ) : lic.mismatch_count > 2 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> URL mismatch
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* What you can do */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">What the AI agent can do</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            'Write & publish articles with images',
            'SEO optimization (Yoast / RankMath)',
            'Install & manage plugins',
            'WooCommerce products, orders, coupons',
            'Create & manage users',
            'Redirect manager',
            'Maintenance mode',
            'DB cleanup & optimization',
            'Site audit & health check',
            'Image conversion to WebP',
            'Broken link scanner',
            'Schedule posts for future publish',
            'Webhooks to n8n, Zapier etc.',
            'Export data as CSV',
            'Login activity log',
            'Error log reader',
          ].map(item => (
            <div key={item} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
