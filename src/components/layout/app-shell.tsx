'use client'

import { useState, useEffect, useRef } from 'react'
import { Menu } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { AppSidebar } from './app-sidebar'
import { CommandPalette } from './command-palette'
import { CoachWidget } from './coach-widget'
import { IntegrationServiceWidget } from './integration-service-widget'
import { BrandLogo } from './brand-logo'
import { BusinessOnboardingModal } from './business-onboarding-modal'

interface AppShellProps {
  user: { name?: string; email?: string } | null
  currentBusinessName?: string
  onboardingRequired?: boolean
  children: React.ReactNode
}

export function AppShell({ user, currentBusinessName = 'My Business', onboardingRequired = false, children }: AppShellProps) {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(onboardingRequired)
  const origFetchRef = useRef<typeof window.fetch | null>(null)

  // Global fetch interceptor — reads X-Credits-Remaining from any API response
  // and instantly updates the credit display without an extra round-trip
  useEffect(() => {
    if (origFetchRef.current) return // already patched
    origFetchRef.current = window.fetch.bind(window)
    const orig = origFetchRef.current

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await orig(...args)
      try {
        const remaining = response.headers.get('X-Credits-Remaining')
        if (remaining !== null && !isNaN(Number(remaining))) {
          window.dispatchEvent(
            new CustomEvent('coovex:credits-changed', { detail: { balance: Number(remaining) } })
          )
        }
      } catch { /* never throw from interceptor */ }
      return response
    }

    return () => {
      if (origFetchRef.current) {
        window.fetch = origFetchRef.current
        origFetchRef.current = null
      }
    }
  }, [])

  // Sync with server prop when workspace switches
  useEffect(() => {
    setShowOnboarding(onboardingRequired)
  }, [onboardingRequired, currentBusinessName])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(p => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function handleOnboardingContinue() {
    // Step 1 → proceed to next steps (for now just close; steps added later)
    setShowOnboarding(false)
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 md:relative md:flex md:flex-shrink-0
        transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <AppSidebar user={user} currentBusinessName={currentBusinessName} onNavClick={() => setSidebarOpen(false)} onSearchClick={() => setPaletteOpen(true)} />
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-400 hover:text-white transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <BrandLogo iconSize="h-7" textSize="text-sm" />
        </div>

        {children}
      </div>

      {/* Integration Service — above AI Coach */}
      <IntegrationServiceWidget />
      {/* AI Coach — available on every page */}
      <CoachWidget />

      {/* Onboarding modal — shown whenever DB says onboarding_completed = false */}
      <BusinessOnboardingModal
        open={showOnboarding}
        businessName={currentBusinessName}
        previousWorkspaceId={null}
        onContinue={handleOnboardingContinue}
      />
    </div>
  )
}
