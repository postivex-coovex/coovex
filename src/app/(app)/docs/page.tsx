import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Documentation & Guide — CooVex' }

export default async function DocsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const guides = [
    { icon: '🚀', title: 'Getting Started', desc: 'Set up your business profile, run your first audit, and connect your channels.', href: '/getting-started' },
    { icon: '🔍', title: 'Running a Website Audit', desc: 'Learn how to interpret your audit score and fix critical issues.', href: '/audit' },
    { icon: '🧠', title: 'GEO Optimizer Guide', desc: 'Optimize your business to appear in ChatGPT, Perplexity, Claude, and Gemini results.', href: '/geo' },
    { icon: '⚡', title: 'GTM Autopilot', desc: 'Run your full go-to-market in one click — leads, GEO, content gaps, action plan.', href: '/gtm-agent' },
    { icon: '👥', title: 'Leads Automation', desc: 'Find, score, and manage AI-discovered leads for your business.', href: '/leads' },
    { icon: '✍️', title: 'Content Autopilot', desc: 'Generate, schedule, and publish AI-powered content across all channels.', href: '/content' },
    { icon: '📊', title: 'Business Intelligence', desc: 'Track competitors, industry trends, and your business progress.', href: '/competitors' },
    { icon: '🎯', title: 'Marketing AI Agent', desc: 'Create proposals, run email campaigns, and manage your marketing funnel.', href: '/proposals' },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Documentation & Guide</h1>
        <p className="text-slate-400 text-sm">Everything you need to get the most out of CooVex.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {guides.map(g => (
          <a key={g.href} href={g.href} className="group bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-colors block">
            <div className="text-2xl mb-3">{g.icon}</div>
            <h2 className="text-white font-semibold text-sm mb-1 group-hover:text-blue-400 transition-colors">{g.title}</h2>
            <p className="text-slate-500 text-xs leading-relaxed">{g.desc}</p>
          </a>
        ))}
      </div>
    </div>
  )
}
