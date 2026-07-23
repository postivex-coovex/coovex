import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Analytics' }
export const dynamic = 'force-dynamic'

const STAGE_ORDER = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']
const STAGE_LABELS: Record<string, string> = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified',
  proposal: 'Proposal', negotiation: 'Negotiation', won: 'Won', lost: 'Lost',
}
const STAGE_COLORS: Record<string, string> = {
  new: 'bg-slate-500', contacted: 'bg-blue-500', qualified: 'bg-blue-500',
  proposal: 'bg-blue-500', negotiation: 'bg-slate-600', won: 'bg-blue-600', lost: 'bg-red-500',
}
const SIGNAL_ICONS: Record<string, string> = {
  opportunity: '💡', warning: '⚠️', task: '✅', insight: '📊', alert: '🔔',
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toLocaleString()}`
}
function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function SparkBar({ values, color = 'bg-blue-500' }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex items-end gap-0.5 h-12">
      {values.map((v, i) => (
        <div key={i} className={`flex-1 ${color} rounded-sm opacity-60 hover:opacity-100 transition-opacity`}
          style={{ height: `${Math.round((v / max) * 100)}%`, minHeight: v > 0 ? 2 : 0 }} />
      ))}
    </div>
  )
}

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, health_score, industry, country')
    .eq('workspace_id', profile?.current_workspace_id ?? '')
    .maybeSingle()

  if (!business) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 text-center">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-white font-semibold mb-2">Complete your setup</h2>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Set up your business profile to start seeing analytics.
          </p>
        </div>
      </div>
    )
  }

  const [
    { data: metrics },
    { count: totalLeads },
    { count: totalPosts },
    { count: totalReviews },
    { data: recentLeads },
    { data: recentPosts },
    { data: aiUsage },
    { data: allLeads },
    { data: deals },
    { data: signals },
  ] = await Promise.all([
    supabase.from('business_metrics').select('health_score, date').eq('business_id', business.id).order('date', { ascending: false }).limit(30),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('leads').select('created_at, score, stage').eq('business_id', business.id).order('created_at', { ascending: false }).limit(30),
    supabase.from('posts').select('created_at, status, channel').eq('business_id', business.id).order('created_at', { ascending: false }).limit(30),
    supabase.from('ai_usage_log').select('cost_usd, tokens_in, tokens_out, feature').eq('workspace_id', profile?.current_workspace_id ?? '').limit(100),
    supabase.from('leads').select('stage, score, source').eq('business_id', business.id),
    supabase.from('deals').select('value, status, probability, close_date').eq('business_id', business.id),
    supabase.from('agent_signals').select('id, title, type, priority, created_at').eq('business_id', business.id).order('created_at', { ascending: false }).limit(5),
  ])

  // Health score chart
  const healthScores = (metrics || []).slice(0, 30).reverse().map(m => m.health_score as number)
  const currentScore = (metrics || [])[0]?.health_score ?? business.health_score ?? 0
  const prevScore    = (metrics || [])[1]?.health_score ?? currentScore
  const scoreDelta   = currentScore - prevScore

  // AI usage
  const usageList    = (aiUsage as { cost_usd: string; tokens_in: number; tokens_out: number; feature: string }[] | null) ?? []
  const totalAiCost  = usageList.reduce((s, r) => s + Number(r.cost_usd), 0)
  const totalTokens  = usageList.reduce((s, r) => s + r.tokens_in + r.tokens_out, 0)

  // Leads sparkbar
  const last7 = [...Array(7)].map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
  const leadsByDay = last7.map(day => (recentLeads || []).filter(l => l.created_at?.startsWith(day)).length)
  const postsByDay = last7.map(day => (recentPosts || []).filter(p => p.created_at?.startsWith(day)).length)

  // Posts channel breakdown
  const channelCounts: Record<string, number> = {}
  for (const p of recentPosts || []) {
    channelCounts[p.channel] = (channelCounts[p.channel] || 0) + 1
  }

  // Lead stage breakdown
  const stageCounts: Record<string, number> = {}
  for (const l of allLeads || []) { stageCounts[l.stage] = (stageCounts[l.stage] ?? 0) + 1 }
  const maxStageCount = Math.max(...Object.values(stageCounts), 1)
  const hotLeads = (allLeads || []).filter(l => (l.score ?? 0) >= 70).length

  // Lead source breakdown
  const sourceCounts: Record<string, number> = {}
  for (const l of allLeads || []) { sourceCounts[l.source ?? 'unknown'] = (sourceCounts[l.source ?? 'unknown'] ?? 0) + 1 }
  const totalLeadsN = totalLeads ?? 0

  // Win rate
  const closedLeads = (allLeads || []).filter(l => l.stage === 'won' || l.stage === 'lost')
  const winRate = closedLeads.length > 0 ? Math.round((closedLeads.filter(l => l.stage === 'won').length / closedLeads.length) * 100) : 0

  // Deals / Revenue
  const allDeals   = deals ?? []
  const wonDeals   = allDeals.filter(d => d.status === 'won')
  const openDeals  = allDeals.filter(d => d.status === 'open')
  const wonRevenue = wonDeals.reduce((s, d) => s + Number(d.value), 0)
  const pipeline   = openDeals.reduce((s, d) => s + Number(d.value), 0)
  const weighted   = openDeals.reduce((s, d) => s + Number(d.value) * (d.probability / 100), 0)

  // Closing this month
  const thisMonthStart = new Date(); thisMonthStart.setDate(1); thisMonthStart.setHours(0, 0, 0, 0)
  const closingThisMonth = openDeals.filter(d => d.close_date && new Date(d.close_date) >= thisMonthStart)
  const closingValue = closingThisMonth.reduce((s, d) => s + Number(d.value), 0)

  const scoreColor = currentScore >= 70 ? 'text-blue-400' : currentScore >= 40 ? 'text-slate-500' : 'text-red-400'

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          {business.name} · {business.industry || 'Business'} performance overview
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Health Score', value: `${currentScore}`, unit: '/100', delta: scoreDelta !== 0 ? `${scoreDelta > 0 ? '+' : ''}${scoreDelta} vs prev` : null, good: scoreDelta >= 0, color: scoreColor },
          { label: 'Total Leads', value: `${totalLeadsN}`, unit: '', delta: hotLeads > 0 ? `${hotLeads} hot (≥70)` : null, good: true, color: 'text-white' },
          { label: 'Posts Created', value: `${totalPosts ?? 0}`, unit: '', delta: null, good: true, color: 'text-white' },
          { label: 'Win Rate', value: `${winRate}%`, unit: '', delta: closedLeads.length > 0 ? `${closedLeads.length} closed deals` : 'No closed deals yet', good: winRate >= 30, color: winRate >= 30 ? 'text-blue-400' : 'text-slate-500' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-2">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}<span className="text-slate-600 text-sm">{s.unit}</span></p>
            {s.delta && <p className={`text-xs mt-1 ${s.good ? 'text-blue-400' : 'text-slate-500'}`}>{s.delta}</p>}
          </div>
        ))}
      </div>

      {/* Revenue & Pipeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-4">Revenue & Pipeline</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Won Revenue', value: fmt(wonRevenue), sub: `${wonDeals.length} deals won`, color: 'text-blue-400' },
            { label: 'Open Pipeline', value: fmt(pipeline), sub: `${openDeals.length} open deals`, color: 'text-blue-400' },
            { label: 'Weighted Forecast', value: fmt(weighted), sub: 'probability adjusted', color: 'text-blue-400' },
            { label: 'Closing This Month', value: fmt(closingValue), sub: `${closingThisMonth.length} deals`, color: 'text-slate-500' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/50 rounded-xl p-4">
              <p className="text-slate-500 text-xs mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-slate-600 text-[10px] mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
        {allDeals.length === 0 && (
          <p className="text-slate-600 text-sm text-center mt-4">
            No deals yet — add deal values to leads or connect your CRM in <a href="/settings/integrations" className="text-blue-400 hover:underline">Integrations</a>
          </p>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Health score chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Health Score (30 days)</h3>
            <span className={`text-sm font-bold ${scoreColor}`}>{currentScore}/100</span>
          </div>
          {healthScores.length > 0 ? (
            <>
              <div className="flex items-end gap-1 h-20">
                {healthScores.map((v, i) => (
                  <div key={i}
                    className={`flex-1 rounded-t transition-opacity hover:opacity-100 opacity-70 ${v >= 70 ? 'bg-blue-600' : v >= 40 ? 'bg-slate-600' : 'bg-red-500'}`}
                    style={{ height: `${v}%` }} title={`Score: ${v}`} />
                ))}
              </div>
              <div className="flex justify-between text-xs text-slate-600 mt-2">
                <span>30 days ago</span><span>Today</span>
              </div>
            </>
          ) : (
            <div className="h-20 flex items-center justify-center">
              <p className="text-slate-700 text-sm">Run an audit to start tracking</p>
            </div>
          )}
        </div>

        {/* Lead stage funnel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Lead Stage Breakdown</h3>
          {totalLeadsN === 0 ? (
            <div className="h-20 flex items-center justify-center">
              <p className="text-slate-700 text-sm">No leads yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {STAGE_ORDER.filter(s => stageCounts[s] > 0).map(stage => {
                const count = stageCounts[stage] ?? 0
                const pct = Math.round((count / maxStageCount) * 100)
                return (
                  <div key={stage}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">{STAGE_LABELS[stage]}</span>
                      <span className="text-slate-500">{count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full">
                      <div className={`h-1.5 ${STAGE_COLORS[stage]} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Activity Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Lead trend */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-1">Leads (7 days)</h3>
          <p className="text-slate-600 text-xs mb-4">New leads per day</p>
          <SparkBar values={leadsByDay} color="bg-blue-600" />
          <div className="flex justify-between text-xs text-slate-700 mt-2">
            {last7.map((d, i) => <span key={i}>{new Date(d + 'T12:00:00').getDate()}</span>)}
          </div>
        </div>

        {/* Post trend */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-1">Posts (7 days)</h3>
          <p className="text-slate-600 text-xs mb-4">Posts created per day</p>
          <SparkBar values={postsByDay} color="bg-blue-500" />
          <div className="flex justify-between text-xs text-slate-700 mt-2">
            {last7.map((d, i) => <span key={i}>{new Date(d + 'T12:00:00').getDate()}</span>)}
          </div>
        </div>

        {/* Post channels */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-1">Post Channels</h3>
          <p className="text-slate-600 text-xs mb-4">Distribution by platform</p>
          {Object.keys(channelCounts).length === 0 ? (
            <p className="text-slate-700 text-sm">No posts yet</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(channelCounts).sort((a, b) => b[1] - a[1]).map(([ch, count]) => {
                const total = (recentPosts || []).length
                const pct = Math.round((count / total) * 100)
                return (
                  <div key={ch}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 capitalize">{ch}</span>
                      <span className="text-slate-500">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full">
                      <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: AI usage + Lead sources + Agent Signals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* AI Usage */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">AI Usage</h3>
          <div className="space-y-3">
            {[
              { label: 'API calls', value: usageList.length.toString() },
              { label: 'Tokens consumed', value: totalTokens.toLocaleString() },
              { label: 'Cost this period', value: `$${totalAiCost.toFixed(4)}` },
              { label: 'Reviews', value: `${totalReviews ?? 0}` },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-slate-500 text-sm">{row.label}</span>
                <span className="text-white font-medium text-sm">{row.value}</span>
              </div>
            ))}
          </div>
          {usageList.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <p className="text-slate-500 text-xs mb-2">Top features</p>
              {Object.entries(usageList.reduce<Record<string, number>>((acc, r) => {
                acc[r.feature] = (acc[r.feature] || 0) + 1; return acc
              }, {})).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([feat, count]) => (
                <div key={feat} className="flex items-center justify-between py-1">
                  <span className="text-slate-400 text-xs">{feat}</span>
                  <span className="text-slate-500 text-xs">{count}x</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lead Sources */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Lead Sources</h3>
          {Object.keys(sourceCounts).length === 0 ? (
            <p className="text-slate-700 text-sm">No leads yet</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([src, count]) => {
                const pct = Math.round((count / totalLeadsN) * 100)
                const label = src.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                return (
                  <div key={src}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">{label}</span>
                      <span className="text-slate-500">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full">
                      <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Agent Signals */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Recent AI Signals</h3>
          {!signals || signals.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-slate-700 text-sm">No signals yet</p>
              <p className="text-slate-700 text-xs mt-1">Your AI agent will surface insights here as you add data</p>
            </div>
          ) : (
            <div className="space-y-3">
              {signals.map(s => (
                <div key={s.id} className="flex items-start gap-3">
                  <span className="text-base shrink-0 mt-0.5">{SIGNAL_ICONS[s.type] ?? '💡'}</span>
                  <div className="min-w-0">
                    <p className="text-white text-xs font-medium leading-snug line-clamp-2">{s.title}</p>
                    <p className="text-slate-600 text-[10px] mt-0.5">{timeAgo(s.created_at)}</p>
                  </div>
                  {s.priority === 'high' && (
                    <span className="shrink-0 text-[9px] px-1.5 py-0.5 bg-red-950/50 text-red-400 border border-red-900/50 rounded-full">High</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
