export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { BrandLogo } from '@/components/layout/brand-logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 50%, #f0fdf4 100%)' }}>
      {/* Decorative blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #7c3aed, transparent)' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #06b6d4, transparent)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #22c55e, transparent)' }} />
      </div>

      {/* Logo */}
      <div className="relative flex items-center justify-center pt-10 pb-4">
        <Link href="/"><BrandLogo iconSize="h-14" textSize="text-3xl" /></Link>
      </div>

      {/* Content */}
      <div className="relative flex-1 flex items-center justify-center px-6 py-8">
        {children}
      </div>

      {/* Footer */}
      <div className="relative text-center pb-8 text-slate-400 text-sm">
        © 2026 CooVex. All rights reserved.
      </div>
    </div>
  )
}
