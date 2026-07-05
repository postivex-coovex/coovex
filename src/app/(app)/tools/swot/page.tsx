'use client'

import { useState, useRef } from 'react'

interface SwotResult {
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
  summary: string
}

const QUADRANTS = [
  { key: 'strengths',     label: 'Strengths',      icon: '💪', color: 'border-emerald-800/50 bg-emerald-950/20', textColor: 'text-emerald-400', dotColor: 'bg-emerald-500' },
  { key: 'weaknesses',    label: 'Weaknesses',      icon: '⚠️', color: 'border-amber-800/50 bg-amber-950/20',   textColor: 'text-amber-400',   dotColor: 'bg-amber-500' },
  { key: 'opportunities', label: 'Opportunities',   icon: '🚀', color: 'border-blue-800/50 bg-blue-950/20',     textColor: 'text-blue-400',    dotColor: 'bg-blue-500' },
  { key: 'threats',       label: 'Threats',         icon: '🛡️', color: 'border-red-800/50 bg-red-950/20',       textColor: 'text-red-400',     dotColor: 'bg-red-500' },
] as const

function buildExportHtml(result: SwotResult): string {
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const li = (s: string) => `<li>${s}</li>`
  return `<!DOCTYPE html><html><head><title>SWOT Analysis</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 900px; margin: 40px auto; color: #1e293b; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  .date { color: #64748b; font-size: 13px; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .quadrant { padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
  .s { background: #f0fdf4; } .w { background: #fffbeb; }
  .o { background: #eff6ff; } .t { background: #fef2f2; }
  h2 { font-size: 14px; font-weight: bold; margin-bottom: 10px; }
  ul { margin: 0; padding-left: 16px; }
  li { font-size: 13px; margin-bottom: 6px; line-height: 1.5; }
  .summary { background: #f8fafc; padding: 16px; border-radius: 8px; font-size: 14px; line-height: 1.7; }
  @media print { body { margin: 20px; } }
</style></head><body>
<h1>SWOT Analysis</h1>
<p class="date">${date}</p>
<div class="grid">
  <div class="quadrant s"><h2>💪 Strengths</h2><ul>${result.strengths.map(li).join('')}</ul></div>
  <div class="quadrant w"><h2>⚠️ Weaknesses</h2><ul>${result.weaknesses.map(li).join('')}</ul></div>
  <div class="quadrant o"><h2>🚀 Opportunities</h2><ul>${result.opportunities.map(li).join('')}</ul></div>
  <div class="quadrant t"><h2>🛡️ Threats</h2><ul>${result.threats.map(li).join('')}</ul></div>
</div>
<div class="summary"><strong>Strategic Summary:</strong> ${result.summary}</div>
</body></html>`
}

export default function SwotPage() {
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<SwotResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [exportHtml, setExportHtml] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  async function generate() {
    setGenerating(true)
    setResult(null)
    try {
      const res = await fetch('/api/tools/swot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.swot) setResult(data.swot)
    } finally {
      setGenerating(false)
    }
  }

  function openExport() {
    if (!result) return
    setExportHtml(buildExportHtml(result))
  }

  function copyText() {
    if (!result) return
    const text = [
      'SWOT ANALYSIS',
      '',
      'STRENGTHS',
      ...result.strengths.map(s => `• ${s}`),
      '',
      'WEAKNESSES',
      ...result.weaknesses.map(s => `• ${s}`),
      '',
      'OPPORTUNITIES',
      ...result.opportunities.map(s => `• ${s}`),
      '',
      'THREATS',
      ...result.threats.map(s => `• ${s}`),
      '',
      'STRATEGIC SUMMARY',
      result.summary,
    ].join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">AI SWOT Analysis</h1>
          <p className="text-slate-400 text-sm mt-0.5">Instant strengths, weaknesses, opportunities, and threats for your business</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
          <p className="text-slate-500 text-sm mb-4">Uses your business profile, pipeline data, goals, and competitors automatically.</p>
          <button
            onClick={generate}
            disabled={generating}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {generating
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing your business…</>
              : '✨ Generate SWOT Analysis'}
          </button>
        </div>

        {result && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Analysis Results</h2>
              <div className="flex gap-2">
                <button onClick={copyText} className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors">
                  {copied ? '✓ Copied' : '📋 Copy'}
                </button>
                <button onClick={openExport} className="text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                  📄 Export PDF
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {QUADRANTS.map(q => {
                const items = result[q.key]
                return (
                  <div key={q.key} className={`border rounded-xl p-5 ${q.color}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span>{q.icon}</span>
                      <h3 className={`text-sm font-semibold ${q.textColor}`}>{q.label}</h3>
                    </div>
                    <ul className="space-y-2">
                      {items.map((item, i) => (
                        <li key={i} className="flex gap-2 text-xs text-slate-300 leading-relaxed">
                          <span className={`w-1.5 h-1.5 rounded-full ${q.dotColor} flex-shrink-0 mt-1.5`} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
              <p className="text-violet-300 text-xs font-medium mb-2">🎯 Strategic Summary</p>
              <p className="text-slate-200 text-sm leading-relaxed">{result.summary}</p>
            </div>
          </div>
        )}
      </div>

      {exportHtml && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800 flex-shrink-0">
            <span className="text-white font-medium text-sm">SWOT Analysis — Print / Save PDF</span>
            <div className="flex gap-2">
              <button
                onClick={() => iframeRef.current?.contentWindow?.print()}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
              >
                🖨️ Print / Save PDF
              </button>
              <button
                onClick={() => setExportHtml(null)}
                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 text-sm px-4 py-1.5 rounded-lg transition-colors"
              >
                ✕ Close
              </button>
            </div>
          </div>
          <iframe
            ref={iframeRef}
            srcDoc={exportHtml}
            className="flex-1 w-full border-0 bg-white"
          />
        </div>
      )}
    </>
  )
}
