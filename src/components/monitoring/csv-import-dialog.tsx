'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Upload, X, FileText, CheckCircle2, AlertCircle, ArrowRight, Download } from 'lucide-react'

interface ParsedRow {
  raw: string
  url: string
  name: string
  alert_emails: string
  valid: boolean
  error?: string
}

type Step = 'upload' | 'preview' | 'importing' | 'done'

interface ImportResult {
  url: string
  success: boolean
  error?: string
}

function normalizeUrlClient(raw: string): { url: string; valid: boolean; error?: string } {
  let u = raw.trim().replace(/^["']|["']$/g, '').trim()
  if (!u) return { url: '', valid: false, error: 'Empty URL' }
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`
  try {
    const parsed = new URL(u)
    if (!parsed.hostname.includes('.')) return { url: u, valid: false, error: 'Invalid domain' }
    return { url: u, valid: true }
  } catch {
    return { url: u, valid: false, error: 'Invalid URL format' }
  }
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)

  if (lines.length === 0) return []

  // Detect if first line is a header (contains "url" as first token)
  const firstLower = lines[0].toLowerCase()
  const hasHeader = firstLower.startsWith('url') || firstLower.startsWith('"url')
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines.map(line => {
    // Simple CSV split — handle quoted fields
    const cols = splitCsvLine(line)
    const rawUrl   = (cols[0] ?? '').trim().replace(/^["']|["']$/g, '').trim()
    const rawName  = (cols[1] ?? '').trim().replace(/^["']|["']$/g, '').trim()
    const rawEmail = (cols[2] ?? '').trim().replace(/^["']|["']$/g, '').trim()

    const { url, valid, error } = normalizeUrlClient(rawUrl)
    let hostname = rawUrl
    try { hostname = new URL(url).hostname } catch { /* keep */ }

    return {
      raw: rawUrl,
      url,
      name: rawName || hostname,
      alert_emails: rawEmail,
      valid,
      error,
    }
  })
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      result.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

const SAMPLE_CSV = `url,name,alert_emails
example.com,Example Site,alerts@example.com
https://myshop.com,My Shop,
www.blog.io`

export function CsvImportDialog() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [results, setResults] = useState<ImportResult[]>([])
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)

  const resetAndClose = () => {
    setOpen(false)
    setStep('upload')
    setRows([])
    setResults([])
    setFileName('')
  }

  const processText = useCallback((text: string, name: string) => {
    const parsed = parseCsv(text)
    if (parsed.length === 0) {
      toast.error('No URLs found in the file')
      return
    }
    setRows(parsed)
    setFileName(name)
    setStep('preview')
  }, [])

  const handleFile = useCallback((file: File) => {
    if (!file.name.match(/\.(csv|txt)$/i) && file.type !== 'text/csv' && file.type !== 'text/plain') {
      toast.error('Please upload a CSV or TXT file')
      return
    }
    const reader = new FileReader()
    reader.onload = e => processText(e.target?.result as string, file.name)
    reader.readAsText(file)
  }, [processText])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const validRows = rows.filter(r => r.valid)
  const invalidRows = rows.filter(r => !r.valid)

  async function runImport() {
    if (validRows.length === 0) return
    setImporting(true)
    setStep('importing')
    try {
      const res = await fetch('/api/monitoring/websites/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sites: validRows.map(r => ({
            url: r.url,
            name: r.name || undefined,
            alert_emails: r.alert_emails || undefined,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setResults(data.results ?? [])
      setStep('done')
      router.refresh()
    } catch (e: unknown) {
      toast.error((e as Error).message)
      setStep('preview')
    } finally {
      setImporting(false)
    }
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'coovex-monitor-sample.csv'
    a.click()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium rounded-lg transition-colors"
      >
        <Upload className="w-4 h-4" />
        Import CSV
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
              <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Import from CSV</h2>
              <p className="text-xs text-slate-500">
                {step === 'upload'    && 'Upload a CSV file with one URL per row'}
                {step === 'preview'   && `${rows.length} rows parsed · ${validRows.length} valid · ${invalidRows.length} invalid`}
                {step === 'importing' && 'Importing…'}
                {step === 'done'      && `Done — ${results.filter(r => r.success).length} added`}
              </p>
            </div>
          </div>
          <button onClick={resetAndClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">

          {/* ─── STEP: UPLOAD ─── */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  dragging
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Drop your CSV here or click to browse
                </p>
                <p className="text-xs text-slate-400">CSV or TXT · max 500 URLs</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
              </div>

              {/* Format guide */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Accepted formats</p>
                  <button
                    onClick={downloadSample}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Download className="w-3 h-3" />
                    Download sample
                  </button>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {[
                    { label: 'URL only',            example: 'example.com' },
                    { label: 'With www',             example: 'www.example.com' },
                    { label: 'Full URL',             example: 'https://example.com/path' },
                    { label: 'With name',            example: 'example.com,My Site' },
                    { label: 'With name + emails',   example: 'example.com,My Site,you@co.com' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 w-36 flex-shrink-0">{row.label}</span>
                      <code className="text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">{row.example}</code>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-t border-blue-100 dark:border-blue-900">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    http://, https://, www., or bare domain — all accepted automatically.
                    Optional header row (url,name,alert_emails) is auto-detected and skipped.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP: PREVIEW ─── */}
          {step === 'preview' && (
            <div className="space-y-4">
              {fileName && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <FileText className="w-3.5 h-3.5" />
                  <span>{fileName}</span>
                </div>
              )}

              {invalidRows.length > 0 && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    {invalidRows.length} invalid row{invalidRows.length !== 1 ? 's' : ''} will be skipped.
                    Only the {validRows.length} valid URL{validRows.length !== 1 ? 's' : ''} will be imported.
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <div className="col-span-1"></div>
                  <div className="col-span-5">URL</div>
                  <div className="col-span-3">Name</div>
                  <div className="col-span-3">Alert emails</div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                  {rows.map((row, i) => (
                    <div key={i} className={`grid grid-cols-12 gap-2 px-4 py-2.5 text-xs ${row.valid ? '' : 'bg-red-50/50 dark:bg-red-950/10'}`}>
                      <div className="col-span-1 flex items-center">
                        {row.valid
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          : <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                        }
                      </div>
                      <div className="col-span-5 truncate">
                        <span className={`font-mono ${row.valid ? 'text-slate-700 dark:text-slate-300' : 'text-red-500 dark:text-red-400'}`}>
                          {row.url || row.raw}
                        </span>
                        {row.error && <p className="text-red-400 text-[10px] mt-0.5">{row.error}</p>}
                      </div>
                      <div className="col-span-3 truncate text-slate-500">{row.name}</div>
                      <div className="col-span-3 truncate text-slate-400">{row.alert_emails || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-400">
                All imported sites will use default alert settings (down, SSL, domain, slow load alerts enabled).
              </p>
            </div>
          )}

          {/* ─── STEP: IMPORTING ─── */}
          {step === 'importing' && (
            <div className="py-12 text-center">
              <div className="w-12 h-12 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Importing {validRows.length} site{validRows.length !== 1 ? 's' : ''}…</p>
              <p className="text-xs text-slate-400 mt-1">This may take a moment</p>
            </div>
          )}

          {/* ─── STEP: DONE ─── */}
          {step === 'done' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 text-center">
                  <p className="text-2xl font-extrabold text-green-600">{results.filter(r => r.success).length}</p>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-1">Added successfully</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 text-center">
                  <p className="text-2xl font-extrabold text-slate-500">{results.filter(r => !r.success).length}</p>
                  <p className="text-xs text-slate-400 mt-1">Skipped / already monitored</p>
                </div>
              </div>

              {/* Detail list */}
              {results.filter(r => !r.success).length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-500">Skipped URLs</p>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
                    {results.filter(r => !r.success).map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-3">
                        <span className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate">{r.url}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0">{r.error ?? 'Skipped'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
          {step === 'upload' && (
            <button onClick={resetAndClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Cancel
            </button>
          )}

          {step === 'preview' && (
            <>
              <button onClick={() => setStep('upload')}
                className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Back
              </button>
              <button
                onClick={runImport}
                disabled={validRows.length === 0 || importing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                Import {validRows.length} site{validRows.length !== 1 ? 's' : ''}
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 'done' && (
            <>
              <button
                onClick={() => { setStep('upload'); setRows([]); setResults([]); setFileName('') }}
                className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Import more
              </button>
              <button onClick={resetAndClose}
                className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
