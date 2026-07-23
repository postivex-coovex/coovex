'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'

export function LandingThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const isDark = theme === 'dark'
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors"
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark
        ? <Sun  className="w-4 h-4 text-slate-500" />
        : <Moon className="w-4 h-4 text-blue-500" />}
    </button>
  )
}
