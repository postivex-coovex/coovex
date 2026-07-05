import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readBusinessContext } from '@/lib/agent/sync-memory'
import Anthropic from '@anthropic-ai/sdk'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = await supabase
    .from('businesses').select('id, name, industry, health_score, target_customer')
    .eq('workspace_id', profile?.current_workspace_id).maybeSingle()
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const today = new Date().toISOString().split('T')[0]

  // Return existing tasks if already generated today
  const { data: existing } = await supabase
    .from('daily_tasks').select('*').eq('business_id', business.id).eq('date', today).maybeSingle()
  if (existing && (existing.tasks_json as unknown[]).length > 0) {
    return NextResponse.json({ tasks: existing })
  }

  // Read from agent_memory — full business context
  const ctx = await readBusinessContext(business.id)

  // Build rich context string from memory
  let contextString: string
  if (ctx) {
    const lines = [
      `Business: ${ctx.business.name} (${ctx.business.industry}, ${ctx.business.target_customer})`,
      `Health Score: ${ctx.business.health_score}/100`,
      `Description: ${ctx.business.description || '—'}`,
      '',
      `LEADS: ${ctx.leads.total} total | ${ctx.leads.new_7d} new this week | ${ctx.leads.hot_count} hot (score 70+)`,
      ctx.leads.hot_count > 0
        ? `Hot leads: ${ctx.leads.hot_leads.map((l: { name: string; stage: string; score: number }) => `${l.name} (${l.stage}, score ${l.score})`).join(', ')}`
        : '',
      `Lead stages: ${Object.entries(ctx.leads.by_stage).map(([s, n]) => `${s}:${n}`).join(', ') || 'none'}`,
      '',
      `REVIEWS: ${ctx.reviews.total} total | Avg ${ctx.reviews.avg_rating ?? '—'}/5 | ${ctx.reviews.unanswered} unanswered | ${ctx.reviews.negative_unanswered} negative unanswered`,
      '',
      ctx.audit
        ? `AUDIT: Score ${ctx.audit.latest_score}/100 (${ctx.audit.grade}). Critical issues: ${ctx.audit.critical_issues.join('; ') || 'none'}. Wins: ${ctx.audit.wins.join('; ') || 'none'}`
        : 'AUDIT: Not run yet',
      '',
      `PIPELINE: ${ctx.pipeline.open_deals} open deals | $${ctx.pipeline.total_value.toLocaleString()} total value`,
      '',
      `CONTENT (30d): ${ctx.content.published_30d} published | ${ctx.content.drafts_pending} drafts pending | Channels: ${ctx.content.channels_active.join(', ') || 'none'}`,
      '',
      ctx.products.active.length > 0
        ? `PRODUCTS: ${ctx.products.active.map((p: { name: string; type: string }) => `${p.name} (${p.type})`).join(', ')}`
        : 'PRODUCTS: None added yet',
      '',
      `INTEGRATIONS: Connected: ${ctx.integrations.connected.join(', ') || 'none'}`,
      ctx.integrations.disconnected.length > 0
        ? `Disconnected (needs setup): ${ctx.integrations.disconnected.slice(0, 5).join(', ')}`
        : '',
      '',
      ctx.tasks.completion_rate_7d !== null
        ? `TASK HISTORY (7d): ${ctx.tasks.completed_7d}/${ctx.tasks.total_7d} completed (${ctx.tasks.completion_rate_7d}% rate)`
        : '',
      ctx.competitors.length > 0
        ? `COMPETITORS: ${ctx.competitors.map((c: { name: string }) => c.name).join(', ')}`
        : '',
    ].filter(Boolean).join('\n')
    contextString = lines
  } else {
    // Fallback if memory not yet synced — read minimal data
    const [{ data: signals }, { data: leads }, { data: reviews }] = await Promise.all([
      supabase.from('agent_signals').select('type, title').eq('business_id', business.id).eq('dismissed', false).limit(5),
      supabase.from('leads').select('name, stage, score').eq('business_id', business.id).order('score', { ascending: false }).limit(5),
      supabase.from('reviews').select('rating, status').eq('business_id', business.id).eq('status', 'new').limit(5),
    ])
    contextString = [
      `Business: ${business.name} (${business.industry})`,
      `Health Score: ${business.health_score}/100`,
      signals?.length ? `Pending signals: ${signals.map(s => s.title).join(', ')}` : '',
      leads?.length ? `Top leads: ${leads.map(l => `${l.name} (${l.stage}, score ${l.score})`).join(', ')}` : '',
      reviews?.length ? `${reviews.length} new unanswered review(s)` : '',
    ].filter(Boolean).join('\n')
  }

  const FALLBACK_TASKS = [
    { id: '1', title: 'Follow up with your 3 hottest leads from last week', completed: false, priority: 'critical' },
    { id: '2', title: 'Respond to any unanswered reviews on Google', completed: false, priority: 'high' },
    { id: '3', title: 'Review and approve the AI-generated content drafts', completed: false, priority: 'high' },
    { id: '4', title: 'Check your website audit score and fix the top critical issue', completed: false, priority: 'medium' },
    { id: '5', title: 'Update your business description to include your latest offer', completed: false, priority: 'low' },
  ]

  let tasks = FALLBACK_TASKS

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey })
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 700,
        messages: [{
          role: 'user',
          content: `You are an AI business agent. Generate exactly 5 high-impact, SPECIFIC daily tasks for today based on the REAL business data below. Each task must be directly tied to a real issue or opportunity in the data — not generic advice. Completable in under 30 minutes.

BUSINESS DATA (from AI agent memory):
${contextString}

Rules:
- Reference real numbers and names from the data (e.g. "Follow up with John Smith — score 85, still in 'qualified'")
- If there are negative unanswered reviews, one task must address that
- If audit has critical issues, one task must address the #1 issue
- If hot leads exist, one task must be about them specifically
- If draft content exists, include approving it
- Be specific — NOT generic like "improve marketing"
- Assign priority: "critical" (revenue/reputation at risk, must do today), "high" (important, strong impact), "medium" (useful, do if time allows), "low" (nice to have)
- At most 1 "critical", at most 2 "high", rest "medium" or "low"

Return ONLY a JSON array:
[{"id":"1","title":"...","priority":"critical"},{"id":"2","title":"...","priority":"high"},{"id":"3","title":"...","priority":"high"},{"id":"4","title":"...","priority":"medium"},{"id":"5","title":"...","priority":"low"}]`,
        }],
      })

      const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
      const match = text.match(/\[[\s\S]*\]/)
      if (match) {
        const parsed: Array<{ id: string; title: string; priority?: string }> = JSON.parse(match[0])
        tasks = parsed.slice(0, 5).map(t => ({ ...t, completed: false, priority: t.priority ?? 'medium' }))
      }
    } catch {
      // use fallback tasks
    }
  }

  const { data: row, error } = await supabase
    .from('daily_tasks')
    .upsert({
      business_id: business.id,
      date: today,
      tasks_json: tasks,
      total_count: tasks.length,
      completed_count: 0,
    }, { onConflict: 'business_id,date' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tasks: row })
}
