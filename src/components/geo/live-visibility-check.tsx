'use client'

import { useState } from 'react'
import type { GeoIntelligence } from '@/types/geo'

type GeoFlags = { structured_data?: boolean; llms_txt?: boolean } | null

export function LiveVisibilityCheck({
  visibility,
  geo,
}: {
  visibility: NonNullable<GeoIntelligence['actual_ai_visibility']>
  geo: GeoFlags
}) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const rate = visibility.visibility_rate
  const rateColor = rate >= 60 ? 'text-blue-400' : rate >= 30 ? 'text-slate-500' : 'text-red-400'
  const rateRing  = rate >= 60 ? '#2563eb'         : rate >= 30 ? '#64748b'         : '#ef4444'

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          ✨ Live AI Visibility Check
          <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
            Gemini Search
          </span>
        </h3>
        <span className="text-xs text-slate-500">
          Checked {new Date(visibility.checked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Real Gemini searches to verify whether your business is mentioned in AI responses today.
      </p>

      <div className="flex items-center gap-6 mb-5">
        <div className="relative flex-shrink-0">
          <svg width={80} height={80} viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={40} cy={40} r={31} fill="none" stroke="#1e293b" strokeWidth="10" />
            <circle cx={40} cy={40} r={31} fill="none" stroke={rateRing} strokeWidth="10"
              strokeDasharray={`${(rate / 100) * 2 * Math.PI * 31} ${2 * Math.PI * 31}`}
              strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-xl font-bold ${rateColor}`}>{rate}%</span>
          </div>
        </div>
        <div>
          <p className={`text-base font-semibold ${rateColor}`}>
            {rate >= 60 ? 'Visible in AI searches' : rate >= 30 ? 'Partially visible' : 'Not yet visible'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Found in {visibility.checks.filter(c => c.found).length} of {visibility.checks.length} test searches
          </p>
          <p className="text-[11px] text-slate-600 mt-1">
            {rate >= 60
              ? 'AI assistants can find your business in relevant searches.'
              : rate >= 30
              ? 'AI recognizes you in some searches — improve content coverage to appear in more.'
              : 'AI searches return competitors but not you. Act on the content gaps above.'}
          </p>
        </div>
      </div>

      {rate < 60 && (() => {
        const steps = [
          {
            id: 'content', done: false, urgent: true,
            title: 'Publish AI-optimized content on your website',
            desc: 'Write comparison articles, FAQs, case studies, and how-to guides. AI assistants crawl and cite your pages when answering relevant queries.',
          },
          {
            id: 'jsonld', done: geo?.structured_data === true, urgent: false,
            title: 'Add JSON-LD structured data to your website',
            desc: "Schema markup tells AI engines who you are and what you do. Use the GEO Optimizer → Generators tab → paste into your site's <head>.",
          },
          {
            id: 'llms', done: geo?.llms_txt === true, urgent: false,
            title: 'Create /llms.txt on your website',
            desc: 'Tells AI models (Perplexity, ChatGPT, Gemini, Claude) about your business. Use the GEO Optimizer → Generators tab to create and upload.',
          },
          {
            id: 'external', done: false, urgent: false,
            title: 'Get mentioned on external websites',
            desc: 'AI cites sources across the web. Get listed on G2, Capterra, Product Hunt, or mentioned in third-party blog posts.',
          },
        ].filter(s => !s.done)

        if (!steps.length) return null
        return (
          <div className="mb-4 bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <p className="text-xs font-semibold text-white mb-3">🚀 How to get mentioned by AI</p>
            <div className="space-y-3">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-start gap-3">
                  <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                    s.urgent ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
                  }`}>{i + 1}</span>
                  <div>
                    <p className={`text-xs font-semibold mb-0.5 ${s.urgent ? 'text-blue-300' : 'text-slate-300'}`}>{s.title}</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-600 mt-3 pt-3 border-t border-slate-700/50">
              After publishing content, re-run the GEO Intelligence scan to re-check your visibility score.
            </p>
          </div>
        )
      })()}

      <div className="space-y-2">
        {visibility.checks.map((check, i) => (
          <div key={i} className={`rounded-xl border transition-colors ${
            check.found ? 'bg-slate-950/15 border-slate-700/30' : 'bg-slate-800/40 border-slate-700/50'
          }`}>
            <button
              className="w-full flex items-start gap-3 p-3.5 text-left"
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <span className={`flex-shrink-0 mt-0.5 text-base ${check.found ? 'text-blue-400' : 'text-red-400'}`}>
                {check.found ? '✅' : '❌'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 mb-0.5">Searched in Gemini:</p>
                <p className="text-sm text-slate-100 font-medium leading-snug truncate">&ldquo;{check.query}&rdquo;</p>
                <p className={`text-[11px] mt-1 font-semibold ${check.found ? 'text-blue-400' : 'text-red-400'}`}>
                  {check.found ? 'Your business was mentioned' : 'Not mentioned in response'}
                </p>
              </div>
              <span className="text-slate-500 flex-shrink-0 text-xs">{expanded === i ? '▲' : '▼'}</span>
            </button>

            {expanded === i && (
              <div className="px-4 pb-4 space-y-3 border-t border-slate-700/40 pt-3">
                {check.response_snippet && check.response_snippet !== 'Search unavailable' && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">What Gemini said:</p>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-3 rounded-lg border border-slate-700/30">
                      {check.response_snippet}{check.response_snippet.length >= 499 ? '…' : ''}
                    </p>
                  </div>
                )}
                {(check.search_queries?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Google queries used:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {check.search_queries!.map((q, j) => (
                        <span key={j} className="text-[10px] px-2 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          🔍 {q}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {check.sources.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Sources Gemini cited:</p>
                    <div className="space-y-1">
                      {check.sources.map((src, j) => (
                        <a key={j} href={src} target="_blank" rel="noopener noreferrer"
                          className="block text-[11px] text-blue-400 hover:text-blue-300 truncate transition-colors">
                          {src}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
