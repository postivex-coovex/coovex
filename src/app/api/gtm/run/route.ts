import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/credits'

export const maxDuration = 120

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const service  = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('*').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business found' }, { status: 400 })

  const { ok, balance } = await deductCredits(user.id, 'gtm_autopilot', 'GTM Autopilot run')
  if (!ok) return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const biz = business as any
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // ── Step 1: Lead pipeline stats ──────────────────────────────────────────────
  const [{ count: newLeads }, { count: totalLeads }, { count: hotLeads }] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', sevenDaysAgo),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id).gte('score', 70),
  ])

  // ── Step 2: Content stats ────────────────────────────────────────────────────
  const { count: draftCount } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', business.id).eq('status', 'draft')
  const { count: scheduledCount } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', business.id).eq('status', 'scheduled')

  // ── Step 3: Competitor count + latest insight ────────────────────────────────
  const { count: compCount } = await supabase.from('competitors').select('*', { count: 'exact', head: true }).eq('business_id', business.id)
  const { data: latestComp } = await supabase.from('competitors').select('name, updated_at').eq('business_id', business.id).order('updated_at', { ascending: false }).limit(1).maybeSingle()

  // ── Step 4: GEO content gaps ─────────────────────────────────────────────────
  const { data: geoMem } = await service.from('agent_memory').select('value_text').eq('business_id', business.id).eq('key', 'geo_intelligence').maybeSingle()
  let contentGapsCount = 0
  let highImpactGaps = 0
  if (geoMem?.value_text) {
    try {
      const geo = JSON.parse(geoMem.value_text)
      contentGapsCount = geo.content_gaps?.length ?? 0
      highImpactGaps = (geo.content_gaps ?? []).filter((g: { impact: string }) => g.impact === 'high').length
    } catch {}
  }

  // ── Step 5: AI GTM brief ─────────────────────────────────────────────────────
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `You are a GTM strategist. Given this business snapshot, write 3 specific GTM action items for this week. Be concrete and actionable (not generic).

Business: ${biz.name || 'Unknown'} | Industry: ${biz.industry || 'Unknown'} | Website: ${biz.website_url || 'N/A'}
Leads: ${totalLeads ?? 0} total, ${newLeads ?? 0} new this week, ${hotLeads ?? 0} hot (score ≥70)
Content: ${draftCount ?? 0} drafts, ${scheduledCount ?? 0} scheduled posts
Competitors tracked: ${compCount ?? 0}${latestComp ? ` (latest: ${latestComp.name})` : ''}
GEO content gaps: ${contentGapsCount} identified, ${highImpactGaps} high impact

Return EXACTLY this JSON (no markdown):
{"actions":[{"title":"...","detail":"...","priority":"high"|"medium","link":"/leads"|"/content"|"/competitors"|"/geo"|"/campaigns"},...3 items]}`
    }],
  })

  let gtmActions: { title: string; detail: string; priority: 'high' | 'medium'; link: string }[] = []
  try {
    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '{}'
    const parsed = JSON.parse(text)
    gtmActions = parsed.actions ?? []
  } catch {}

  // ── Step 6: Create Agent Inbox signal ────────────────────────────────────────
  const inboxBody = [
    `📊 ${newLeads ?? 0} new leads this week · ${hotLeads ?? 0} hot leads ready to contact`,
    `✍️ ${draftCount ?? 0} content drafts pending · ${scheduledCount ?? 0} scheduled`,
    compCount ? `🏆 ${compCount} competitors monitored` : null,
    contentGapsCount > 0 ? `🧠 ${highImpactGaps} high-impact content gaps identified` : null,
  ].filter(Boolean).join('\n')

  await service.from('agent_signals').insert({
    business_id: business.id,
    type: 'insight',
    title: '🚀 GTM Autopilot Run Complete',
    body: inboxBody,
    action_label: 'View GTM Dashboard',
    action_url: '/gtm-agent',
  })

  // ── Step 7: Save last run to memory ──────────────────────────────────────────
  const runRecord = {
    ran_at: now.toISOString(),
    new_leads: newLeads ?? 0,
    total_leads: totalLeads ?? 0,
    hot_leads: hotLeads ?? 0,
    draft_posts: draftCount ?? 0,
    scheduled_posts: scheduledCount ?? 0,
    competitors: compCount ?? 0,
    content_gaps: contentGapsCount,
    high_impact_gaps: highImpactGaps,
    actions: gtmActions,
  }

  await service.from('agent_memory').upsert(
    { business_id: business.id, key: 'gtm_last_run', value_text: JSON.stringify(runRecord), updated_at: now.toISOString() },
    { onConflict: 'business_id,key' }
  )

  return NextResponse.json(
    { ok: true, ...runRecord },
    { headers: { 'X-Credits-Remaining': String(balance) } }
  )
}

export async function GET() {
  const supabase = await createClient()
  const service  = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ lastRun: null })

  const { data: mem } = await service.from('agent_memory').select('value_text').eq('business_id', business.id).eq('key', 'gtm_last_run').maybeSingle()
  const lastRun = mem?.value_text ? JSON.parse(mem.value_text) : null
  return NextResponse.json({ lastRun })
}
