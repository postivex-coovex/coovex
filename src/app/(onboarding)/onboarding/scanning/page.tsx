'use client'

import { useEffect, useState } from 'react'
import { createInitialData } from '../actions'

const STEPS = [
  { label: 'Creating your workspace',         delay: 0    },
  { label: 'Analyzing your business profile', delay: 800  },
  { label: 'Running initial competitor scan', delay: 1600 },
  { label: 'Building AI agent context',       delay: 2400 },
  { label: 'Generating first recommendations',delay: 3000 },
]

export default function ScanningPage() {
  const [completed, setCompleted] = useState<number[]>([])
  const [active, setActive]       = useState(0)
  const [done, setDone]           = useState(false)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    STEPS.forEach((step, i) => {
      const t = setTimeout(() => {
        setActive(i)
        if (i > 0) setCompleted(prev => [...prev, i - 1])
      }, step.delay)
      timers.push(t)
    })

    timers.push(setTimeout(() => { setCompleted(prev => [...prev, STEPS.length - 1]); setDone(true) }, 3800))
    timers.push(setTimeout(async () => { await createInitialData() }, 4200))

    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="w-full max-w-2xl pt-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-10">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <div key={s} className={`h-1.5 rounded-full flex-1 transition-colors ${s <= 5 ? 'bg-blue-500' : 'bg-slate-200'}`} />
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 space-y-10 text-center">
        <div>
          <p className="text-blue-600 text-sm font-semibold mb-2">Step 5 of 6</p>
          <h1 className="text-2xl font-bold text-slate-900">
            {done ? 'Analysis complete!' : 'Setting up your AI agent...'}
          </h1>
          <p className="text-slate-500 mt-2 text-base">
            {done ? 'Your workspace is ready.' : 'This only takes a moment.'}
          </p>
        </div>

        {/* Progress ring */}
        <div className="flex justify-center">
          <div className="relative w-28 h-28">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 112 112">
              <circle cx="56" cy="56" r="48" fill="none" stroke="#e2e8f0" strokeWidth="6" />
              <circle
                cx="56" cy="56" r="48" fill="none"
                stroke={done ? '#059669' : '#7c3aed'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="301.6"
                strokeDashoffset={done ? 0 : 301.6 - (completed.length / STEPS.length) * 301.6}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {done ? (
                <span className="text-4xl">✅</span>
              ) : (
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>
        </div>

        {/* Step list */}
        <div className="space-y-4 text-left max-w-sm mx-auto">
          {STEPS.map((step, i) => {
            const isCompleted = completed.includes(i)
            const isActive    = active === i && !isCompleted

            return (
              <div
                key={i}
                className={`flex items-center gap-3 transition-opacity ${i > active && !isCompleted ? 'opacity-30' : 'opacity-100'}`}
              >
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">
                  {isCompleted ? (
                    <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isActive ? (
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                  ) : (
                    <div className="w-3 h-3 bg-slate-300 rounded-full" />
                  )}
                </div>
                <span className={`text-sm font-medium ${isCompleted ? 'text-slate-600' : isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
