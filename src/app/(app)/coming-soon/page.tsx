import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Coming Soon — CooVex' }

export default async function ComingSoonPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const upcoming = [
    { icon: '🗺️', title: 'Execution Roadmap', desc: 'AI-generated step-by-step plan from your audit and goals.' },
    { icon: '📈', title: 'Revenue Forecasting', desc: 'Predict revenue based on lead pipeline and conversion rates.' },
    { icon: '🤝', title: 'Client Portal V2', desc: 'White-labeled client portal with live reports and approvals.' },
    { icon: '🔗', title: 'API Access', desc: 'Connect CooVex data to your own dashboards and tools.' },
    { icon: '📱', title: 'Mobile App', desc: 'Manage your business intelligence on the go.' },
    { icon: '🌍', title: 'Multi-location', desc: 'Manage multiple business locations under one account.' },
    { icon: '🤖', title: 'Custom AI Agents', desc: 'Build your own agents with custom triggers and actions.' },
    { icon: '📊', title: 'Advanced Analytics', desc: 'Deep dive into traffic, conversion, and engagement data.' },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Coming Soon</h1>
        <p className="text-slate-400 text-sm">Features in development. Stay tuned for updates.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {upcoming.map(f => (
          <div key={f.title} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className="text-2xl flex-shrink-0">{f.icon}</div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-white font-semibold text-sm">{f.title}</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">Soon</span>
                </div>
                <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
