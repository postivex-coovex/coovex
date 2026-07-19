import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { syncBusinessMemory } from '@/lib/agent/sync-memory'
import { HealthScoreCard } from '@/components/dashboard/health-score-card'
import { ScoreBreakdownCard } from '@/components/dashboard/score-breakdown-card'
import { DailyBriefCard } from '@/components/dashboard/daily-brief-card'
import { QuickStatsBar } from '@/components/dashboard/quick-stats-bar'
import { SetupGuide } from '@/components/dashboard/setup-guide'
import { DailyTasksCard } from '@/components/dashboard/daily-tasks-card'
import { GithubWidget } from '@/components/dashboard/github-widget'
import { SmartActionsPanel } from './smart-actions-panel'
import { PromotionAuditPanel } from './promotion-audit-panel'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import type { DailyTask } from '@/types'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const service  = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_workspace_id, name')
    .eq('id', user.id)
    .single()

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('workspace_id', profile?.current_workspace_id)
    .maybeSingle()

  if (!business) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <p className="text-slate-400 text-sm">Complete the setup wizard to get started.</p>
        </div>
      </div>
    )
  }

  syncBusinessMemory(business.id, profile?.current_workspace_id ?? '', 10 * 60 * 1000).catch(() => {})

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayIso  = todayStart.toISOString()
  const today     = todayStart.toISOString().split('T')[0]

  const [
    { count: leadsToday },
    { data: openDeals },
    { count: newReviews },
    { count: postsPublished },
    { count: productCount },
    { count: auditCount },
    { count: proposalCount },
    { count: campaignCount },
    { count: competitorCount },
    { count: leadsTotal },
    { data: latestMetrics },
    { data: linkedinAudit },
    { data: facebookAudit },
    { data: dailyTasks },
    { data: streakMem },
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id).gte('created_at', todayIso),
    supabase.from('deals').select('value')
      .eq('business_id', business.id).eq('status', 'open'),
    supabase.from('reviews').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id).eq('status', 'new'),
    supabase.from('posts').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id).eq('status', 'published'),
    supabase.from('products').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id),
    supabase.from('audits').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id),
    supabase.from('proposals').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id),
    supabase.from('email_campaigns').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id),
    supabase.from('competitors').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id),
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id),
    supabase.from('business_metrics').select('metrics_json')
      .eq('business_id', business.id).order('date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('audits').select('score')
      .eq('business_id', business.id).eq('type', 'linkedin')
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('audits').select('score')
      .eq('business_id', business.id).eq('type', 'facebook')
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('daily_tasks').select('*')
      .eq('business_id', business.id).eq('date', today).maybeSingle(),
    service.from('agent_memory').select('value_text')
      .eq('business_id', business.id).eq('key', 'daily_task_streak').maybeSingle(),
  ])

  const pipelineValue = (openDeals ?? []).reduce((s, d) => s + (Number(d.value) || 0), 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mx = (latestMetrics as any)?.metrics_json ?? null
  const scoreBreakdown = {
    website:   mx?.website_score ?? (auditCount ? business.health_score : null),
    seo:       mx?.seo       ?? null,
    geo:       mx?.geo_score ?? null,
    linkedin:  linkedinAudit?.score  ?? null,
    facebook:  facebookAudit?.score  ?? null,
    twitter:   null,
    community: null,
  }

  const liveStats = {
    leadsToday:     leadsToday     ?? 0,
    pipelineValue,
    newReviews:     newReviews     ?? 0,
    postsPublished: postsPublished ?? 0,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const biz = business as any
  const setupSteps = {
    hasAudit:       (auditCount      ?? 0) > 0,
    hasProducts:    (productCount    ?? 0) > 0,
    hasSocial:      Object.keys(biz?.social_connections ?? {}).length > 0,
    hasCompetitors: (competitorCount ?? 0) > 0,
    knowsIcp:       !!biz?.knows_icp,
    hasCampaign:    (campaignCount   ?? 0) > 0,
    hasLeads:       (leadsTotal      ?? 0) > 0,
    hasEmail:       !!(biz?.email_settings?.method && biz.email_settings.method !== 'reply_to'),
    hasProposal:    (proposalCount   ?? 0) > 0,
    hasCrm:        false,
  }

  let streak = 0
  if (streakMem?.value_text) {
    try {
      const s = JSON.parse(streakMem.value_text) as { streak: number; last_completed_date: string }
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      if (s.last_completed_date === today || s.last_completed_date === yesterday) {
        streak = s.streak ?? 0
      }
    } catch {}
  }

  const isAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <SetupGuide steps={setupSteps} userName={profile?.name || ''} />
      <DailyBriefCard businessName={business.name} userName={profile?.name || ''} />
      <QuickStatsBar business={business} stats={liveStats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <DailyTasksCard
            tasks={dailyTasks as DailyTask | null}
            businessId={business.id}
            initialStreak={streak}
          />
          <SmartActionsPanel />
        </div>
        <div className="space-y-4">
          <HealthScoreCard score={business?.health_score ?? 0} />
          <GithubWidget />
          <ScoreBreakdownCard scores={scoreBreakdown} />
        </div>
      </div>

      {isAdmin && (
        <div className="border-t border-slate-800/60 pt-6">
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3">Admin Tools</p>
          <PromotionAuditPanel />
        </div>
      )}
    </div>
  )
}
