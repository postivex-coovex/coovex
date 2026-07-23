'use client'

import { useState, useRef } from 'react'

interface Slide {
  title: string
  content: string
  notes: string
}

function buildExportHtml(slides: Slide[], showNotes: boolean): string {
  return `<!DOCTYPE html><html><head><title>Pitch Deck</title>
<style>
  body { font-family: Arial, sans-serif; margin: 0; background: #0f172a; color: white; }
  .slide { width: 100%; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; padding: 60px 80px; box-sizing: border-box; page-break-after: always; }
  .slide-num { font-size: 12px; color: #64748b; margin-bottom: 20px; }
  h1 { font-size: 42px; color: #60a5fa; margin-bottom: 24px; font-weight: bold; }
  .content { font-size: 20px; line-height: 1.8; color: #e2e8f0; white-space: pre-wrap; }
  .notes { margin-top: 32px; padding: 16px; background: rgba(255,255,255,0.05); border-radius: 8px; font-size: 14px; color: #94a3b8; }
  @media print { .slide { page-break-after: always; } }
</style></head><body>
${slides.map((s, i) => `
  <div class="slide">
    <div class="slide-num">${i + 1} / ${slides.length}</div>
    <h1>${s.title}</h1>
    <div class="content">${s.content.replace(/•/g, '→')}</div>
    ${showNotes ? `<div class="notes">📝 Speaker Notes: ${s.notes}</div>` : ''}
  </div>
`).join('')}
</body></html>`
}

export default function PitchDeckPage() {
  const [form, setForm] = useState({ raise_amount: '', valuation: '' })
  const [generating, setGenerating] = useState(false)
  const [slides, setSlides] = useState<Slide[]>([])
  const [activeSlide, setActiveSlide] = useState(0)
  const [showNotes, setShowNotes] = useState(false)
  const [exportHtml, setExportHtml] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function generate(e: React.FormEvent) {
    e.preventDefault()
    setGenerating(true)
    setSlides([])
    setActiveSlide(0)
    try {
      const res = await fetch('/api/tools/pitch-deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.slides) setSlides(data.slides)
    } finally {
      setGenerating(false)
    }
  }

  const current = slides[activeSlide]

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">AI Pitch Deck Generator</h1>
          <p className="text-slate-400 text-sm mt-0.5">10-slide investor deck tailored to your business data</p>
        </div>

        {slides.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4">Investment Details</h2>
            <form onSubmit={generate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Raising Amount <span className="text-slate-600">(optional)</span></label>
                  <input value={form.raise_amount} onChange={set('raise_amount')} placeholder="e.g. $500,000"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Pre-money Valuation <span className="text-slate-600">(optional)</span></label>
                  <input value={form.valuation} onChange={set('valuation')} placeholder="e.g. $3,000,000"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
              </div>
              <p className="text-slate-600 text-xs">Business profile, traction, pipeline, and competitors are included automatically.</p>
              <button type="submit" disabled={generating}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                {generating
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Building your pitch deck…</>
                  : '✨ Generate Pitch Deck'}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setSlides([]); setActiveSlide(0) }}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  ← Regenerate
                </button>
                <span className="text-slate-700 text-xs">|</span>
                <span className="text-slate-400 text-xs">{slides.length} slides ready</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowNotes(!showNotes)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${showNotes ? 'border-blue-500/50 bg-blue-600/20 text-blue-300' : 'border-slate-700 text-slate-400 hover:text-slate-300'}`}
                >
                  📝 Speaker Notes
                </button>
                <button
                  onClick={() => setExportHtml(buildExportHtml(slides, showNotes))}
                  className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  📄 Export PDF
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Slide nav */}
              <div className="space-y-1.5">
                {slides.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveSlide(i)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      activeSlide === i
                        ? 'bg-blue-600/20 border border-blue-500/30 text-blue-300'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-slate-600 mr-2">{i + 1}</span>
                    {s.title}
                  </button>
                ))}
              </div>

              {/* Slide view */}
              {current && (
                <div className="lg:col-span-3">
                  <div className="bg-gradient-to-br from-slate-900 via-slate-950/20 to-slate-900 border border-slate-700/30 rounded-2xl p-10 min-h-72 flex flex-col justify-center">
                    <p className="text-blue-400/60 text-xs mb-3">{activeSlide + 1} / {slides.length}</p>
                    <h2 className="text-white text-3xl font-bold mb-6">{current.title}</h2>
                    <p className="text-slate-200 text-base leading-relaxed whitespace-pre-wrap">{current.content}</p>
                  </div>

                  {showNotes && (
                    <div className="mt-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <p className="text-slate-500 text-xs font-medium mb-1.5">📝 Speaker Notes</p>
                      <p className="text-slate-300 text-sm">{current.notes}</p>
                    </div>
                  )}

                  <div className="flex justify-between mt-4">
                    <button
                      onClick={() => setActiveSlide(i => Math.max(0, i - 1))}
                      disabled={activeSlide === 0}
                      className="text-sm text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
                    >
                      ← Previous
                    </button>
                    <button
                      onClick={() => setActiveSlide(i => Math.min(slides.length - 1, i + 1))}
                      disabled={activeSlide === slides.length - 1}
                      className="text-sm text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {exportHtml && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800 flex-shrink-0">
            <span className="text-white font-medium text-sm">Pitch Deck — Print / Save PDF</span>
            <div className="flex gap-2">
              <button
                onClick={() => iframeRef.current?.contentWindow?.print()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
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
          <iframe ref={iframeRef} srcDoc={exportHtml} className="flex-1 w-full border-0" />
        </div>
      )}
    </>
  )
}
