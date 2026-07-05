import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export interface ActionItem {
  id: string
  title: string
  description: string
  why: string
  benefit: string
  status: 'connected' | 'partial' | 'missing'
  priority: 'critical' | 'high' | 'medium' | 'low'
  link: string
  icon: string
  category: 'revenue' | 'data' | 'communication' | 'social' | 'analytics'
  data_unlocked: string[]  // what AI can do once connected
}

const CACHE_HOURS = 12

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses')
        .select('id, name, industry, country, health_score, integrations, embed_token, social_connections')
        .eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ actions: [], context_db: {} })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const biz = business as any
  const integrations = (biz.integrations as Record<string, unknown>) ?? {}
  const socialConn   = (biz.social_connections as Record<string, unknown>) ?? {}

  // Check what's connected
  const [{ data: crmIntegrations }, { count: leadsCount }, { count: dealsCount }, emailSettingsRes] = await Promise.all([
    supabase.from('integrations').select('type, status, meta_json').eq('business_id', business.id),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('deals').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('businesses').select('integrations').eq('id', business.id).maybeSingle(),
  ])

  const connectedCRMs = (crmIntegrations ?? []).filter(i => ['hubspot','pipedrive'].includes(i.type) && i.status === 'connected')
  const websiteMetrics = integrations.__website_metrics as Record<string, unknown> | undefined
  const hasWebsiteMetrics = !!(websiteMetrics?.paying_customers || websiteMetrics?.mrr)
  const hasSmtp = !!(integrations as Record<string, unknown> & { smtp?: { host?: string } }).smtp?.host
  const hasSocial = Object.keys(socialConn).length > 0
  const hasLinkedIn = !!(socialConn as Record<string, unknown>).linkedin
  const hasEmbedWidget = !!biz.embed_token
  const hasGoals = Array.isArray(integrations.__goals) && (integrations.__goals as unknown[]).length > 0
  const hasTrends = !!(integrations.__trends)

  // Check cache
  const cached = integrations.__smart_actions as { actions: ActionItem[]; generated_at: string } | undefined
  if (cached?.generated_at) {
    const ageH = (Date.now() - new Date(cached.generated_at).getTime()) / 3600000
    if (ageH < CACHE_HOURS) {
      return NextResponse.json({
        actions: cached.actions,
        context_db: buildContextDB(integrations, socialConn, connectedCRMs ?? []),
        cached: true,
      })
    }
  }

  // Build static action items based on connection status
  const staticActions: ActionItem[] = [
    {
      id: 'website_metrics',
      title: 'Connect Website Backend',
      description: 'Push real metrics: paying customers, MRR, DAU, churn rate',
      why: hasWebsiteMetrics
        ? `✓ ${websiteMetrics?.paying_customers ?? '?'} paying customers · $${websiteMetrics?.mrr?.toLocaleString() ?? '?'} MRR synced`
        : 'AI is making guesses about your revenue. Without real metrics, goal suggestions can be completely wrong.',
      benefit: 'Accurate goals, forecasts, and AI insights based on your actual business numbers',
      status: hasWebsiteMetrics ? 'connected' : 'missing',
      priority: hasWebsiteMetrics ? 'low' : 'critical',
      link: '/settings/integrations#ai-context',
      icon: '🔌',
      category: 'data' as const,
      data_unlocked: ['Accurate goal suggestions', 'Real revenue forecasts', 'Churn analysis', 'Growth rate tracking'],
    },
    {
      id: 'crm',
      title: 'Connect Your CRM',
      description: 'Sync deals, contacts and pipeline from HubSpot or Pipedrive',
      why: connectedCRMs.length > 0
        ? `✓ ${connectedCRMs.map(c => c.type).join(', ')} connected · ${leadsCount ?? 0} leads, ${dealsCount ?? 0} deals synced`
        : `You have ${leadsCount ?? 0} leads tracked. CRM sync pulls your full deal history, stages and contact data.`,
      benefit: 'Revenue attribution, pipeline forecasting, and automated lead scoring from real CRM data',
      status: connectedCRMs.length > 0 ? 'connected' : 'missing',
      priority: connectedCRMs.length > 0 ? 'low' : 'high',
      link: '/settings/integrations#crm',
      icon: '🗂️',
      category: 'revenue' as const,
      data_unlocked: ['Deal pipeline sync', 'Win/loss analysis', 'Revenue attribution', 'Auto lead import'],
    },
    {
      id: 'smtp',
      title: 'Connect Your SMTP',
      description: 'Send email campaigns and proposals from your own domain',
      why: hasSmtp
        ? '✓ Email sending configured'
        : 'Without SMTP, emails go out from a shared address or are blocked. Hurts deliverability.',
      benefit: 'Send campaigns, proposals, and lead follow-ups from your own domain with full control',
      status: hasSmtp ? 'connected' : 'missing',
      priority: hasSmtp ? 'low' : 'high',
      link: '/settings/email',
      icon: '📧',
      category: 'communication' as const,
      data_unlocked: ['Email campaigns', 'Proposal delivery', 'Lead follow-up sequences', 'Domain reputation'],
    },
    {
      id: 'social',
      title: 'Connect Social Media',
      description: 'Publish AI-generated posts directly to LinkedIn, Instagram, Facebook',
      why: hasSocial
        ? `✓ ${Object.keys(socialConn).join(', ')} connected`
        : 'AI creates posts for you but can\'t publish without a connected account. Posts sit as drafts.',
      benefit: '1-click publish AI posts. Schedule content. Track engagement per channel.',
      status: hasSocial ? 'connected' : (hasLinkedIn ? 'partial' : 'missing'),
      priority: hasSocial ? 'low' : 'medium',
      link: '/settings/integrations#social',
      icon: '📱',
      category: 'social' as const,
      data_unlocked: ['Auto-publish posts', 'Schedule campaigns', 'Channel performance', 'Engagement tracking'],
    },
    {
      id: 'lead_widget',
      title: 'Add Lead Capture Widget',
      description: 'Embed a chat widget on your website to capture leads 24/7',
      why: hasEmbedWidget
        ? '✓ Widget token ready — add the snippet to your website'
        : 'Every visitor who leaves your site without contacting you is a lost lead.',
      benefit: 'Capture leads from website visitors automatically into your CRM',
      status: hasEmbedWidget ? 'partial' : 'missing',
      priority: 'medium',
      link: '/settings/integrations#lead-capture',
      icon: '💬',
      category: 'data' as const,
      data_unlocked: ['Inbound lead capture', 'Website visitor data', 'Auto lead scoring', '24/7 collection'],
    },
  ]

  // Sort: missing critical first
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  staticActions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  // AI personalization — add business-specific suggestions
  let aiActions: ActionItem[] = []
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const missingItems = staticActions.filter(a => a.status !== 'connected').map(a => a.id)
      const prompt = `You are an AI business advisor. Analyze this business and suggest 2-3 ADDITIONAL integrations or data connections they specifically need beyond the standard ones.

Business: ${biz.name || 'unnamed'} | Industry: ${biz.industry || 'unknown'} | Country: ${biz.country || 'unknown'}
Health score: ${business.health_score ?? 0}/100
Leads: ${leadsCount ?? 0} | Deals: ${dealsCount ?? 0}
Has trends: ${hasTrends} | Has goals: ${hasGoals}
Missing connections: ${missingItems.join(', ')}
Website metrics synced: ${hasWebsiteMetrics}

Based on their industry (${biz.industry}), suggest 2-3 specific integrations or data sources they should connect that are NOT already in this list: [website_metrics, crm, smtp, social, lead_widget].

Examples of what you might suggest for different industries:
- SaaS: "Connect Stripe" for live MRR/churn, "Connect Intercom" for NPS/support data
- E-commerce: "Connect Shopify" for orders/revenue, "Connect Google Analytics" for traffic
- Agency: "Connect Calendly" for meeting data, "Connect Toggl" for time tracking
- Restaurant: "Connect Google Business" for reviews, "Connect reservation system"

Return ONLY a valid JSON array of 2-3 objects:
[{
  "id": "unique_id",
  "title": "Connect [Tool Name]",
  "description": "1 line: what data it provides",
  "why": "Why this specific business in ${biz.industry} needs this",
  "benefit": "What AI can do once connected",
  "status": "missing",
  "priority": "high" | "medium" | "low",
  "link": "/settings/integrations",
  "icon": "emoji",
  "category": "revenue" | "data" | "communication" | "social" | "analytics",
  "data_unlocked": ["item1", "item2", "item3"]
}]
No markdown, JSON array only.`

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
      const match = text.match(/\[[\s\S]*\]/)
      aiActions = JSON.parse(match ? match[0] : text) as ActionItem[]
      if (!Array.isArray(aiActions)) aiActions = []
    } catch { aiActions = [] }
  }

  const allActions = [...staticActions, ...aiActions]
  const now = new Date().toISOString()

  // Cache
  await supabase.from('businesses').update({
    integrations: { ...integrations, __smart_actions: { actions: allActions, generated_at: now } },
  }).eq('id', business.id)

  return NextResponse.json({
    actions: allActions,
    context_db: buildContextDB(integrations, socialConn, connectedCRMs ?? []),
  })
}

function buildContextDB(
  integrations: Record<string, unknown>,
  socialConn: Record<string, unknown>,
  crmIntegrations: { type: string; meta_json?: unknown }[],
) {
  const wm = integrations.__website_metrics as Record<string, unknown> | undefined
  return {
    website_metrics:  wm ? { ...wm, source: wm.source ?? 'manual' } : null,
    crm:              crmIntegrations.length > 0 ? crmIntegrations.map(c => c.type) : null,
    social:           Object.keys(socialConn).length > 0 ? Object.keys(socialConn) : null,
    goals:            Array.isArray(integrations.__goals) ? (integrations.__goals as unknown[]).length : 0,
    trends_cached:    !!(integrations.__trends),
    goals_cached:     Array.isArray(integrations.__goals) && (integrations.__goals as unknown[]).length > 0,
  }
}

// POST — force refresh
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, integrations').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  // Clear cache then re-fetch
  const integrations = (business.integrations as Record<string, unknown>) ?? {}
  const { __smart_actions: _, ...rest } = integrations
  void _
  await supabase.from('businesses').update({ integrations: rest }).eq('id', business.id)

  return NextResponse.json({ ok: true })
}
