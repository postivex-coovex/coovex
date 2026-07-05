import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminMarketingPage() {
  const supabase = await createServiceClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const sevenDaysAgo  = new Date(Date.now() - 7 * 86400000).toISOString()

  const [
    { data: allUsers },
    { data: recentActivity },
    { data: freeleads },
  ] = await Promise.all([
    supabase.from('profiles').select('id, name, email, created_at, onboarding_completed, current_workspace_id').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id').gte('updated_at', sevenDaysAgo),
    supabase.from('free_tool_leads').select('email, tool_used, converted_to_user, created_at').eq('converted_to_user', false).order('created_at', { ascending: false }).limit(100),
  ])

  const activeIds = new Set((recentActivity || []).map(u => u.id))
  const allList = allUsers || []

  const inactiveUsers = allList.filter(u => !activeIds.has(u.id) && u.onboarding_completed)
  const pendingOnboarding = allList.filter(u => !u.onboarding_completed)
  const newThisWeek = allList.filter(u => new Date(u.created_at) >= new Date(sevenDaysAgo))

  // Feature usage gaps — query which features exist in the platform
  const wsIds = allList.map(u => u.current_workspace_id).filter(Boolean)

  let featuresUsage = { posts: 0, leads: 0, campaigns: 0, competitors: 0, proposals: 0 }
  if (wsIds.length > 0) {
    const [
      { data: bizList },
    ] = await Promise.all([
      supabase.from('businesses').select('id, workspace_id').in('workspace_id', wsIds),
    ])
    const bizIds = (bizList || []).map(b => b.id)
    if (bizIds.length > 0) {
      const [
        { count: postsCount },
        { count: leadsCount },
        { count: campaignsCount },
        { count: competitorsCount },
        { count: proposalsCount },
      ] = await Promise.all([
        supabase.from('posts').select('*', { count: 'exact', head: true }).in('business_id', bizIds),
        supabase.from('leads').select('*', { count: 'exact', head: true }).in('business_id', bizIds),
        supabase.from('email_campaigns').select('*', { count: 'exact', head: true }).in('business_id', bizIds),
        supabase.from('competitors').select('*', { count: 'exact', head: true }).in('business_id', bizIds),
        supabase.from('proposals').select('*', { count: 'exact', head: true }).in('business_id', bizIds),
      ])
      featuresUsage = {
        posts:       postsCount ?? 0,
        leads:       leadsCount ?? 0,
        campaigns:   campaignsCount ?? 0,
        competitors: competitorsCount ?? 0,
        proposals:   proposalsCount ?? 0,
      }
    }
  }

  const featureEmailTemplates = [
    {
      feature: 'Content / Posts',
      icon:    '✍️',
      count:   featuresUsage.posts,
      subject: 'Your AI content generator is waiting — create your first post in 30 seconds',
      preview: `Hi [Name], your CooVex workspace is set up but you haven't created any content yet. Our AI can write LinkedIn and Facebook posts in seconds — just give it a topic and it handles the rest.`,
    },
    {
      feature: 'Lead Pipeline',
      icon:    '🎯',
      count:   featuresUsage.leads,
      subject: 'Add your first lead and let AI score them for you',
      preview: `Hi [Name], you're not tracking any leads yet. CooVex can automatically capture, score, and follow up with leads — so no opportunity slips through the cracks.`,
    },
    {
      feature: 'Email Campaigns',
      icon:    '📧',
      count:   featuresUsage.campaigns,
      subject: 'Send your first email campaign — AI writes it for you',
      preview: `Hi [Name], CooVex has a built-in drip campaign builder. Connect your leads and let AI draft personalized follow-up sequences.`,
    },
    {
      feature: 'Competitor Tracking',
      icon:    '🔍',
      count:   featuresUsage.competitors,
      subject: 'Do you know what your competitors are doing right now?',
      preview: `Hi [Name], CooVex can monitor your competitors automatically — tracking their website changes, social activity, and pricing. You haven't added any competitors yet.`,
    },
    {
      feature: 'Proposals',
      icon:    '📋',
      count:   featuresUsage.proposals,
      subject: 'Create professional proposals in 60 seconds with AI',
      preview: `Hi [Name], CooVex can generate customized client proposals instantly. You haven't tried proposals yet — give it a shot.`,
    },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Marketing Automation</h1>
        <p className="text-slate-400 text-sm">Re-engage inactive users and promote unused features</p>
      </div>

      {/* Segment overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Users',         value: allList.length,            color: 'text-white' },
          { label: 'Active (7d)',          value: activeIds.size,            color: 'text-emerald-400' },
          { label: 'Inactive (30d)',       value: inactiveUsers.length,      color: 'text-amber-400' },
          { label: 'Pending Onboarding',   value: pendingOnboarding.length,  color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Inactive users */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-white font-semibold">Inactive Users</h2>
              <p className="text-slate-500 text-xs mt-0.5">No activity in 7+ days</p>
            </div>
            <Link href="/admin/announcements" className="text-xs px-3 py-1.5 bg-violet-700 hover:bg-violet-600 text-white rounded-lg transition-colors">
              Send Campaign →
            </Link>
          </div>
          {inactiveUsers.length === 0 ? (
            <div className="py-10 text-center text-slate-600 text-sm">All users are active 🎉</div>
          ) : (
            <div className="divide-y divide-slate-800/40 max-h-64 overflow-y-auto">
              {inactiveUsers.slice(0, 20).map(u => (
                <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-xs font-bold">
                    {(u.name || u.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 text-sm truncate">{u.name || u.email}</p>
                    <p className="text-slate-600 text-xs">Joined {new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                  <Link href={`/admin/users/${u.id}`} className="text-violet-400 hover:text-violet-300 text-xs">View</Link>
                </div>
              ))}
              {inactiveUsers.length > 20 && (
                <div className="px-5 py-3 text-slate-600 text-xs">+{inactiveUsers.length - 20} more</div>
              )}
            </div>
          )}
        </div>

        {/* Free tool leads not converted */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-white font-semibold">Unconverted Free Tool Leads</h2>
            <p className="text-slate-500 text-xs mt-0.5">Used free tools but didn&apos;t sign up</p>
          </div>
          {(freeleads || []).length === 0 ? (
            <div className="py-10 text-center text-slate-600 text-sm">No unconverted leads</div>
          ) : (
            <div className="divide-y divide-slate-800/40 max-h-64 overflow-y-auto">
              {(freeleads || []).slice(0, 15).map((l, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 text-sm truncate">{l.email}</p>
                    <p className="text-slate-600 text-xs capitalize">{(l.tool_used || '').replace(/_/g, ' ')} · {new Date(l.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feature adoption + email templates */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold">Feature Adoption + Email Templates</h2>
          <p className="text-slate-500 text-xs mt-0.5">Send AI-written emails to users who haven&apos;t used a feature</p>
        </div>
        <div className="divide-y divide-slate-800/40">
          {featureEmailTemplates.map(f => (
            <div key={f.feature} className="px-5 py-4">
              <div className="flex items-start gap-4">
                <span className="text-2xl flex-shrink-0">{f.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-medium text-sm">{f.feature}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${f.count === 0 ? 'bg-red-950/60 text-red-400' : 'bg-emerald-950/60 text-emerald-400'}`}>
                      {f.count === 0 ? 'Not used' : `${f.count} records`}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs font-medium mb-0.5">Subject: {f.subject}</p>
                  <p className="text-slate-600 text-xs line-clamp-2">{f.preview}</p>
                </div>
                <Link
                  href="/admin/announcements"
                  className="px-3 py-1.5 border border-slate-700 hover:border-violet-500 hover:text-violet-400 text-slate-400 text-xs rounded-lg transition-colors flex-shrink-0"
                >
                  Use Template
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
