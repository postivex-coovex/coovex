import Link from 'next/link'
import type { Plan } from '@/lib/feature-flags'
import { hasFeature } from '@/lib/feature-flags'

interface FeatureGateProps {
  feature: string
  plan: Plan
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function FeatureGate({ feature, plan, children, fallback }: FeatureGateProps) {
  if (hasFeature(feature, plan)) return <>{children}</>

  if (fallback) return <>{fallback}</>

  return (
    <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-xl p-6 text-center">
      <div className="text-2xl mb-2">🔒</div>
      <p className="text-slate-400 text-sm font-medium mb-1">Feature locked</p>
      <p className="text-slate-600 text-xs mb-3">This feature requires a higher plan.</p>
      <Link
        href="/settings/billing"
        className="inline-block text-xs bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg transition-colors"
      >
        Upgrade Plan →
      </Link>
    </div>
  )
}
