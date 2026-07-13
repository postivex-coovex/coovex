import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Progress Report — CooVex' }

function delta(curr: number, prev: number) {
  const d = curr - prev
  return { d, sign: d > 0 ? '+' : '', color: d > 0 ? 'text-emerald-400' : d < 0 ? 'text-rose-400' : 'text-slate-500' }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
}

function typeIcon(type: string, title: string) {
  if (title.includes('GTM') || title.includes('Autopilot')) return '🚀'
  if (title.includes('Audit') || title.includes('Website')) return '🔍'
  if (title.includes('GEO') || title.includes('AI Search')) return '🧠'
  if (title.includes('Competitor')) return '🕵️'
  if (title.includes('Lead')) return '👥'
  if (title.includes('Content') || title.includes('Post')) return '✍️'
  if (title.includes('Install') || title.includes('GA4')) return '📊'
  if (title.includes('Search Console') || title.includes('GSC')) return '🔍'
  if (title.includes('Bing')) return '🔎'
  if (title.includes('IndexNow')) return '⚡'
  if (type === 'urgent') return '🚨'
  if (type === 'warning') return '⚠️'
  if (type === 'opportunity') return '💡'
  if (type === 'done') return '✅'
  return '📌'
}

export default async function ProgressReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: rawPeriod } = await searchParams
  const period = rawPeriod === 'month' ? 'month' : 'week'
  const days = period === 'month' ? 30 : 7

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, name, website_url').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) redirect('/dashboard')

  const service = createServiceClient()
  const now = new Date()
  const currStart = new Date(now.getTime() - days * 86400000).toISOString()
  const prevStart = new Date(now.getTime() - days * 2 * 86400000).toISOString()

  // Fetch all data in parallel
  const [
    { count: leadsNow },
    { count: leadsPrev },
    { count: hotLeadsNow },
    { count: hotLeadsPrev },
    { count: postsNow },
    { count: postsPrev },
    { count: competitorsNow },
    { count: competitorsPrev },
    { count: campaignsNow },
    { data: auditsNow },
    { data: auditsPrev },
    { data: signalsNow },
    { data: gtmMem },
    { data: geoMem },
    { data: spMem },
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', currStart),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', prevStart).lt('created_at', currStart),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id).gte('score', 70).gte('created_at', currStart),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id).gte('score', 70).gte('created_at', prevStart).lt('created_at', currStart),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', currStart),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', prevStart).lt('created_at', currStart),
    supabase.from('competitors').select('*', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', currStart),
    supabase.from('competitors').select('*', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', prevStart).lt('created_at', currStart),
    supabase.from('email_campaigns').select('*', { count: 'exact', head: true }).eq('business_id', business.id).eq('status', 'sent').gte('created_at', currStart),
    supabase.from('audits').select('score, report_json, created_at').eq('business_id', business.id).gte('created_at', currStart).order('created_at', { ascending: false }).limit(1),
    supabase.from('audits').select('score, created_at').eq('business_id', business.id).gte('created_at', prevStart).lt('created_at', currStart).order('created_at', { ascending: false }).limit(1),
    service.from('agent_signals').select('id, type, title, body, created_at').eq('business_id', business.id).gte('created_at', currStart).order('created_at', { ascending: false }).limit(100),
    service.from('agent_memory').select('value_text, updated_at').eq('business_id', business.id).eq('key', 'gtm_last_run').maybeSingle(),
    service.from('agent_memory').select('value_text').eq('business_id', business.id).eq('key', 'geo_intelligence').maybeSingle(),
    service.from('agent_memory').select('value_text').eq('business_id', business.id).eq('key', 'search_presence').maybeSingle(),
  ])

  // Parse memory
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let gtmRun: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let geoIntel: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let searchPresence: any = null
  try { if (gtmMem?.value_text) gtmRun = JSON.parse(gtmMem.value_text) } catch {}
  try { if (geoMem?.value_text) geoIntel = JSON.parse(geoMem.value_text) } catch {}
  try { if (spMem?.value_text) searchPresence = JSON.parse(spMem.value_text) } catch {}

  const latestAudit = auditsNow?.[0] ?? null
  const prevAudit   = auditsPrev?.[0] ?? null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const auditReport = latestAudit?.report_json as any
  const auditScoreNow  = latestAudit?.score ?? null
  const auditScorePrev = prevAudit?.score ?? null
  const geoScoreNow    = auditReport?.geo?.geo_score ?? null
  const aiVisNow       = geoIntel?.actual_ai_visibility?.visibility_rate ?? gtmRun?.ai_visibility_rate ?? null
  const geoGapsNow     = geoIntel?.content_gaps?.length ?? 0
  const highImpactGaps = (geoIntel?.content_gaps ?? []).filter((g: { impact: string }) => g.impact === 'high').length

  // Search presence checks
  const spChecked = searchPresence ? [
    { label: 'Google Analytics (GA4)',  done: !!searchPresence.ga4 },
    { label: 'Google Search Console',   done: !!searchPresence.gsc_verified },
    { label: 'Bing Webmaster Tools',    done: !!searchPresence.bing_verified },
    { label: 'Sitemap in robots.txt',   done: !!searchPresence.sitemap_in_robots },
    { label: 'IndexNow Auto-Submit',    done: !!searchPresence.indexnow_configured },
  ] : []
  const spDone = spChecked.filter(c => c.done).length

  // "What CooVex did" summary items
  const valueItems: string[] = []
  if (gtmRun && new Date(gtmRun.ran_at) >= new Date(currStart)) {
    if (gtmRun.saved_leads > 0) valueItems.push(`Found & saved ${gtmRun.saved_leads} leads to your pipeline via AI Lead Finder`)
    if ((gtmRun.hot_leads ?? 0) > 0) valueItems.push(`${gtmRun.hot_leads} hot leads (score ≥ 70) in your pipeline`)
    valueItems.push('Generated your GTM action plan with 3 prioritized tasks')
  }
  if (latestAudit) valueItems.push(`Website audit scored ${auditScoreNow}/100${geoScoreNow ? ` · GEO ${geoScoreNow}/100` : ''}`)
  if (spChecked.length) valueItems.push(`Search presence: ${spDone}/${spChecked.length} checks passed`)
  if (geoGapsNow > 0) valueItems.push(`${geoGapsNow} AI search gaps identified — ${highImpactGaps} high-impact`)
  if (aiVisNow != null) valueItems.push(`AI visibility (Gemini): ${aiVisNow}%`)
  if ((leadsNow ?? 0) > 0) valueItems.push(`${leadsNow} new leads added to your pipeline`)
  if ((postsNow ?? 0) > 0) valueItems.push(`${postsNow} content piece${postsNow !== 1 ? 's' : ''} created`)
  if ((competitorsNow ?? 0) > 0) valueItems.push(`${competitorsNow} new competitor${competitorsNow !== 1 ? 's' : ''} added to tracking`)
  if ((campaignsNow ?? 0) > 0) valueItems.push(`${campaignsNow} email campaign${campaignsNow !== 1 ? 's' : ''} sent`)

  // Period label
  const periodLabel = period === 'week' ? 'last 7 days' : 'last 30 days'
  const prevLabel   = period === 'week' ? 'previous 7 days' : 'previous 30 days'

  const metrics = [
    {
      label: 'Website Audit Score',
      curr: auditScoreNow,  prev: auditScorePrev, unit: '/100',
      link: '/audit', note: auditScoreNow == null ? 'Run an audit to track' : null,
    },
    {
      label: 'GEO Score',
      curr: geoScoreNow, prev: null, unit: '/100',
      link: '/audit', note: geoScoreNow == null ? 'Run audit for GEO score' : 'from latest audit',
    },
    {
      label: 'AI Visibility',
      curr: aiVisNow, prev: null, unit: '%',
      link: '/geo', note: aiVisNow == null ? 'Run GEO Optimizer' : 'Gemini visibility',
    },
    {
      label: 'New Leads',
      curr: leadsNow ?? 0, prev: leadsPrev ?? 0, unit: '',
      link: '/leads', note: null,
    },
    {
      label: 'Hot Leads (≥70)',
      curr: hotLeadsNow ?? 0, prev: hotLeadsPrev ?? 0, unit: '',
      link: '/leads', note: null,
    },
    {
      label: 'Content Created',
      curr: postsNow ?? 0, prev: postsPrev ?? 0, unit: '',
      link: '/content', note: null,
    },
    {
      label: 'GEO Content Gaps',
      curr: geoGapsNow, prev: null, unit: '',
      link: '/geo', note: `${highImpactGaps} high-impact`,
    },
    {
      label: 'New Competitors',
      curr: competitorsNow ?? 0, prev: competitorsPrev ?? 0, unit: '',
      link: '/competitors', note: null,
    },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white mb-0.5">Progress Report</h1>
          <p className="text-slate-400 text-xs">{business.name} · {periodLabel}</p>
        </div>
        {/* Period tabs */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
          {[
            { label: 'This Week',  value: 'week' },
            { label: 'This Month', value: 'month' },
          ].map(tab => (
            <Link
              key={tab.value}
              href={`/agent/report?period=${tab.value}`}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === tab.value ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* What CooVex did section */}
      <div className="bg-violet-950/20 border border-violet-800/30 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span>🤖</span>
          <h2 className="text-sm font-semibold text-white">What CooVex did for you</h2>
          <span className="text-[10px] text-violet-400 bg-violet-500/15 px-1.5 py-0.5 rounded-full border border-violet-500/25">{periodLabel}</span>
        </div>
        {valueItems.length === 0 ? (
          <p className="text-slate-500 text-sm">No activity recorded yet. Run GTM Autopilot or Website Audit to see your report here.</p>
        ) : (
          <ul className="space-y-1.5">
            {valueItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Metrics comparison */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Metrics Comparison</h2>
          <span className="text-[10px] text-slate-500">{prevLabel} → {periodLabel}</span>
        </div>
        <div className="divide-y divide-slate-800/50">
          {metrics.map(m => {
            const hasPrev = m.prev != null && m.curr != null
            const d = hasPrev ? delta(m.curr as number, m.prev as number) : null
            const currVal = m.curr != null ? `${m.curr}${m.unit}` : '—'
            const prevVal = m.prev != null ? `${m.prev}${m.unit}` : null

            return (
              <Link key={m.label} href={m.link} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-800/30 transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-300 group-hover:text-white">{m.label}</p>
                  {m.note && <p className="text-[10px] text-slate-600 mt-0.5">{m.note}</p>}
                </div>
                {/* Prev → Current */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {prevVal && (
                    <>
                      <span className="text-xs text-slate-600">{prevVal}</span>
                      <span className="text-slate-700 text-xs">→</span>
                    </>
                  )}
                  <span className={`text-sm font-bold ${m.curr != null && m.curr > 0 ? 'text-white' : 'text-slate-500'}`}>{currVal}</span>
                  {d && d.d !== 0 && (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${d.d > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                      {d.sign}{d.d}{m.unit}
                    </span>
                  )}
                  {d && d.d === 0 && prevVal && (
                    <span className="text-xs text-slate-600 px-1.5 py-0.5 rounded bg-slate-800">no change</span>
                  )}
                </div>
                <span className="text-slate-700 group-hover:text-slate-500 text-xs">→</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Search Presence Status */}
      {spChecked.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span>🔍</span>
            <h2 className="text-sm font-semibold text-white">Search & Discovery Status</h2>
            <span className="ml-auto text-xs text-slate-500">{spDone}/{spChecked.length} configured</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {spChecked.map(c => (
              <div key={c.label} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${c.done ? 'bg-emerald-500/8 text-emerald-400' : 'bg-slate-800/50 text-slate-500'}`}>
                <span>{c.done ? '✓' : '○'}</span>
                <span>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Activity Timeline</h2>
          <span className="text-[10px] text-slate-500">{(signalsNow ?? []).length} events</span>
        </div>
        {(signalsNow ?? []).length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-slate-500 text-sm">No activity yet this {period}.</p>
            <p className="text-slate-600 text-xs mt-1">Run GTM Autopilot or Website Audit to start tracking.</p>
          </div>
        ) : (
          <div className="relative divide-y divide-slate-800/50">
            <div className="absolute left-[4.5rem] top-0 bottom-0 w-px bg-slate-800 pointer-events-none" />
            {(signalsNow ?? []).map(sig => {
              const icon = typeIcon(sig.type, sig.title)
              const typeBadgeClass: Record<string, string> = {
                urgent: 'bg-rose-500/15 text-rose-400',
                warning: 'bg-amber-500/15 text-amber-400',
                opportunity: 'bg-blue-500/15 text-blue-400',
                done: 'bg-emerald-500/15 text-emerald-400',
                insight: 'bg-violet-500/15 text-violet-400',
                task: 'bg-amber-500/15 text-amber-400',
              }
              return (
                <div key={sig.id} className="flex gap-4 px-5 py-3.5 hover:bg-slate-800/20 transition-colors">
                  <span className="text-[10px] text-slate-500 w-16 flex-shrink-0 text-right pt-0.5 leading-tight">
                    {fmtDate(sig.created_at)}
                  </span>
                  <div className="relative z-10 w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center flex-shrink-0 text-xs">
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-xs font-medium text-white leading-snug">{sig.title}</p>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${typeBadgeClass[sig.type] ?? 'bg-slate-700 text-slate-400'}`}>
                        {sig.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{sig.body}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-3 text-xs pb-2">
        {[
          { href: '/gtm-agent',      label: '🚀 GTM Autopilot' },
          { href: '/audit',          label: '🔍 Run Audit' },
          { href: '/geo',            label: '🧠 GEO Optimizer' },
          { href: '/leads',          label: '👥 Leads' },
          { href: '/content',        label: '✍️ Content' },
          { href: '/getting-started',label: '📋 Getting Started' },
        ].map(l => (
          <Link key={l.href} href={l.href} className="text-slate-500 hover:text-violet-400 transition-colors">
            {l.label} →
          </Link>
        ))}
      </div>
    </div>
  )
}
