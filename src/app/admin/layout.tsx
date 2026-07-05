import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

const NAV_SECTIONS = [
  {
    label: 'CORE',
    items: [
      { label: '📊 Overview',       href: '/admin' },
      { label: '👥 Users',          href: '/admin/users' },
      { label: '🏢 Workspaces',     href: '/admin/workspaces' },
      { label: '💰 Revenue',        href: '/admin/revenue' },
      { label: '🏦 Finance',        href: '/admin/finance' },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { label: '⚡ Credits',        href: '/admin/credits' },
      { label: '🤖 Agent Jobs',     href: '/admin/agent-jobs' },
      { label: '🧠 AI Usage',       href: '/admin/ai-usage' },
      { label: '💾 AI Memory',      href: '/admin/ai-memory' },
      { label: '🔮 LLM Config',     href: '/admin/llm' },
      { label: '📡 API Monitor',    href: '/admin/api-monitor' },
    ],
  },
  {
    label: 'PLATFORM',
    items: [
      { label: '💰 Pricing',        href: '/admin/pricing' },
      { label: '🔌 Integrations',   href: '/admin/integrations' },
      { label: '🛠 Free Tools',     href: '/admin/free-tools' },
      { label: '🚩 Feature Flags',  href: '/admin/feature-flags' },
      { label: '🛍 Software Hub',   href: '/admin/software' },
    ],
  },
  {
    label: 'CONTENT',
    items: [
      { label: '📝 Blog CMS',       href: '/admin/blog' },
      { label: '📄 About Page',     href: '/admin/about' },
      { label: '📣 Announcements',  href: '/admin/announcements' },
      { label: '📧 Marketing',      href: '/admin/marketing' },
      { label: '📅 Meetings',       href: '/admin/meetings' },
      { label: '🔍 SEO & GEO',     href: '/admin/seo' },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { label: '💓 System Health',  href: '/admin/system-health' },
      { label: '🚨 Error Logs',     href: '/admin/error-logs' },
      { label: '💾 Backups',        href: '/admin/backups' },
    ],
  },
  {
    label: 'TEAM',
    items: [
      { label: '🎧 Support',        href: '/admin/support' },
      { label: '👔 Team Access',    href: '/admin/team' },
      { label: '📬 Inquiries',      href: '/admin/inquiries' },
    ],
  },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const email = user.email?.toLowerCase() || ''
  if (!ADMIN_EMAILS.includes(email)) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex text-base">
      {/* Admin sidebar */}
      <aside className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col overflow-y-auto">
        <div className="h-16 flex items-center px-5 border-b border-slate-800 flex-shrink-0">
          <Link href="/admin" className="text-white font-bold text-base tracking-tight">⚡ Admin Panel</Link>
        </div>
        <nav className="flex-1 px-3 py-4">
          {NAV_SECTIONS.map(section => (
            <div key={section.label} className="mb-5">
              <p className="px-3 pb-1.5 text-slate-500 text-[11px] font-bold tracking-widest uppercase">{section.label}</p>
              <div className="space-y-0.5">
                {section.items.map(item => (
                  <Link key={item.href} href={item.href}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-slate-800 flex-shrink-0 space-y-1">
          <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-sm transition-colors">
            ← Back to App
          </Link>
          <p className="px-3 text-slate-600 text-xs truncate">{user.email}</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-slate-950 text-white">
        {children}
      </main>
    </div>
  )
}
