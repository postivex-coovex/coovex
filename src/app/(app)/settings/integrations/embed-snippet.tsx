'use client'

import { useState } from 'react'

export default function EmbedSnippet({ token, appUrl }: { token: string; appUrl: string }) {
  const [copied, setCopied] = useState(false)

  const snippet = `<script src="${appUrl}/api/embed/${token}" async></script>`

  function copy() {
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      <p className="text-slate-400 text-sm">Paste this snippet before the closing <code className="text-violet-400">&lt;/body&gt;</code> tag on your website:</p>
      <div className="relative">
        <pre className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-emerald-400 overflow-x-auto whitespace-pre-wrap break-all font-mono">
          {snippet}
        </pre>
        <button
          onClick={copy}
          className={`absolute top-3 right-3 text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
            copied ? 'bg-emerald-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
        >
          {copied ? '✓ Copied!' : 'Copy'}
        </button>
      </div>
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-xs text-slate-400 space-y-1.5">
        <p className="font-medium text-slate-300">What it does:</p>
        <p>→ Adds a floating chat button to your website</p>
        <p>→ Captures visitor name + email into your CooVex CRM</p>
        <p>→ Deduplicates automatically (same email = no duplicate lead)</p>
        <p>→ Works on any website — WordPress, Webflow, Wix, custom HTML</p>
      </div>
    </div>
  )
}
