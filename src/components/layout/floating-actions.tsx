'use client'

import { useState, useEffect } from 'react'

export function FloatingActions({ hasCoachHistory }: { hasCoachHistory?: boolean }) {
  const [visible, setVisible] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem('coovex:actions-visible')
      if (stored !== null) setVisible(stored === 'true')
    } catch {}
  }, [])

  if (!mounted) return null

  const toggle = () => {
    setVisible(v => {
      const next = !v
      try { localStorage.setItem('coovex:actions-visible', String(next)) } catch {}
      return next
    })
  }

  return (
    <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center select-none">
      {/* Buttons — slide in/out */}
      <div
        className={`flex flex-col gap-2 transition-all duration-300 ${
          visible ? 'opacity-100 w-auto pointer-events-auto' : 'opacity-0 w-0 pointer-events-none overflow-hidden'
        }`}
      >
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('coovex:open-integration'))}
          className="flex items-center gap-2 pl-4 pr-3 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-l-xl shadow-xl whitespace-nowrap transition-colors"
        >
          <span>🔧</span>
          <span>Setup & Integration</span>
        </button>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('coovex:toggle-coach'))}
          className="flex items-center gap-2 pl-4 pr-3 py-2.5 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-xs font-semibold rounded-l-xl shadow-xl whitespace-nowrap transition-colors"
        >
          <span>🧠</span>
          <span>AI Coach</span>
          {hasCoachHistory && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
        </button>
      </div>

      {/* Toggle tab — always visible */}
      <button
        onClick={toggle}
        title={visible ? 'Hide actions' : 'Show actions'}
        className="flex flex-col items-center justify-center gap-1.5 py-5 px-1.5 bg-slate-800/90 hover:bg-slate-700 border border-r-0 border-slate-700 rounded-l-lg shadow-lg transition-colors backdrop-blur-sm"
      >
        <span className="text-[10px] text-slate-400 leading-none">{visible ? '▶' : '◀'}</span>
        {!visible && (
          <>
            <span className="text-[11px] leading-none">🔧</span>
            <span className="text-[11px] leading-none">🧠</span>
          </>
        )}
      </button>
    </div>
  )
}
