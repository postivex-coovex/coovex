import { TrendingUp, Users, Star, FileText } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Business } from '@/types'

interface LiveStats {
  leadsToday: number
  pipelineValue: number
  newReviews: number
  postsPublished: number
}

interface QuickStatsBarProps {
  business: Business | null
  stats: LiveStats
}

export function QuickStatsBar({ stats }: QuickStatsBarProps) {
  const items = [
    { label: 'Leads Today',     value: stats.leadsToday,      format: 'number',   icon: Users     },
    { label: 'Pipeline Value',  value: stats.pipelineValue,   format: 'currency', icon: TrendingUp },
    { label: 'New Reviews',     value: stats.newReviews,       format: 'number',   icon: Star      },
    { label: 'Posts Published', value: stats.postsPublished,   format: 'number',   icon: FileText  },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map(item => (
        <div key={item.label} className="bg-slate-900 rounded-xl border border-slate-800 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">{item.label}</span>
            <item.icon className="w-3.5 h-3.5 text-slate-600" />
          </div>
          <div className="text-xl font-semibold text-white">
            {item.format === 'currency' ? formatCurrency(item.value) : item.value}
          </div>
        </div>
      ))}
    </div>
  )
}
