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
    ? await supabase.from('businesses').select('id, name, website_url').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  const { data: latestAudit } = business
    ? await supabase
        .from('audits')
        .select('id, score, report_json, created_at')
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
          Your AI go-to-market agent — runs your full GTM in one click and tells you exactly what to do.
        </p>
        <div className="bg-slate-900 border border-amber-700/40 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-lg font-semibold text-white mb-2">Run Website Audit First</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
            GTM Autopilot reads your website audit as step 1. Run it once to unlock.
          </p>
          <Link href="/audit" className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors">
            🔍 Run Website Audit →
          </Link>
        </div>
      </div>
    )
  }

  // Parallel data fetch
  const [
    { data: mem },
    { data: geoMem },
    { data: spMem },
    { count: totalLeads },
    { count: hotLeads },
    { count: draftPosts },
    { count: scheduledPosts },
    { count: competitors },
    { data: launchPlatforms },
    { data: pendingSignals },
  ] = await Promise.all([
    service.from('agent_memory').select('value_text').eq('business_id', business!.id).eq('key', 'gtm_last_run').maybeSingle(),
    service.from('agent_memory').select('value_text, updated_at').eq('business_id', business!.id).eq('key', 'geo_intelligence').maybeSingle(),
    service.from('agent_memory').select('value_text').eq('business_id', business!.id).eq('key', 'search_presence').maybeSingle(),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business!.id),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business!.id).gte('score', 70),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', business!.id).eq('status', 'draft'),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', business!.id).eq('status', 'scheduled'),
    supabase.from('competitors').select('*', { count: 'exact', head: true }).eq('business_id', business!.id),
    supabase.from('launch_tracker_platforms').select('platform_id, status, url').eq('business_id', business!.id),
    supabase.from('agent_signals')
      .select('id, type, title, body, action_label, action_data_json, created_at')
      .eq('business_id', business!.id)
      .eq('dismissed', false)
      .in('type', ['task', 'opportunity', 'warning'])
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  let lastRun = null
  if (mem?.value_text) try { lastRun = JSON.parse(mem.value_text) } catch {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const auditReport = latestAudit.report_json as any
  // Prefer freshly-checked search presence (saved by GTM run) over audit snapshot
  let searchPresence = null
  if (spMem?.value_text) try { searchPresence = JSON.parse(spMem.value_text) } catch {}
  if (!searchPresence) searchPresence = auditReport?.geo?.search_presence ?? null
  const geoScore = auditReport?.geo?.geo_score ?? null

  let geoIntel = null
  let geminiRate: number | null = null
  if (geoMem?.value_text) {
    try {
      geoIntel = JSON.parse(geoMem.value_text)
      geminiRate = geoIntel?.actual_ai_visibility?.visibility_rate ?? null
    } catch {}
  }

  const launchMap: Record<string, string> = {}
  for (const p of launchPlatforms ?? []) launchMap[p.platform_id] = p.status

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingTasks = (pendingSignals ?? []) as any[]

  return (
    <GtmClient
      initialLastRun={lastRun}
      pendingTasks={pendingTasks}
      staticData={{
        auditScore: latestAudit.score ?? 0,
        auditGeoScore: geoScore,
        auditAgeDays: Math.floor((Date.now() - new Date(latestAudit.created_at).getTime()) / 86400000),
        totalLeads: totalLeads ?? 0,
        hotLeads: hotLeads ?? 0,
        draftPosts: draftPosts ?? 0,
        scheduledPosts: scheduledPosts ?? 0,
        competitors: competitors ?? 0,
        searchPresence,
        geminiRate,
        geoContentGaps: geoIntel?.content_gaps?.length ?? 0,
        geoHighImpact: (geoIntel?.content_gaps ?? []).filter((g: { impact: string }) => g.impact === 'high').length,
        topGaps: (geoIntel?.content_gaps ?? []).slice(0, 3).map((g: { suggestion?: string; type: string }) => g.suggestion || g.type),
        launchMap,
        businessId: business!.id,
      }}
    />
  )
}
