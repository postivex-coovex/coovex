'use client'

import { useState, useRef } from 'react'

interface DataImportSectionProps {
  webhookUrl: string
}

const CSV_TEMPLATE = `name,company,email,value,currency,close_date,status,probability
John Smith,Acme Corp,john@acme.com,5000,USD,2026-07-30,won,100
Jane Doe,Beta Ltd,jane@beta.com,2500,USD,2026-08-15,open,60
Bob Lee,Gamma Inc,,3000,EUR,,lost,0`

export default function DataImportSection({ webhookUrl }: DataImportSectionProps) {
  const [copied, setCopied]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)
  const [pasteMode, setPasteMode] = useState(false)
  const [csvText, setCsvText]   = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function copyWebhook() {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'coovex_deals_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function importCSV(text: string) {
    setUploading(true); setImportResult(null)
    try {
      const res = await fetch('/api/integrations/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text }),
      })
      const d = await res.json() as { imported: number; skipped: number; errors: string[] }
      setImportResult(d)
      setCsvText(''); setPasteMode(false)
    } finally { setUploading(false) }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    importCSV(text)
    e.target.value = ''
  }

  return (
    <div className="space-y-4">

      {/* Webhook for custom CRM */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-4 p-5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-slate-800 flex-shrink-0">🔌</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-white font-medium">Custom CRM / Webhook</h3>
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-950/50 text-blue-400 border border-slate-700/40 rounded-full">Live</span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">Send deals from any CRM or in-house system to this URL. No SDK required.</p>
          </div>
        </div>
        <div className="px-5 pb-5 border-t border-slate-800/60 pt-4 space-y-4">
          <div>
            <p className="text-slate-400 text-xs font-medium mb-1.5">Your Webhook URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-blue-300 text-xs font-mono truncate">
                {webhookUrl}
              </code>
              <button onClick={copyWebhook}
                className={`text-xs px-3 py-2.5 rounded-lg border transition-colors shrink-0 ${
                  copied ? 'bg-slate-950/40 text-blue-400 border-slate-700/40' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div>
            <p className="text-slate-400 text-xs font-medium mb-1.5">How to use — POST request example</p>
            <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-[10px] text-slate-400 overflow-x-auto font-mono leading-relaxed">{`POST ${webhookUrl}
Header: x-coovex-token: <your_token_from_URL>

{
  "event": "deal.won",
  "deal": {
    "id": "your_crm_deal_id_123",
    "name": "John Smith",
    "company": "Acme Corp",
    "email": "john@acme.com",
    "value": 5000,
    "currency": "USD",
    "close_date": "2026-07-30",
    "status": "won",
    "probability": 100
  }
}`}</pre>
            <p className="text-slate-600 text-[10px] mt-2">
              The token is the last part of your webhook URL. Supported events: <code className="text-slate-500">deal.created</code>, <code className="text-slate-500">deal.updated</code>, <code className="text-slate-500">deal.won</code>, <code className="text-slate-500">deal.lost</code>
            </p>
          </div>

          <div className="bg-slate-800/40 rounded-xl p-3">
            <p className="text-slate-400 text-xs font-medium mb-1">Supported stage values</p>
            <p className="text-slate-600 text-[10px] font-mono">new · contacted · qualified · proposal · negotiation · won · lost</p>
          </div>
        </div>
      </div>

      {/* CSV Import */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-4 p-5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-slate-800 flex-shrink-0">📊</div>
          <div className="flex-1">
            <h3 className="text-white font-medium">Import from CSV / Excel</h3>
            <p className="text-slate-500 text-sm mt-0.5">Upload a spreadsheet of deals. Works with exports from any CRM or accounting tool.</p>
          </div>
        </div>

        <div className="px-5 pb-5 border-t border-slate-800/60 pt-4 space-y-4">
          <div>
            <p className="text-slate-400 text-xs font-medium mb-1.5">Required columns (flexible naming)</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {[
                ['name', 'contact_name, customer'],
                ['company', 'organization, account'],
                ['email', 'email_address'],
                ['value', 'amount, deal_value, revenue'],
                ['close_date', 'closing_date, won_date'],
                ['status', 'open / won / lost'],
              ].map(([col, alt]) => (
                <div key={col} className="flex items-center gap-1.5">
                  <code className="text-blue-400 text-[10px]">{col}</code>
                  <span className="text-slate-700 text-[10px]">or {alt}</span>
                </div>
              ))}
            </div>
          </div>

          {importResult && (
            <div className={`p-3 rounded-xl border text-xs ${
              importResult.imported > 0 ? 'bg-slate-950/20 border-slate-700/30 text-blue-300' : 'bg-slate-950/20 border-slate-700/30 text-slate-400'
            }`}>
              <p className="font-medium">Import complete: {importResult.imported} deals imported, {importResult.skipped} skipped</p>
              {importResult.errors.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-[10px] text-slate-500/70">
                  {importResult.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={downloadTemplate}
              className="text-sm px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors">
              ↓ Download Template
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-sm px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
            >
              {uploading ? 'Importing…' : '↑ Upload CSV'}
            </button>
            <button onClick={() => setPasteMode(p => !p)}
              className="text-sm px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 rounded-lg transition-colors">
              {pasteMode ? 'Cancel' : 'Paste CSV'}
            </button>
          </div>

          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFile} className="hidden" />

          {pasteMode && (
            <div className="space-y-2">
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder={CSV_TEMPLATE}
                rows={6}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-300 text-xs font-mono placeholder-slate-700 focus:outline-none focus:border-blue-500 resize-none"
              />
              <button
                onClick={() => importCSV(csvText)}
                disabled={uploading || !csvText.trim()}
                className="text-sm px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white rounded-lg transition-colors font-medium"
              >
                {uploading ? 'Importing…' : 'Import Pasted Data'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
