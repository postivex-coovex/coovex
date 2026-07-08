'use client'

import { Bell, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface AppHeaderProps {
  user: { name?: string } | null
}

export function AppHeader({ user }: AppHeaderProps) {
  const [greeting, setGreeting] = useState('Good morning')
  const [credits, setCredits] = useState<{ balance: number; monthly: number; business_used: number } | null>(null)

  const fetchBalance = () => {
    fetch('/api/credits/balance', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setCredits({ balance: d.balance, monthly: d.monthly, business_used: d.business_used ?? 0 }))
      .catch(() => {})
  }

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
    fetchBalance()
    // Fallback poll every 60s (interceptor handles instant updates)
    const interval = setInterval(fetchBalance, 60_000)

    // Instant update — if detail.balance provided, update directly without re-fetching
    const onCreditsChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ balance?: number }>).detail
      if (detail?.balance !== undefined) {
        setCredits(prev => prev ? { ...prev, balance: detail.balance! } : null)
      } else {
        fetchBalance()
      }
    }
    window.addEventListener('coovex:credits-changed', onCreditsChanged)
    return () => {
      clearInterval(interval)
      window.removeEventListener('coovex:credits-changed', onCreditsChanged)
    }
  }, [])

  const pct = credits ? Math.min(100, Math.round((credits.balance / Math.max(credits.monthly, 1)) * 100)) : null
  const creditColor = pct === null ? 'text-slate-400' : pct > 50 ? 'text-emerald-400' : pct > 20 ? 'text-amber-400' : 'text-red-400'

  return (
    <header className="hidden md:flex h-16 items-center justify-between px-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex-shrink-0">
      <div>
        <p className="text-slate-400 text-sm">{greeting}, <span className="text-white font-medium">{user?.name?.split(' ')[0] ?? 'there'}</span></p>
        <p className="text-xs text-slate-600">Your agent has been working while you were away.</p>
      </div>
      <div className="flex items-center gap-2">
        {/* AI Credit indicator — balance is account-wide; business_used shows this business's spend */}
        <Link
          href="/settings/billing"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 group"
          title={credits ? `This business used ${credits.business_used} credits` : 'AI Credits — click to manage'}
        >
          <Zap className={`w-3.5 h-3.5 ${creditColor}`} />
          {credits !== null ? (
            <>
              <span className={`text-xs font-bold ${creditColor}`}>{credits.balance.toLocaleString()}</span>
              <span className="text-slate-600 text-xs">credits</span>
              {credits.business_used > 0 && (
                <span className="text-slate-600 text-xs hidden lg:inline">
                  · <span className="text-slate-500">{credits.business_used.toLocaleString()} used here</span>
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-500 text-xs">credits</span>
          )}
        </Link>

        <Button variant="ghost" size="icon" className="relative text-slate-400 hover:text-white hover:bg-slate-800">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-violet-500 rounded-full" />
        </Button>

        <Link
          href="/settings"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <span>{user?.name?.split(' ')[0] ?? 'Settings'}</span>
        </Link>
      </div>
    </header>
  )
}
