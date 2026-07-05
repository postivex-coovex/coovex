import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

type SignalType = 'urgent' | 'warning' | 'opportunity' | 'done' | 'insight'
type ActionType = 'none' | 'view_lead' | 'respond_review' | 'approve_post' | 'view_report' | 'open_chat' | 'open_url'

interface GeneratedSignal {
  type: SignalType
  title: string
  body: string
  action_label?: string
  action_type: ActionType
  action_data_json?: Record<string, unknown>
}

const COOLDOWN_HOURS = 6

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, industry, health_score, website_intel, integrations, social_connections')
    .eq('workspace_id', profile?.current_workspace_id ?? '')
    .maybeSingle()
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  // Cooldown: skip if signals generated recently
  const cooldownAt = new Date(Date.now() - COOLDOWN_HOURS * 3600000).toISOString()
  const { count: recentCount } = await supabase
    .from('agent_signals')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', business.id)
    .gte('created_at', cooldownAt)

  if ((recentCount ?? 0) >= 3) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'cooldown' })
  }

  // Gather real business context from DB
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const [
    { data: newLeads },
    { data: hotLeads },
    { data: stuckLeads },
    { data: negReviews },
    { data: unansweredReviews },
    { data: latestAudit },
    { data: drafts },
    { data: products },
    { count: leadsTotal },
    { data: campaigns },
    { data: deals },
  ] = await Promise.all([
    supabase.from('leads').select('id, name, company, stage, score, source, created_at')
      .eq('business_id', business.id).gte('created_at', sevenDaysAgo).order('score', { ascending: false }).limit(10),
    supabase.from('leads').select('id, name, company, score, stage')
      .eq('business_id', business.id).gte('score', 70).neq('stage', 'won').neq('stage', 'lost').limit(5),
    supabase.from('leads').select('id, name, company, stage, updated_at')
      .eq('business_id', business.id).lte('updated_at', sevenDaysAgo).neq('stage', 'won').neq('stage', 'lost').limit(5),
    supabase.from('reviews').select('id, platform, rating, text, created_at')
      .eq('business_id', business.id).lte('rating', 3).eq('status', 'new').limit(5),
    supabase.from('reviews').select('id, platform, rating, created_at')
      .eq('business_id', business.id).eq('status', 'new').limit(10),
    supabase.from('audits').select('score, issues_json, created_at')
      .eq('business_id', business.id).order('created_at', { ascending: false }).limit(1),
    supabase.from('posts').select('id, content, channel, created_at')
      .eq('business_id', business.id).eq('status', 'draft').limit(5),
    supabase.from('products').select('id, name, status').eq('business_id', business.id).limit(10),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('email_campaigns').select('id, name, status, open_rate, created_at')
      .eq('business_id', business.id).gte('created_at', thirtyDaysAgo).limit(5),
    supabase.from('deals').select('id, name, value, stage').eq('business_id', business.id).eq('stage', 'open').limit(10),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const biz = business as any
  const intel = biz.website_intel as Record<string, unknown> | null
  const integrations = (biz.integrations as Record<string, unknown>) ?? {}
  const hasSmtp = !!(integrations as Record<string, { host?: string }>).smtp?.host
  const hasSocial = Object.keys((biz.social_connections as Record<string, unknown>) ?? {}).length > 0
  const hasProducts = (products ?? []).length > 0
  const auditScore = latestAudit?.[0]?.score ?? null
  const pipelineValue = (deals ?? []).reduce((s, d) => s + (Number(d.value) || 0), 0)

  // Build rule-based signals (always included if conditions met)
  const staticSignals: GeneratedSignal[] = []

  // Negative reviews need urgent response
  if ((negReviews ?? []).length > 0) {
    const r = negReviews![0]
    staticSignals.push({
      type: 'urgent',
      title: `${(negReviews!).length} negative review${negReviews!.length > 1 ? 's' : ''} need a response`,
      body: `A ${r.rating}★ review on ${r.platform} is unanswered. Responding within 24h increases trust and shows professionalism.`,
      action_label: 'Respond now',
      action_type: 'respond_review',
    })
  }

  // Hot leads sitting idle
  if ((hotLeads ?? []).length > 0) {
    const lead = hotLeads![0]
    staticSignals.push({
      type: 'opportunity',
      title: `${hotLeads!.length} high-score lead${hotLeads!.length > 1 ? 's' : ''} ready to convert`,
      body: `${lead.name}${lead.company ? ' at ' + lead.company : ''} has a score of ${lead.score}+ and is still in "${lead.stage}". Follow up now while interest is high.`,
      action_label: 'View lead',
      action_type: 'view_lead',
      action_data_json: { lead_id: lead.id },
    })
  }

  // Leads stuck for 7+ days
  if ((stuckLeads ?? []).length > 0) {
    staticSignals.push({
      type: 'warning',
      title: `${stuckLeads!.length} lead${stuckLeads!.length > 1 ? 's' : ''} haven't moved in 7+ days`,
      body: `These leads are at risk of going cold. A quick follow-up email or call could revive them. Pipeline value at risk: $${pipelineValue.toLocaleString()}.`,
      action_label: 'View leads',
      action_type: 'view_lead',
    })
  }

  // Draft posts waiting for approval
  if ((drafts ?? []).length > 0) {
    staticSignals.push({
      type: 'insight',
      title: `${drafts!.length} content draft${drafts!.length > 1 ? 's' : ''} ready to publish`,
      body: `AI has prepared ${drafts!.length} post${drafts!.length > 1 ? 's' : ''} for you. Review and publish to maintain your content schedule.`,
      action_label: 'Review drafts',
      action_type: 'approve_post',
    })
  }

  // Low audit score
  if (auditScore !== null && auditScore < 60) {
    staticSignals.push({
      type: 'warning',
      title: `Website health score is ${auditScore}/100 — needs attention`,
      body: 'Your site has critical issues affecting SEO and conversions. Fixing the top issues can improve lead generation within days.',
      action_label: 'View audit',
      action_type: 'view_report',
    })
  }

  // No products added
  if (!hasProducts) {
    staticSignals.push({
      type: 'insight',
      title: 'Add your products and services to unlock AI features',
      body: 'Without product data, AI cannot generate targeted content, calculate lead scores, or suggest pricing strategies.',
      action_label: 'Add products',
      action_type: 'open_url',
      action_data_json: { url: '/products' },
    })
  }

  // No SMTP
  if (!hasSmtp) {
    staticSignals.push({
      type: 'warning',
      title: 'Email sending is not configured',
      body: 'Without SMTP, campaigns go out from a shared domain and may land in spam. Set up your own domain email for better deliverability.',
      action_label: 'Set up email',
      action_type: 'open_url',
      action_data_json: { url: '/settings/email' },
    })
  }

  // AI-generated signals for business-specific insights
  let aiSignals: GeneratedSignal[] = []
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const context = [
        `Business: ${business.name} (${business.industry})`,
        `Health score: ${business.health_score}/100`,
        `Total leads: ${leadsTotal ?? 0}`,
        `New leads (7d): ${(newLeads ?? []).length}`,
        `Unanswered reviews: ${(unansweredReviews ?? []).length}`,
        `Audit score: ${auditScore ?? 'not run'}`,
        `Active products: ${(products ?? []).filter(p => p.status === 'active').length}`,
        `Open deals: ${(deals ?? []).length} worth $${pipelineValue.toLocaleString()}`,
        `Campaigns (30d): ${(campaigns ?? []).length}`,
        `Has social: ${hasSocial}`,
        intel ? `Services: ${(intel.services as string[] | undefined)?.join(', ')}` : '',
        intel ? `Target customers: ${intel.target_customers || '—'}` : '',
      ].filter(Boolean).join('\n')

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `You are an AI business advisor analyzing a business and generating 2-3 actionable agent signals (notifications/insights).

Business context:
${context}

Generate 2-3 specific, data-driven signals that are NOT already covered by these topics (we already have signals for these if conditions are met): negative reviews, hot leads, stuck leads, draft posts, audit score, no products, no SMTP.

Focus on: industry-specific opportunities, growth patterns, missing features for their stage, competitive risks, revenue opportunities.

Return ONLY a valid JSON array:
[{
  "type": "urgent" | "warning" | "opportunity" | "insight",
  "title": "short specific title (max 70 chars)",
  "body": "2 sentence specific insight with actionable advice",
  "action_label": "Button text (optional, max 20 chars)",
  "action_type": "none" | "open_url",
  "action_data_json": { "url": "/relevant-page" }
}]
No markdown, JSON only.`,
        }],
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
      const match = text.match(/\[[\s\S]*\]/)
      aiSignals = match ? JSON.parse(match[0]) as GeneratedSignal[] : []
      if (!Array.isArray(aiSignals)) aiSignals = []
    } catch { aiSignals = [] }
  }

  // Combine: prioritize static, add AI signals (limit total to 8)
  const allSignals = [...staticSignals, ...aiSignals].slice(0, 8)

  if (allSignals.length === 0) return NextResponse.json({ ok: true, inserted: 0 })

  const rows = allSignals.map(s => ({
    business_id: business.id,
    type: s.type,
    title: s.title,
    body: s.body,
    action_label: s.action_label ?? null,
    action_type: s.action_type,
    action_data_json: s.action_data_json ?? null,
    dismissed: false,
  }))

  const { error } = await supabase.from('agent_signals').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, inserted: rows.length })
}
