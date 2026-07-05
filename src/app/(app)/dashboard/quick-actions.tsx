import Link from 'next/link'
import { ClipboardCheck, Users, Target, Calendar, Mail, BarChart3 } from 'lucide-react'

const actions = [
  { label: 'Run Audit',      href: '/audit',       icon: ClipboardCheck, color: 'text-blue-400',    bg: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20' },
  { label: 'Find Leads',     href: '/leads',        icon: Users,          color: 'text-emerald-400', bg: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20' },
  { label: 'Competitors',    href: '/competitors',  icon: Target,         color: 'text-rose-400',    bg: 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20' },
  { label: 'Create Content', href: '/content',      icon: Calendar,       color: 'text-amber-400',   bg: 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20' },
  { label: 'Campaign',       href: '/campaigns',    icon: Mail,           color: 'text-violet-400',  bg: 'bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/20' },
  { label: 'Analytics',      href: '/analytics',    icon: BarChart3,      color: 'text-cyan-400',    bg: 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/20' },
]

export function QuickActions() {
  return (
    <div>
      <p className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wider">Quick Actions</p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {actions.map(a => (
          <Link
            key={a.href}
            href={a.href}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors ${a.bg}`}
          >
            <a.icon className={`w-5 h-5 ${a.color}`} />
            <span className="text-[11px] text-slate-300 font-medium text-center leading-tight">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
