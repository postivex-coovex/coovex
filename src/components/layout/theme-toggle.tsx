'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const isDark = theme === 'dark'
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors w-full text-slate-400 hover:text-slate-200 hover:bg-slate-800"
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark
        ? <Sun  className="w-4 h-4 flex-shrink-0 text-amber-400" />
        : <Moon className="w-4 h-4 flex-shrink-0 text-violet-400" />}
      <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
    </button>
  )
}
