import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, name, health_score').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ events: [], summary: null, week: null })

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
  const todayIso = todayStart.toISOString()
  const weekIso  = sevenDaysAgo.toISOString()

  const service = createServiceClient()

  const [
    { data: todaySignals },
    { data: todayPosts },
    { data: todayLeads },
    { data: todayReviews },
    { data: weekSignals },
    { data: weekPosts },
    { data: weekLeads },
    { data: weekCampaigns },
    { data: weekProposals },
    { data: allLeads },
    { data: products },
    { data: activityLogs },
    { data: todayMemory },
  ] = await Promise.all([
    supabase.from('agent_signals').select('title, body, type, action_label, created_at').eq('business_id', business.id).gte('created_at', todayIso).order('created_at', { ascending: true }),
    supabase.from('posts').select('content, status, channel, created_at').eq('business_id', business.id).gte('created_at', todayIso).order('created_at', { ascending: true }),
    supabase.from('leads').select('name, company, stage, lead_score, source, created_at').eq('business_id', business.id).gte('created_at', todayIso).order('created_at', { ascending: true }),
    supabase.from('reviews').select('platform, rating, sentiment, created_at').eq('business_id', business.id).gte('created_at', todayIso).order('created_at', { ascending: true }),
    supabase.from('agent_signals').select('type, created_at').eq('business_id', business.id).gte('created_at', weekIso),
    supabase.from('posts').select('status, created_at').eq('business_id', business.id).gte('created_at', weekIso),
    supabase.from('leads').select('stage, created_at').eq('business_id', business.id).gte('created_at', weekIso),
    supabase.from('email_campaigns').select('status, sent_count, created_at').eq('business_id', business.id).eq('status', 'sent').gte('created_at', weekIso),
    supabase.from('proposals').select('status, view_count, created_at').eq('business_id', business.id).gte('created_at', weekIso),
    supabase.from('leads').select('stage').eq('business_id', business.id),
    supabase.from('products').select('id, name, status').eq('business_id', business.id).eq('status', 'active'),
    service.from('agent_activity_log').select('action_type, executed_by, executed_at').eq('workspace_id', profile?.current_workspace_id ?? '').gte('executed_at', weekIso),
    service.from('agent_memory').select('updated_at').eq('business_id', business.id).eq('key', 'business_context').maybeSingle(),
  ])

  type AgentEvent = {
    time: string
    type: 'signal' | 'lead' | 'post' | 'review' | 'system'
    icon: string
    title: string
    detail: string
    color: string
  }

  const events: AgentEvent[] = []
  const SIGNAL_META: Record<string, { icon: string; color: string }> = {
    urgent:      { icon: '❗', color: 'text-red-400' },
    warning:     { icon: '⚠️', color: 'text-amber-400' },
    opportunity: { icon: '💡', color: 'text-emerald-400' },
    done:        { icon: '✅', color: 'text-violet-400' },
    info:        { icon: '📊', color: 'text-blue-400' },
    insight:     { icon: '🧠', color: 'text-violet-400' },
  }

  for (const s of todaySignals ?? []) {
    const m = SIGNAL_META[s.type] ?? { icon: '🔔', color: 'text-slate-400' }
    events.push({ time: s.created_at, type: 'signal', icon: m.icon, title: s.title, detail: s.body ?? s.action_label ?? s.type, color: m.color })
  }

  for (const p of todayPosts ?? []) {
    const preview = (p.content ?? 'Untitled').slice(0, 55).replace(/\n/g, ' ') + '…'
    events.push({ time: p.created_at, type: 'post', icon: p.status === 'published' ? '📢' : '✍️', title: `Content ${p.status === 'published' ? 'published' : 'drafted'}`, detail: `${p.channel} · "${preview}"`, color: 'text-blue-400' })
  }

  for (const l of todayLeads ?? []) {
    events.push({ time: l.created_at, type: 'lead', icon: '👤', title: `New lead captured: ${l.name}${l.company ? ' @ ' + l.company : ''}`, detail: `Source: ${l.source ?? 'manual'} · Score: ${l.lead_score ?? '–'} · Stage: ${l.stage}`, color: 'text-emerald-400' })
  }

  for (const r of todayReviews ?? []) {
    events.push({ time: r.created_at, type: 'review', icon: r.rating >= 4 ? '⭐' : '⚠️', title: `New ${r.rating}★ review on ${r.platform}`, detail: `Sentiment: ${r.sentiment ?? 'unknown'} · Rating: ${r.rating}/5`, color: r.rating >= 4 ? 'text-amber-400' : 'text-red-400' })
  }

  // Show morning brief event only if AI memory was synced today
  const memorySyncedToday = todayMemory?.updated_at && new Date(todayMemory.updated_at) >= todayStart
  if (memorySyncedToday) {
    const briefTime = new Date(todayMemory?.updated_at ?? todayIso)
    events.unshift({ time: briefTime.toISOString(), type: 'system', icon: '🌅', title: 'AI memory synced', detail: `Health score: ${business.health_score}/100 · Business context updated`, color: 'text-violet-400' })
  }

  events.sort((a, b) => a.time.localeCompare(b.time))

  // Summary — today
  const wonLeads   = (allLeads ?? []).filter(l => l.stage === 'won').length
  const totalLeads = (allLeads ?? []).length
  const summary = {
    signals_today:   (todaySignals ?? []).length,
    leads_today:     (todayLeads ?? []).length,
    posts_today:     (todayPosts ?? []).length,
    posts_published: (todayPosts ?? []).filter(p => p.status === 'published').length,
    reviews_today:   (todayReviews ?? []).length,
    health_score:    business.health_score ?? 0,
    won_rate:        totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0,
    total_leads:     totalLeads,
  }

  // Week summary
  const weekSignalCount   = (weekSignals ?? []).length
  const weekPostCount     = (weekPosts ?? []).length
  const weekLeadCount     = (weekLeads ?? []).length
  const weekCampaignCount = (weekCampaigns ?? []).length
  const weekProposalCount = (weekProposals ?? []).length
  const weekProposalViews = (weekProposals ?? []).reduce((s, p) => s + (p.view_count ?? 0), 0)
  const weekEmailsSent    = (weekCampaigns ?? []).reduce((s, c) => s + (c.sent_count ?? 0), 0)
  const weekUrgent        = (weekSignals ?? []).filter(s => s.type === 'urgent' || s.type === 'warning').length

  // Time saved — based on actual logged actions (minutes per action type)
  const TIME_PER_ACTION: Record<string, number> = {
    respond_review: 15,
    approve_post:   20,
    view_lead:      10,
    user_bulk:       8,
  }
  const loggedMinutes = (activityLogs ?? []).reduce((sum, log) => {
    return sum + (TIME_PER_ACTION[log.action_type] ?? 8)
  }, 0)
  // Fallback estimate from signal/post/lead counts when no logs yet
  const fallbackMinutes = weekSignalCount * 5 + weekPostCount * 20 + weekLeadCount * 8 +
    weekCampaignCount * 30 + weekProposalCount * 45
  const minutesSaved = loggedMinutes > 0 ? loggedMinutes : fallbackMinutes

  const logsThisWeek    = activityLogs ?? []
  const actionsExecuted = logsThisWeek.length
  const autoExecuted    = logsThisWeek.filter(l => l.executed_by === 'agent').length
  const userExecuted    = logsThisWeek.filter(l => l.executed_by !== 'agent').length

  const week = {
    signals: weekSignalCount,
    posts:   weekPostCount,
    leads:   weekLeadCount,
    campaigns: weekCampaignCount,
    proposals: weekProposalCount,
    proposal_views: weekProposalViews,
    emails_sent:    weekEmailsSent,
    urgent_signals: weekUrgent,
    minutes_saved:  minutesSaved,
    active_products: (products ?? []).length,
    actions_executed: actionsExecuted,
    auto_executed:    autoExecuted,
    user_executed:    userExecuted,
  }

  return NextResponse.json({ events, summary, week })
}
