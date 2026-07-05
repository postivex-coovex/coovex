'use client'

import { useState, useRef } from 'react'

interface Persona {
  name: string
  age: string
  role: string
  company_size: string
  industry: string
  location: string
  goals: string[]
  pain_points: string[]
  motivations: string[]
  objections: string[]
  buying_triggers: string[]
  preferred_channels: string[]
  budget: string
  decision_process: string
  summary: string
}

function buildExportHtml(persona: Persona): string {
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const list = (items: string[]) => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`
  return `<!DOCTYPE html><html><head><title>Customer Persona: ${persona.name}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 900px; margin: 40px auto; color: #1e293b; line-height: 1.6; }
  h1 { font-size: 22px; margin-bottom: 4px; } .date { color: #64748b; font-size: 13px; margin-bottom: 24px; }
  h2 { font-size: 14px; font-weight: bold; color: #4f46e5; margin-top: 20px; margin-bottom: 8px; }
  .header { background: #f8fafc; padding: 20px; border-radius: 8px; display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 24px; }
  .meta { font-size: 13px; color: #64748b; } .meta strong { color: #1e293b; display: block; }
  ul { margin: 0; padding-left: 20px; } li { font-size: 13px; margin-bottom: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .summary { background: #eff6ff; padding: 16px; border-radius: 8px; margin-top: 16px; font-size: 14px; }
  blockquote { border-left: 3px solid #e2e8f0; padding-left: 12px; color: #64748b; font-style: italic; margin: 6px 0; }
  @media print { body { margin: 20px; } }
</style></head><body>
<h1>${persona.name}</h1>
<p class="date">${date}</p>
<div class="header">
  <div class="meta"><strong>Role</strong>${persona.role}</div>
  <div class="meta"><strong>Age</strong>${persona.age}</div>
  <div class="meta"><strong>Company size</strong>${persona.company_size}</div>
  <div class="meta"><strong>Industry</strong>${persona.industry}</div>
  <div class="meta"><strong>Location</strong>${persona.location}</div>
  <div class="meta"><strong>Budget</strong>${persona.budget}</div>
</div>
<div class="grid">
  <div><h2>Goals</h2>${list(persona.goals)}</div>
  <div><h2>Pain Points</h2>${list(persona.pain_points)}</div>
  <div><h2>Motivations</h2>${list(persona.motivations)}</div>
  <div><h2>Preferred Channels</h2>${list(persona.preferred_channels)}</div>
</div>
<h2>Objections (in their words)</h2>
${persona.objections.map(o => `<blockquote>${o}</blockquote>`).join('')}
<h2>Buying Triggers</h2>${list(persona.buying_triggers)}
<h2>Decision Process</h2><p style="font-size:13px">${persona.decision_process}</p>
<div class="summary"><strong>Strategic Summary:</strong> ${persona.summary}</div>
</body></html>`
}

export default function PersonaPage() {
  const [generating, setGenerating] = useState(false)
  const [persona, setPersona] = useState<Persona | null>(null)
  const [copied, setCopied] = useState(false)
  const [exportHtml, setExportHtml] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  async function generate() {
    setGenerating(true)
    setPersona(null)
    try {
      const res = await fetch('/api/tools/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.persona) setPersona(data.persona)
    } finally {
      setGenerating(false)
    }
  }

  function copyText() {
    if (!persona) return
    navigator.clipboard.writeText(JSON.stringify(persona, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Customer Persona Builder</h1>
          <p className="text-slate-400 text-sm mt-0.5">AI-generated Ideal Customer Profile (ICP) based on your business data</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
          <p className="text-slate-500 text-sm mb-4">Uses your business profile, pipeline data, lead sources, and competitors automatically.</p>
          <button
            onClick={generate}
            disabled={generating}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {generating
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Building persona…</>
              : '✨ Generate ICP / Persona'}
          </button>
        </div>

        {persona && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">{persona.name}</h2>
              <div className="flex gap-2">
                <button onClick={copyText} className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors">
                  {copied ? '✓ Copied' : '📋 Copy JSON'}
                </button>
                <button onClick={() => setExportHtml(buildExportHtml(persona))} className="text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                  📄 Export PDF
                </button>
              </div>
            </div>

            {/* Header card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="w-14 h-14 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center text-2xl flex-shrink-0">
                  👤
                </div>
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-1">
                  {[
                    { label: 'Role', value: persona.role },
                    { label: 'Age', value: persona.age },
                    { label: 'Company size', value: persona.company_size },
                    { label: 'Industry', value: persona.industry },
                    { label: 'Location', value: persona.location },
                    { label: 'Budget', value: persona.budget },
                  ].map(m => (
                    <div key={m.label}>
                      <p className="text-slate-500 text-xs">{m.label}</p>
                      <p className="text-slate-200 text-sm">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {[
                { label: 'Goals', icon: '🎯', items: persona.goals, color: 'text-emerald-400', dot: 'bg-emerald-500' },
                { label: 'Pain Points', icon: '😤', items: persona.pain_points, color: 'text-red-400', dot: 'bg-red-500' },
                { label: 'Motivations', icon: '💡', items: persona.motivations, color: 'text-amber-400', dot: 'bg-amber-500' },
                { label: 'Preferred Channels', icon: '📡', items: persona.preferred_channels, color: 'text-blue-400', dot: 'bg-blue-500' },
              ].map(s => (
                <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-3">
                    <span>{s.icon}</span>
                    <h3 className={`text-xs font-semibold ${s.color}`}>{s.label}</h3>
                  </div>
                  <ul className="space-y-1.5">
                    {s.items.map((item, i) => (
                      <li key={i} className="flex gap-2 text-xs text-slate-300 leading-relaxed">
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot} flex-shrink-0 mt-1.5`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <span>💬</span>
                  <h3 className="text-xs font-semibold text-slate-300">Objections (their words)</h3>
                </div>
                <div className="space-y-2">
                  {persona.objections.map((o, i) => (
                    <div key={i} className="border-l-2 border-slate-700 pl-3">
                      <p className="text-slate-400 text-xs italic">{o}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <span>⚡</span>
                  <h3 className="text-xs font-semibold text-violet-300">Buying Triggers</h3>
                </div>
                <ul className="space-y-1.5">
                  {persona.buying_triggers.map((t, i) => (
                    <li key={i} className="flex gap-2 text-xs text-slate-300 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0 mt-1.5" />
                      {t}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-3 border-t border-slate-800">
                  <p className="text-slate-500 text-xs">Decision process:</p>
                  <p className="text-slate-300 text-xs mt-1">{persona.decision_process}</p>
                </div>
              </div>
            </div>

            <div className="bg-violet-950/20 border border-violet-800/30 rounded-xl p-5">
              <p className="text-violet-300 text-xs font-medium mb-2">🎯 Strategic Summary</p>
              <p className="text-slate-200 text-sm leading-relaxed">{persona.summary}</p>
            </div>
          </div>
        )}
      </div>

      {exportHtml && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800 flex-shrink-0">
            <span className="text-white font-medium text-sm">Customer Persona — Print / Save PDF</span>
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
          <iframe ref={iframeRef} srcDoc={exportHtml} className="flex-1 w-full border-0 bg-white" />
        </div>
      )}
    </>
  )
}
