import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readBusinessContext } from '@/lib/agent/sync-memory'
import Anthropic from '@anthropic-ai/sdk'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id, name').eq('id', user.id).single()
  const { data: business } = await supabase
    .from('businesses').select('id, name, industry, health_score')
    .eq('workspace_id', profile?.current_workspace_id).maybeSingle()
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  // Read from agent_memory — synced by Agent Inbox page load
  const ctx = await readBusinessContext(business.id)

  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  // Fallback stats if memory not yet synced
  const urgentCount = ctx ? 0 : 0 // signals are shown separately
  const newLeads = ctx?.leads.new_7d ?? 0
  const newReviews = ctx?.reviews.unanswered ?? 0
  const activeProducts = ctx?.products.active ?? []
  const auditScore = ctx?.audit?.latest_score ?? null

  const apiKey = process.env.ANTHROPIC_API_KEY
  let brief = `Good morning! Here's your ${dayName} snapshot for ${business.name}: health score ${business.health_score}/100, ${newLeads} new leads this week, ${newReviews} reviews waiting. Focus on your top 3 tasks to move the needle today.`

  if (apiKey && ctx) {
    try {
      const client = new Anthropic({ apiKey })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const productLines = activeProducts.map((p: any) =>
        `  • ${p.name} (${p.type})${p.price ? ` — ${p.price}` : ''}${p.tagline ? ` — "${p.tagline}"` : ''}`
      ).join('\n')

      const stageBreakdown = Object.entries(ctx.leads.by_stage)
        .map(([s, n]) => `${s}: ${n}`).join(', ')

      const auditLine = ctx.audit
        ? `Audit score: ${ctx.audit.latest_score}/100 (${ctx.audit.grade ?? '—'}). Critical issues: ${ctx.audit.critical_issues.slice(0, 2).join('; ') || 'none'}`
        : 'No audit run yet'

      const integrationLine = ctx.integrations.connected.length > 0
        ? `Connected channels: ${ctx.integrations.connected.join(', ')}`
        : 'No channels connected yet'

      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 280,
        messages: [{
          role: 'user',
          content: `Write a 2-3 sentence motivating morning brief for a business owner. Be specific, data-driven, and actionable. Today is ${dayName}.

FULL BUSINESS CONTEXT (from AI agent memory):
Business: ${ctx.business.name} (${ctx.business.industry}, ${ctx.business.country})
Health Score: ${ctx.business.health_score}/100
Description: ${ctx.business.description || '—'}
Target: ${ctx.business.target_customer}

LEADS (${ctx.leads.total} total):
  New this week: ${ctx.leads.new_7d} | This month: ${ctx.leads.new_30d}
  Hot leads (score 70+): ${ctx.leads.hot_count}
  By stage: ${stageBreakdown || 'none'}

REVIEWS: ${ctx.reviews.total} total | Avg rating: ${ctx.reviews.avg_rating ?? '—'}/5 | Unanswered: ${ctx.reviews.unanswered} | Negative unanswered: ${ctx.reviews.negative_unanswered}

PIPELINE: ${ctx.pipeline.open_deals} open deals | Value: $${ctx.pipeline.total_value.toLocaleString()}

CONTENT (30d): ${ctx.content.published_30d} published | ${ctx.content.drafts_pending} drafts pending | Active channels: ${ctx.content.channels_active.join(', ') || 'none'}

${auditLine}
${integrationLine}
Task completion rate (7d): ${ctx.tasks.completion_rate_7d !== null ? `${ctx.tasks.completion_rate_7d}%` : 'no data'}

${activeProducts.length > 0 ? `PRODUCTS/SERVICES (${activeProducts.length} active):\n${productLines}` : 'No products added yet'}

${ctx.competitors.length > 0 ? `Competitors tracked: ${ctx.competitors.map((c: { name: string }) => c.name).join(', ')}` : ''}

${ctx.business.website_intel ? `Website intel: services = ${(ctx.business.website_intel as Record<string, string[]>).services?.slice(0, 3).join(', ') || '—'}` : ''}

Write a SPECIFIC brief that references real numbers from the context above. Prioritize the most critical thing to act on today. Speak directly to the owner. Do NOT say "here is your brief".`,
        }],
      })
      if (msg.content[0].type === 'text') brief = msg.content[0].text.trim()
    } catch {
      // use fallback
    }
  }

  return NextResponse.json({
    brief,
    stats: {
      urgentCount,
      newLeads,
      newReviews,
      products: activeProducts.length,
      auditScore,
      hotLeads: ctx?.leads.hot_count ?? 0,
      pipelineValue: ctx?.pipeline.total_value ?? 0,
    },
  })
}
