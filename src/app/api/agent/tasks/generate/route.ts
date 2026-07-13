import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST() {
  const supabase = await createClient()
  const service  = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = await supabase
    .from('businesses').select('id, name, industry, health_score')
    .eq('workspace_id', profile?.current_workspace_id ?? '').maybeSingle()
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const today = new Date().toISOString().split('T')[0]

  // Return existing tasks if already generated today
  const { data: existing } = await supabase
    .from('daily_tasks').select('*').eq('business_id', business.id).eq('date', today).maybeSingle()
  if (existing && (existing.tasks_json as unknown[]).length > 0) {
    return NextResponse.json({ tasks: existing })
  }

  // ── Fetch real data from 3 sources in parallel ──────────────────────────────
  const [
    { data: latestAudit },
    { data: pendingSignals },
    { data: draftPosts },
    { data: gtmMem },
    { data: geoMem },
  ] = await Promise.all([
    supabase.from('audits')
      .select('score, report_json, created_at')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('agent_signals')
      .select('id, type, title, body, action_data_json')
      .eq('business_id', business.id)
      .eq('dismissed', false)
      .in('type', ['task', 'opportunity', 'warning'])
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('posts')
      .select('id, title, type, platform')
      .eq('business_id', business.id)
      .in('status', ['draft', 'scheduled'])
      .order('created_at', { ascending: false })
      .limit(3),
    service.from('agent_memory')
      .select('value_text, updated_at')
      .eq('business_id', business.id)
      .eq('key', 'gtm_last_run')
      .maybeSingle(),
    service.from('agent_memory')
      .select('value_text')
      .eq('business_id', business.id)
      .eq('key', 'geo_intelligence')
      .maybeSingle(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const auditReport = latestAudit?.report_json as any
  const criticalIssues: Array<{ title: string }> = (auditReport?.issues ?? []).filter(
    (i: { severity: string }) => i.severity === 'critical'
  ).slice(0, 2)

  const gtmLastRunAt = gtmMem?.updated_at ? new Date(gtmMem.updated_at) : null
  const gtmDaysAgo = gtmLastRunAt
    ? Math.floor((Date.now() - gtmLastRunAt.getTime()) / 86400000)
    : null

  let geoGaps: string[] = []
  if (geoMem?.value_text) {
    try {
      const geo = JSON.parse(geoMem.value_text)
      geoGaps = (geo.content_gaps ?? [])
        .filter((g: { impact: string }) => g.impact === 'high')
        .slice(0, 3)
        .map((g: { suggestion?: string; type: string }) => g.suggestion || g.type)
    } catch {}
  }

  // ── Build 3 tasks deterministically ─────────────────────────────────────────

  // TASK 1 — AUDIT
  let task1: Record<string, unknown>
  if (!latestAudit) {
    task1 = {
      id: 'audit-run',
      title: 'Run your Website Audit',
      description: 'AI scans your site for SEO, GEO, and performance issues. Takes 30 seconds, costs 10 credits.',
      source: 'audit',
      priority: 'critical',
      action_type: 'link',
      action_data: { url: '/audit' },
      completed: false,
    }
  } else if (criticalIssues.length > 0) {
    task1 = {
      id: 'audit-fix',
      title: `Fix: ${criticalIssues[0].title}`,
      description: criticalIssues.length > 1
        ? `+${criticalIssues.length - 1} more critical issues in your audit`
        : 'Critical issue found in your website audit',
      source: 'audit',
      priority: 'high',
      action_type: 'link',
      action_data: { url: '/audit' },
      completed: false,
    }
  } else {
    const auditAgeDays = latestAudit?.created_at
      ? Math.floor((Date.now() - new Date(latestAudit.created_at).getTime()) / 86400000)
      : 0
    task1 = {
      id: 'audit-refresh',
      title: auditAgeDays > 14
        ? 'Refresh your website audit (14 days old)'
        : `Audit score: ${latestAudit.score}/100 — check recommendations`,
      description: `Your website health score is ${latestAudit.score}/100. Review any open recommendations.`,
      source: 'audit',
      priority: 'medium',
      action_type: 'link',
      action_data: { url: '/audit' },
      completed: false,
    }
  }

  // TASK 2 — GTM / AGENT
  let task2: Record<string, unknown>
  const topSignal = pendingSignals?.[0]
  if (topSignal) {
    const signalUrl = (topSignal.action_data_json as Record<string, string> | null)?.url ?? '/agent/inbox'
    task2 = {
      id: `signal-${topSignal.id}`,
      title: topSignal.title,
      description: topSignal.body?.slice(0, 100) ?? '',
      source: 'gtm',
      priority: 'high',
      action_type: 'link',
      action_data: { url: signalUrl },
      completed: false,
    }
  } else if (gtmDaysAgo === null || gtmDaysAgo > 7) {
    task2 = {
      id: 'gtm-run',
      title: gtmDaysAgo === null
        ? 'Run GTM Autopilot — find leads + check AI visibility'
        : `Run GTM Autopilot — ${gtmDaysAgo} days since last run`,
      description: 'One click: AI finds leads, checks Gemini visibility, and gives you 3 action items. 30 credits.',
      source: 'gtm',
      priority: 'high',
      action_type: 'link',
      action_data: { url: '/gtm-agent' },
      completed: false,
    }
  } else {
    task2 = {
      id: 'gtm-inbox',
      title: 'Review Agent Inbox for new opportunities',
      description: 'Check what your AI agent discovered and take action on open signals.',
      source: 'gtm',
      priority: 'medium',
      action_type: 'link',
      action_data: { url: '/agent/inbox' },
      completed: false,
    }
  }

  // TASK 3 — CONTENT
  let task3: Record<string, unknown>
  const topDraft = draftPosts?.[0]
  if (topDraft) {
    const platform = topDraft.platform ?? topDraft.type ?? 'Blog'
    const displayPlatform = String(platform).charAt(0).toUpperCase() + String(platform).slice(1)
    task3 = {
      id: `publish-${topDraft.id}`,
      title: `Publish "${topDraft.title?.slice(0, 45) ?? 'your draft'}" to ${displayPlatform}`,
      description: `You have ${draftPosts!.length} draft${draftPosts!.length > 1 ? 's' : ''} ready. Publish today to stay consistent.`,
      source: 'content',
      priority: 'medium',
      action_type: 'link',
      action_data: { url: '/content' },
      completed: false,
    }
  } else if (geoGaps.length > 0) {
    task3 = {
      id: 'content-geo',
      title: `Write: ${geoGaps[0]}`,
      description: 'This topic has high GEO impact — publishing it will boost your Gemini AI visibility.',
      source: 'content',
      priority: 'medium',
      action_type: 'link',
      action_data: { url: '/content/ideas' },
      completed: false,
    }
  } else {
    task3 = {
      id: 'content-create',
      title: 'Create one piece of content today',
      description: 'Consistent content builds GEO authority and keeps your audience engaged.',
      source: 'content',
      priority: 'low',
      action_type: 'link',
      action_data: { url: '/content' },
      completed: false,
    }
  }

  const tasks = [task1, task2, task3]

  const { data: row, error } = await supabase
    .from('daily_tasks')
    .upsert({
      business_id: business.id,
      date: today,
      tasks_json: tasks,
      total_count: 3,
      completed_count: 0,
    }, { onConflict: 'business_id,date' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tasks: row })
}
