import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { GtmClient } from './gtm-client'

export const metadata: Metadata = { title: 'GTM Autopilot — CooVex' }

export default async function GtmAgentPage() {
  const supabase = await createClient()
  const service  = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  // Audit prerequisite — show gate before showing GTM
  const { data: latestAudit } = business
    ? await supabase
        .from('audits')
        .select('id, score, created_at')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  if (!latestAudit) {
    return (
      <div className="p-6 max-w-2xl mx-auto mt-12">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🚀</span>
          <h1 className="text-2xl font-bold text-white">GTM Autopilot</h1>
        </div>
        <p className="text-slate-400 text-sm mb-8">
          Your AI agent that runs leads, GEO, and competitor scans — then hands you a precise action plan.
        </p>

        <div className="bg-slate-900 border border-amber-700/40 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-lg font-semibold text-white mb-2">Run Website Audit First</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
            GTM Autopilot starts by reading your website audit — scores, GEO data, and critical issues.
            Run the audit once to unlock GTM.
          </p>
          <Link
            href="/audit"
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors"
          >
            🔍 Run Website Audit →
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: '👥', title: 'Lead Discovery', desc: 'Finds Reddit & community leads matching your industry' },
            { icon: '🧠', title: 'Gemini Visibility', desc: 'Checks if your business appears in AI search results' },
            { icon: '⚡', title: 'AI Action Plan', desc: 'Generates 3 precise GTM actions based on real data' },
          ].map(s => (
            <div key={s.title} className="p-4 bg-slate-900 border border-slate-800 rounded-xl opacity-60">
              <span className="text-lg">{s.icon}</span>
              <p className="text-sm font-medium text-white mt-2">{s.title}</p>
              <p className="text-xs text-slate-500 mt-1">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Load last run
  let lastRun = null
  if (business) {
    const { data: mem } = await service
      .from('agent_memory').select('value_text')
      .eq('business_id', business.id).eq('key', 'gtm_last_run').maybeSingle()
    if (mem?.value_text) {
      try { lastRun = JSON.parse(mem.value_text) } catch {}
    }
  }

  return <GtmClient initialLastRun={lastRun} />
}
