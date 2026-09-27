'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Globe, RefreshCw, Copy, Check, Eye, Archive,
  ChevronRight, ExternalLink, Key, BookOpen, X,
  CheckCircle, Clock, Inbox, RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Property {
  id: string
  domain: string
  label: string | null
  unread_count: number
  created_at: string
}

interface Submission {
  id: string
  email: string
  domain: string
  extra_fields: Record<string, unknown>
  is_read: boolean
  status: string
  source_url: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  new:      'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  reviewed: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  archived: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

// ── Integration Docs Panel ────────────────────────────────────────────────────
function DocsPanel({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const endpoint = 'https://app.coovex.com/api/inquiry/submit'
  const jsSnippet = `// JavaScript (fetch)
fetch('${endpoint}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    api_key: '${apiKey || 'YOUR_API_KEY'}',
    domain:  window.location.hostname,  // mandatory
    email:   formData.email,            // mandatory
    // any extra fields you want:
    name:    formData.name,
    message: formData.message,
    phone:   formData.phone,
  })
})`

  const htmlSnippet = `<!-- HTML Form (action + hidden inputs) -->
<form action="${endpoint}" method="POST">
  <input type="hidden" name="api_key" value="${apiKey || 'YOUR_API_KEY'}">
  <input type="hidden" name="domain"  value="yourwebsite.com">
  <input type="email"  name="email"   placeholder="Email" required>
  <input type="text"   name="name"    placeholder="Name">
  <textarea            name="message" placeholder="Message"></textarea>
  <button type="submit">Send</button>
</form>`

  const phpSnippet = `<?php
// PHP (cURL)
$data = [
  'api_key' => '${apiKey || 'YOUR_API_KEY'}',
  'domain'  => $_SERVER['HTTP_HOST'],
  'email'   => $_POST['email'],
  'name'    => $_POST['name'],
  'message' => $_POST['message'],
];
$ch = curl_init('${endpoint}');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$result = curl_exec($ch);
curl_close($ch);
?>`

  const [tab, setTab] = useState<'js' | 'html' | 'php'>('js')
  const snippets = { js: jsSnippet, html: htmlSnippet, php: phpSnippet }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-violet-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Integration Docs</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5 flex-1">
          {/* Endpoint */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Endpoint</p>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300">
              <span className="text-green-600 font-semibold">POST</span>
              <span className="flex-1 break-all">{endpoint}</span>
              <CopyButton value={endpoint} />
            </div>
          </div>

          {/* API Key */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Your API Key</p>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300">
              <span className="flex-1 break-all">{apiKey || 'Loading...'}</span>
              {apiKey && <CopyButton value={apiKey} />}
            </div>
          </div>

          {/* Fields */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Fields</p>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800">
                  <th className="text-left p-2 font-semibold text-slate-600 dark:text-slate-300 rounded-l-lg">Field</th>
                  <th className="text-left p-2 font-semibold text-slate-600 dark:text-slate-300">Type</th>
                  <th className="text-left p-2 font-semibold text-slate-600 dark:text-slate-300 rounded-r-lg">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[
                  ['api_key', 'string', 'Required — your CooVex API key'],
                  ['domain',  'string', 'Required — your website domain (auto-groups into a Property)'],
                  ['email',   'string', 'Required — submitter email address'],
                  ['*',       'any',    'Any other field is accepted and shown as a dynamic column'],
                ].map(([f, t, n]) => (
                  <tr key={f} className="text-slate-700 dark:text-slate-300">
                    <td className="p-2 font-mono">{f === '*' ? <span className="italic text-slate-400">any field</span> : f}</td>
                    <td className="p-2 text-slate-500">{t}</td>
                    <td className="p-2">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Code examples */}
          <div>
            <div className="flex gap-2 mb-2">
              {(['js', 'html', 'php'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-full transition-colors',
                    tab === t
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  )}
                >
                  {t === 'js' ? 'JavaScript' : t === 'html' ? 'HTML Form' : 'PHP'}
                </button>
              ))}
            </div>
            <div className="relative">
              <pre className="bg-slate-900 text-slate-200 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {snippets[tab]}
              </pre>
              <CopyButton value={snippets[tab]} />
            </div>
          </div>

          {/* Response */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Response</p>
            <pre className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-xs text-slate-700 dark:text-slate-300">
{`// Success
{ "ok": true, "id": "uuid" }

// Error
{ "error": "email is required" }`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export function InquiryManagerClient() {
  const [properties, setProperties]     = useState<Property[]>([])
  const [selectedProp, setSelectedProp] = useState<Property | null>(null)
  const [submissions, setSubmissions]   = useState<Submission[]>([])
  const [dynCols, setDynCols]           = useState<string[]>([])
  const [apiKey, setApiKey]             = useState('')
  const [loading, setLoading]           = useState(true)
  const [loadingSubs, setLoadingSubs]   = useState(false)
  const [showDocs, setShowDocs]         = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedSub, setSelectedSub]  = useState<Submission | null>(null)

  // Fetch API key + properties on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/inquiry/api-key').then(r => r.json()),
      fetch('/api/inquiry/properties').then(r => r.json()),
    ]).then(([keyData, propData]) => {
      setApiKey(keyData.api_key || '')
      const props = propData.properties || []
      setProperties(props)
      if (props.length > 0) setSelectedProp(props[0])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const loadSubmissions = useCallback(async (propId: string, status = '') => {
    setLoadingSubs(true)
    const url = `/api/inquiry/submissions?property_id=${propId}${status ? `&status=${status}` : ''}`
    const res = await fetch(url).then(r => r.json())
    setSubmissions(res.submissions || [])
    setDynCols(res.dynamic_columns || [])
    setLoadingSubs(false)
  }, [])

  useEffect(() => {
    if (selectedProp) {
      loadSubmissions(selectedProp.id, statusFilter)
      setSelectedSub(null)
    }
  }, [selectedProp, statusFilter, loadSubmissions])

  async function updateSubmission(id: string, patch: Partial<Submission>) {
    await fetch('/api/inquiry/submissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
    if (selectedSub?.id === id) setSelectedSub(prev => prev ? { ...prev, ...patch } : null)
  }

  async function regenerateKey() {
    if (!confirm('Regenerate API key? All integrations will need updating.')) return
    const res = await fetch('/api/inquiry/api-key', { method: 'POST' }).then(r => r.json())
    setApiKey(res.api_key || '')
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...
      </div>
    )
  }

  return (
    <>
      {showDocs && <DocsPanel apiKey={apiKey} onClose={() => setShowDocs(false)} />}

      <div className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Inquiry Manager</h1>
            <p className="text-xs text-slate-500">Collect form submissions from any website via API</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-600 dark:text-slate-300 max-w-xs">
              <Key className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="truncate">{apiKey || 'Loading...'}</span>
              {apiKey && <CopyButton value={apiKey} />}
            </div>
            <button
              onClick={regenerateKey}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Regenerate API key"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDocs(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" /> Integration Docs
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left — Properties list */}
          <div className="w-56 flex-shrink-0 border-r border-slate-100 dark:border-slate-800 overflow-y-auto">
            <div className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              Domains
            </div>
            {properties.length === 0 ? (
              <div className="p-4 text-xs text-slate-400 text-center">
                No inquiries yet.<br />
                <button onClick={() => setShowDocs(true)} className="text-violet-500 hover:underline mt-1">
                  See integration docs
                </button>
              </div>
            ) : properties.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProp(p)}
                className={cn(
                  'w-full text-left px-3 py-3 border-b border-slate-50 dark:border-slate-800/60 flex items-center gap-2 transition-colors',
                  selectedProp?.id === p.id
                    ? 'bg-violet-50 dark:bg-violet-950/30 border-l-2 border-l-violet-500'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                )}
              >
                <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{p.domain}</div>
                  {p.label && <div className="text-[10px] text-slate-400 truncate">{p.label}</div>}
                </div>
                {p.unread_count > 0 && (
                  <span className="bg-violet-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                    {p.unread_count > 9 ? '9+' : p.unread_count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Right — Submissions table */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedProp ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Inbox className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Select a domain to view submissions</p>
              </div>
            ) : (
              <>
                {/* Table toolbar */}
                <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{selectedProp.domain}</span>
                  <div className="flex gap-1 ml-auto">
                    {['', 'new', 'reviewed', 'archived'].map(s => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={cn(
                          'px-2.5 py-1 text-xs rounded-full font-medium transition-colors',
                          statusFilter === s
                            ? 'bg-violet-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        )}
                      >
                        {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                    <button
                      onClick={() => selectedProp && loadSubmissions(selectedProp.id, statusFilter)}
                      className="ml-1 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <RefreshCw className={cn('w-4 h-4', loadingSubs && 'animate-spin')} />
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                  {loadingSubs ? (
                    <div className="flex items-center justify-center h-32 text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...
                    </div>
                  ) : submissions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                      <Inbox className="w-8 h-8 mb-2 opacity-30" />
                      <p className="text-sm">No submissions yet</p>
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <th className="text-left p-3 font-semibold text-slate-500 whitespace-nowrap">Email</th>
                          {dynCols.map(col => (
                            <th key={col} className="text-left p-3 font-semibold text-slate-500 whitespace-nowrap capitalize">{col}</th>
                          ))}
                          <th className="text-left p-3 font-semibold text-slate-500 whitespace-nowrap">Status</th>
                          <th className="text-left p-3 font-semibold text-slate-500 whitespace-nowrap">Received</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                        {submissions.map(sub => (
                          <tr
                            key={sub.id}
                            className={cn(
                              'hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors',
                              !sub.is_read && 'bg-violet-50/40 dark:bg-violet-950/10'
                            )}
                            onClick={() => { setSelectedSub(sub); if (!sub.is_read) updateSubmission(sub.id, { is_read: true }) }}
                          >
                            <td className="p-3 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                {!sub.is_read && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />}
                                {sub.email}
                              </div>
                            </td>
                            {dynCols.map(col => (
                              <td key={col} className="p-3 text-slate-600 dark:text-slate-400 max-w-[160px] truncate">
                                {sub.extra_fields?.[col] != null ? String(sub.extra_fields[col]) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                              </td>
                            ))}
                            <td className="p-3">
                              <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', STATUS_COLORS[sub.status] || STATUS_COLORS.new)}>
                                {sub.status}
                              </span>
                            </td>
                            <td className="p-3 text-slate-400 whitespace-nowrap">{timeAgo(sub.created_at)}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                                {sub.status !== 'reviewed' && (
                                  <button
                                    onClick={() => updateSubmission(sub.id, { status: 'reviewed' })}
                                    className="p-1 rounded text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors"
                                    title="Mark reviewed"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {sub.status !== 'archived' && (
                                  <button
                                    onClick={() => updateSubmission(sub.id, { status: 'archived' })}
                                    className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    title="Archive"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Detail side panel */}
          {selectedSub && (
            <div className="w-72 flex-shrink-0 border-l border-slate-100 dark:border-slate-800 overflow-y-auto">
              <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Detail</span>
                <button onClick={() => setSelectedSub(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                {/* Status actions */}
                <div className="flex gap-1.5">
                  {['new', 'reviewed', 'archived'].map(s => (
                    <button
                      key={s}
                      onClick={() => updateSubmission(selectedSub.id, { status: s })}
                      className={cn(
                        'flex-1 py-1 text-[10px] font-semibold rounded-full transition-colors capitalize',
                        selectedSub.status === s
                          ? STATUS_COLORS[s]
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {/* All fields */}
                <div className="space-y-2">
                  {[
                    { label: 'Email', value: selectedSub.email },
                    { label: 'Domain', value: selectedSub.domain },
                    { label: 'Received', value: new Date(selectedSub.created_at).toLocaleString() },
                    ...(selectedSub.source_url ? [{ label: 'Source URL', value: selectedSub.source_url }] : []),
                    ...Object.entries(selectedSub.extra_fields || {}).map(([k, v]) => ({ label: k, value: String(v) })),
                  ].map(({ label, value }) => (
                    <div key={label} className="space-y-0.5">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</div>
                      <div className="text-xs text-slate-700 dark:text-slate-300 break-all flex items-start gap-1">
                        <span className="flex-1">{value}</span>
                        {label === 'Source URL' && (
                          <a href={value} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-violet-500 flex-shrink-0 mt-0.5">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
