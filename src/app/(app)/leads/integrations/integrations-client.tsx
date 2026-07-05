'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

interface Props {
  businessName: string
  webhookUrl: string
  appUrl: string
  facebookConnected: boolean
  fbWebhookUrl: string
  fbVerifyToken: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg transition-colors flex-shrink-0"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-slate-950 text-slate-300 rounded-xl p-5 text-sm overflow-x-auto leading-relaxed font-mono border border-slate-800">
      {children}
    </pre>
  )
}

export function IntegrationsClient({ businessName, webhookUrl, appUrl, facebookConnected, fbWebhookUrl, fbVerifyToken }: Props) {
  const [activeTab, setActiveTab] = useState<'webhook' | 'csv' | 'embed'>('webhook')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported?: number; skipped?: number; error?: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleCSV = async () => {
    if (!csvFile) return
    setImporting(true)
    setImportResult(null)
    try {
      const text = await csvFile.text()
      // Parse CSV in browser
      const lines = text.trim().split('\n').filter(l => l.trim())
      if (lines.length < 2) throw new Error('CSV must have at least a header row and one data row')

      const headers = lines[0].split(',').map(h =>
        h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/[\s\-]+/g, '_')
      )

      const rows = lines.slice(1).map(line => {
        const values = parseCSVLine(line)
        const row: Record<string, string> = {}
        headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim().replace(/^"|"$/g, '') })
        return row
      }).filter(r => Object.values(r).some(v => v))

      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setImportResult({ imported: data.imported, skipped: data.skipped })
      setCsvFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      setImportResult({ error: e instanceof Error ? e.message : 'Import failed' })
    } finally {
      setImporting(false)
    }
  }

  const embedCode = `<script src="${appUrl}/widget/lead-form.js" data-webhook="${webhookUrl}" async></script>`

  const TABS = [
    { id: 'webhook', label: '🔗 Webhook', desc: 'Zapier, Make, Typeform, any form' },
    { id: 'csv', label: '📄 CSV Import', desc: 'Bulk upload from spreadsheet' },
    { id: 'embed', label: '🖱 Embed Form', desc: 'Drop form on any website' },
  ] as const

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Link href="/leads" className="text-slate-400 hover:text-slate-300 text-sm transition-colors">← Leads</Link>
        <span className="text-slate-600">/</span>
        <h1 className="text-2xl font-bold text-white">Lead Funnel Integration</h1>
      </div>
      <p className="text-slate-400 mb-8">
        Connect any lead source to <strong className="text-slate-200">{businessName || 'your business'}</strong>. Leads flow directly into your CooVex pipeline.
      </p>

      {/* Tab selector */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`text-left p-4 rounded-xl border transition-colors ${
              activeTab === tab.id
                ? 'border-violet-500/50 bg-violet-950/20 text-white'
                : 'border-slate-700 hover:border-slate-600 bg-slate-900 text-slate-300'
            }`}
          >
            <p className="font-medium">{tab.label}</p>
            <p className="text-sm text-slate-500 mt-0.5">{tab.desc}</p>
          </button>
        ))}
      </div>

      {/* ── Webhook tab ────────────────────────────────────────── */}
      {activeTab === 'webhook' && (
        <div className="space-y-5">
          {/* Webhook URL */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="font-semibold text-white text-lg mb-1">Your Webhook URL</h2>
            <p className="text-sm text-slate-500 mb-4">Paste this URL anywhere that sends webhook/HTTP POST requests.</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 bg-slate-950 border border-slate-700 text-slate-300 text-sm rounded-lg px-4 py-3 truncate font-mono">
                {webhookUrl}
              </code>
              <CopyButton text={webhookUrl} />
            </div>
          </div>

          {/* Zapier/Make */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="font-semibold text-white text-lg mb-3">🔄 Zapier / Make / n8n</h2>
            <ol className="space-y-1.5 text-slate-400 list-decimal list-inside space-y-2">
              <li>In Zapier/Make, add a <strong className="text-slate-200">Webhook action</strong> step</li>
              <li>Set method to <code className="bg-slate-800 px-2 py-0.5 rounded text-sm text-slate-300 font-mono">POST</code>, paste the URL above</li>
              <li>Map your fields: <code className="bg-slate-800 px-2 py-0.5 rounded text-sm text-slate-300 font-mono">name</code>, <code className="bg-slate-800 px-2 py-0.5 rounded text-sm text-slate-300 font-mono">email</code>, <code className="bg-slate-800 px-2 py-0.5 rounded text-sm text-slate-300 font-mono">phone</code>, <code className="bg-slate-800 px-2 py-0.5 rounded text-sm text-slate-300 font-mono">company</code>, <code className="bg-slate-800 px-2 py-0.5 rounded text-sm text-slate-300 font-mono">message</code></li>
              <li>Test — lead should appear in <Link href="/leads" className="text-violet-600 hover:text-violet-500">your pipeline</Link></li>
            </ol>
          </div>

          {/* Typeform */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="font-semibold text-white text-lg mb-3">📋 Typeform</h2>
            <ol className="space-y-1.5 text-slate-400 list-decimal list-inside space-y-2">
              <li>In your Typeform, go to <strong className="text-slate-200">Connect → Webhooks</strong></li>
              <li>Add new webhook, paste URL above</li>
              <li>Enable, test — Typeform sends full <code className="bg-slate-800 px-2 py-0.5 rounded text-sm text-slate-300 font-mono">form_response</code> payload which we parse automatically</li>
            </ol>
          </div>

          {/* Raw JSON payload format */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="font-semibold text-white text-lg mb-3">📦 JSON Payload Format</h2>
            <p className="text-sm text-slate-500 mb-4">For custom forms or direct API calls:</p>
            <CodeBlock>{`POST ${webhookUrl}
Content-Type: application/json

{
  "name": "Sarah Johnson",
  "email": "sarah@company.com",
  "phone": "+1 555-0100",
  "company": "Acme Corp",
  "message": "Interested in your services"
}`}
            </CodeBlock>
            <p className="text-xs text-slate-400 mt-2">All fields optional except at least one of <code>name</code> or <code>email</code>.</p>
          </div>

          {/* Facebook Lead Ads */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📘</span>
                <div>
                  <h2 className="font-semibold text-white text-lg">Facebook / Instagram Lead Ads</h2>
                  <p className="text-sm text-slate-500">Leads from your FB/IG ad forms sync automatically.</p>
                </div>
              </div>
              {facebookConnected ? (
                <span className="text-xs bg-emerald-950/50 text-emerald-400 border border-emerald-800/40 px-3 py-1 rounded-full font-medium">Connected</span>
              ) : (
                <span className="text-xs bg-slate-800 text-slate-500 border border-slate-700 px-3 py-1 rounded-full">Not connected</span>
              )}
            </div>

            {!facebookConnected ? (
              <div className="bg-slate-950 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                <p className="text-sm text-slate-400">Connect your Facebook account first to enable Lead Ads sync.</p>
                <Link href="/settings/integrations#social" className="ml-4 flex-shrink-0 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                  Connect Facebook →
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">
                  Facebook is connected. Add this webhook in your{' '}
                  <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300">
                    Facebook App dashboard
                  </a>{' '}
                  under <strong className="text-slate-300">Webhooks → Page → leadgen</strong>.
                </p>

                <div>
                  <p className="text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider">Callback URL</p>
                  <div className="flex items-center gap-3">
                    <code className="flex-1 bg-slate-950 border border-slate-700 text-slate-300 text-sm rounded-lg px-4 py-3 truncate font-mono">
                      {fbWebhookUrl}
                    </code>
                    <CopyButton text={fbWebhookUrl} />
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider">Verify Token</p>
                  <div className="flex items-center gap-3">
                    <code className="flex-1 bg-slate-950 border border-slate-700 text-slate-300 text-sm rounded-lg px-4 py-3 font-mono">
                      {fbVerifyToken}
                    </code>
                    <CopyButton text={fbVerifyToken} />
                  </div>
                </div>

                <div className="bg-violet-950/20 border border-violet-900/30 rounded-xl p-4 text-sm text-slate-400 space-y-1">
                  <p className="text-violet-300 font-medium mb-2">Setup steps</p>
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>Go to <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">developers.facebook.com/apps</a> → your app</li>
                    <li>Open <strong className="text-slate-300">Webhooks</strong>, choose <strong className="text-slate-300">Page</strong> object</li>
                    <li>Click <strong className="text-slate-300">Subscribe to this object</strong>, paste the callback URL and verify token above</li>
                    <li>After subscribing, check the <strong className="text-slate-300">leadgen</strong> checkbox for your page</li>
                    <li>New leads from any Lead Ad will now appear here automatically</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CSV Import tab ─────────────────────────────────────── */}
      {activeTab === 'csv' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="font-semibold text-white text-lg mb-1">Import from CSV</h2>
            <p className="text-sm text-slate-500 mb-4">Supports exports from HubSpot, Salesforce, LinkedIn, Apollo, and any spreadsheet. Max 500 rows.</p>

            {/* Column mapping guide */}
            <div className="bg-slate-950 border border-slate-700 rounded-xl p-5 mb-5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Accepted Column Names</p>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {[
                  ['Name', 'name, full_name, contact_name'],
                  ['Email', 'email, email_address, e-mail'],
                  ['Phone', 'phone, mobile, tel'],
                  ['Company', 'company, organization, account'],
                  ['Title', 'title, job_title, position, role'],
                  ['Notes', 'notes, message, description'],
                ].map(([field, aliases]) => (
                  <div key={field} className="flex gap-1.5">
                    <span className="text-slate-400 w-14 flex-shrink-0">{field}:</span>
                    <span className="text-slate-600 dark:text-slate-500 font-mono">{aliases}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* File picker */}
            <div
              className="border-2 border-dashed border-slate-700 rounded-xl p-10 text-center cursor-pointer hover:border-violet-600 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => setCsvFile(e.target.files?.[0] ?? null)}
              />
              {csvFile ? (
                <div>
                  <p className="text-white font-medium">{csvFile.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{(csvFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-slate-400">Click to select CSV file</p>
                  <p className="text-slate-500 text-sm mt-1">or drag and drop</p>
                </div>
              )}
            </div>

            <button
              onClick={handleCSV}
              disabled={!csvFile || importing}
              className="w-full mt-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {importing ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importing…</>
              ) : '⬆ Import Leads'}
            </button>

            {importResult && (
              <div className={`mt-3 p-3 rounded-xl text-sm text-center ${
                importResult.error
                  ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/30'
                  : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30'
              }`}>
                {importResult.error
                  ? `Error: ${importResult.error}`
                  : `✓ Imported ${importResult.imported} leads${importResult.skipped ? ` (${importResult.skipped} skipped — duplicates or missing name/email)` : ''}`
                }
              </div>
            )}
          </div>

          {/* CSV template download */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="font-semibold text-white text-lg mb-2">Download Template</h2>
            <p className="text-sm text-slate-500 mb-4">Use this CSV template to ensure correct column names.</p>
            <button
              onClick={() => {
                const csv = 'name,email,phone,company,title,notes\n"John Smith","john@example.com","+1 555-0100","Acme Corp","CEO","Met at conference"'
                const blob = new Blob([csv], { type: 'text/csv' })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = 'coovex-leads-template.csv'
                a.click()
              }}
              className="text-sm text-violet-600 hover:text-violet-500 font-medium"
            >
              ⬇ Download CSV Template
            </button>
          </div>
        </div>
      )}

      {/* ── Embed Form tab ─────────────────────────────────────── */}
      {activeTab === 'embed' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="font-semibold text-white text-lg mb-1">Embed Lead Form</h2>
            <p className="text-sm text-slate-500 mb-4">
              Drop this snippet anywhere on your website. Visitors submit the form → lead appears instantly in your CooVex pipeline.
            </p>

            <div className="flex items-start gap-2">
              <pre className="flex-1 bg-slate-950 border border-slate-700 text-slate-300 text-xs rounded-xl p-3 overflow-x-auto font-mono">
                {embedCode}
              </pre>
              <CopyButton text={embedCode} />
            </div>

            <div className="mt-4 bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-800/30 rounded-xl p-3">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <strong>Note:</strong> The embed widget is deployed as <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">/public/widget/lead-form.js</code>.
                Works on any HTML website — WordPress, Webflow, Squarespace.
              </p>
            </div>
          </div>

          {/* Widget preview / instructions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="font-semibold text-white text-lg mb-3">Form Preview</h2>
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 bg-slate-50 dark:bg-slate-950 space-y-3">
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">Your Name *</label>
                <div className="h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg" />
              </div>
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">Email *</label>
                <div className="h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg" />
              </div>
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">Message</label>
                <div className="h-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg" />
              </div>
              <div className="h-9 bg-violet-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-medium">Send Message</span>
              </div>
            </div>
          </div>

          {/* WordPress */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="font-semibold text-white text-lg mb-3">WordPress (Gravity Forms / WPForms)</h2>
            <ol className="space-y-1.5 text-slate-400 list-decimal list-inside space-y-2">
              <li>In your form plugin, go to <strong className="text-slate-200">Notifications / Webhooks</strong></li>
              <li>Add webhook URL: <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono break-all">{webhookUrl}</code></li>
              <li>Map fields: <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">name</code>, <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">email</code>, etc.</li>
            </ol>
          </div>
        </div>
      )}

      {/* All leads link */}
      <div className="mt-6 text-center">
        <Link href="/leads" className="text-violet-600 hover:text-violet-500 text-sm font-medium">
          View All Leads →
        </Link>
      </div>
    </div>
  )
}

// Handle quoted CSV fields with commas inside
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}
