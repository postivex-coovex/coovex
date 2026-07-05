export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { BrandLogo } from '@/components/layout/brand-logo'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  if (profile?.onboarding_completed) redirect('/dashboard')

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 50%, #f0fdf4 100%)' }}>
      {/* Decorative blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #7c3aed, transparent)' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #06b6d4, transparent)' }} />
      </div>

      {/* Header */}
      <div className="relative flex items-center justify-between px-8 py-5 max-w-3xl mx-auto w-full">
        <Link href="/"><BrandLogo iconSize="h-10" textSize="text-xl" /></Link>
        <span className="text-slate-400 text-sm font-medium">Setup Wizard</span>
      </div>

      {/* Content */}
      <div className="relative flex-1 flex items-start justify-center px-6 pb-16">
        {children}
      </div>
    </div>
  )
}
