import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { syncBusinessMemory } from '@/lib/agent/sync-memory'
import { HealthScoreCard } from '@/components/dashboard/health-score-card'
import { DailyBriefCard } from '@/components/dashboard/daily-brief-card'
import { SetupGuide } from '@/components/dashboard/setup-guide'
import { KanbanBoard } from '@/components/dashboard/kanban-board'
import { GithubWidget } from '@/components/dashboard/github-widget'
import { PromotionAuditPanel } from './promotion-audit-panel'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
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

  const [
    { count: productCount },
    { count: proposalCount },
    { count: competitorCount },
    { count: leadsTotal },
    { data: geoData },
    { data: memKeys },
  ] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id),
    supabase.from('proposals').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id),
    supabase.from('competitors').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id),
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id),
    supabase.from('geo').select('llms_txt, structured_data, geo_score')
      .eq('business_id', business.id).maybeSingle(),
    service.from('agent_memory').select('key')
      .eq('business_id', business.id)
      .in('key', ['geo_intelligence', 'marketing_plan']),
  ])

  const foundMemKeys = (memKeys ?? []).map((r: { key: string }) => r.key)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const biz = business as any

  const setupSteps = {
    hasProfile:      !!(biz.name && biz.website_url),
    hasProducts:     (productCount    ?? 0) > 0,
    hasGeoScan:      !!geoData,
    hasCompetitors:  (competitorCount ?? 0) > 0,
    hasIntelligence: foundMemKeys.includes('geo_intelligence'),
    hasGenerators:   !!(geoData?.llms_txt || geoData?.structured_data),
    hasGtm:          foundMemKeys.includes('marketing_plan'),
    hasLeads:        (leadsTotal      ?? 0) > 0,
    hasProposal:     (proposalCount   ?? 0) > 0,
  }

  const isAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <DailyBriefCard businessName={business.name} userName={profile?.name || ''} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left — main content */}
        <div className="lg:col-span-2 space-y-5">
          <SetupGuide steps={setupSteps} userName={profile?.name || ''} />
          <KanbanBoard />
        </div>

        {/* Right — sidebar */}
        <div className="space-y-4">
          <HealthScoreCard score={business?.health_score ?? 0} />
          <GithubWidget />
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
