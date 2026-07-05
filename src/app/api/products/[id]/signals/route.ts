import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

// POST — generate AI signals for a specific product
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: product } = await supabase.from('products').select('*').eq('id', id).maybeSingle()
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, name, industry').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  // Gather data for this product
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const sevenDaysAgo  = new Date(Date.now() - 7 * 86400000).toISOString()

  const [{ count: totalLeads }, { count: recentLeads }, { count: recentPosts }] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id).eq('product_id', id),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id).eq('product_id', id).gte('created_at', thirtyDaysAgo),
    // Posts that mention the product name
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', business.id).ilike('content', `%${product.name}%`).gte('created_at', sevenDaysAgo),
  ])

  // Generate signals via Claude
  const apiKey = process.env.ANTHROPIC_API_KEY
  const signals: { type: string; title: string; body: string; action_label: string }[] = []

  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey })
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `Analyze this business product/service and generate 2-3 actionable marketing signals. Return as JSON array.

Business: ${business.name} (${business.industry})
Product/Service: ${product.name} (${product.type})
Tagline: ${product.tagline || '—'}
Description: ${product.description || '—'}
Price: ${product.price ? `${product.currency} ${product.price} ${product.price_unit}` : 'not set'}
Target audience: ${product.target_audience || '—'}
Status: ${product.status}

Stats:
- Total leads interested: ${totalLeads ?? 0}
- Leads in last 30 days: ${recentLeads ?? 0}
- Posts mentioning it in last 7 days: ${recentPosts ?? 0}

Generate JSON:
[
  {
    "type": "opportunity|warning|info",
    "title": "short signal title (max 60 chars)",
    "body": "actionable insight (1-2 sentences, specific)",
    "action_label": "action button text"
  }
]

Focus on: content gaps, lead nurturing, pricing positioning, audience targeting.
Be specific to this product, not generic.`,
        }],
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
      const match = text.match(/\[[\s\S]*\]/)
      if (match) {
        const parsed = JSON.parse(match[0])
        signals.push(...parsed)
      }
    } catch {
      // fallback signals below
    }
  }

  // Fallback signals if AI failed
  if (signals.length === 0) {
    if ((recentLeads ?? 0) === 0) {
      signals.push({
        type: 'warning',
        title: `${product.name} has no new leads in 30 days`,
        body: `Your "${product.name}" ${product.type} hasn't attracted any new leads recently. Consider creating targeted content or running a campaign for it.`,
        action_label: 'Create Content',
      })
    }
    if ((recentPosts ?? 0) === 0) {
      signals.push({
        type: 'opportunity',
        title: `Promote "${product.name}" on social media`,
        body: `No social posts have mentioned "${product.name}" in the past week. A focused post could re-engage your audience.`,
        action_label: 'Generate Post',
      })
    }
    signals.push({
      type: 'info',
      title: `${product.name} — ${totalLeads ?? 0} total leads`,
      body: `Your "${product.name}" ${product.type} has attracted ${totalLeads ?? 0} interested leads overall. ${(totalLeads ?? 0) > 0 ? 'Follow up with qualified leads.' : 'Start promoting to build pipeline.'}`,
      action_label: 'View Leads',
    })
  }

  // Insert signals into agent_signals table
  const inserted = []
  for (const sig of signals) {
    try {
      const { data } = await supabase.from('agent_signals').insert({
        business_id:  business.id,
        type:         sig.type,
        title:        sig.title,
        body:         sig.body,
        action_label: sig.action_label,
        dismissed:    false,
        metadata:     { product_id: id, product_name: product.name },
      }).select().single()
      if (data) inserted.push(data)
    } catch {
      // ignore individual insert errors
    }
  }

  // Return generated signals count even if DB inserts partially failed
  return NextResponse.json({
    signals: inserted.length > 0 ? inserted : signals,
    count: signals.length,
    db_saved: inserted.length,
  })
}
