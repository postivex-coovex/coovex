import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/credits'

interface SoftwareItem {
  id: string
  name: string
  category: string
  tagline: string | null
  pricing_model: string
  price_from: number
}

interface Recommendation {
  name: string
  reason: string
  priority: 'must-have' | 'recommended' | 'nice-to-have'
  category: string
  software_id?: string
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()
    if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    // Deduct 5 credits for software recommendations
    const credit = await deductCredits(profile.current_workspace_id, 'goals_suggest', 'Software recommendations')
    if (!credit.ok) return NextResponse.json({ error: credit.error }, { status: 402 })

    // Get business profile
    const { data: business } = await supabase
      .from('businesses')
      .select('name, industry, description, website_intel')
      .eq('workspace_id', profile.current_workspace_id)
      .maybeSingle()

    // Get current stack
    const { data: stackItems } = await supabase
      .from('workspace_software_stack')
      .select('software:software_catalog(name, category)')
      .eq('workspace_id', profile.current_workspace_id)

    // Get software catalog
    const { data: catalog } = await supabase
      .from('software_catalog')
      .select('id, name, category, tagline, pricing_model, price_from')
      .eq('active', true)
      .order('is_coovex_pick', { ascending: false })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey === 'your_anthropic_api_key') {
      return NextResponse.json({ error: 'AI not configured' }, { status: 500 })
    }

    const intel = business?.website_intel as Record<string, unknown> | null
    const businessName = business?.name ?? 'Unknown Business'
    const industry = business?.industry ?? (intel?.industry as string) ?? 'Unknown'
    const size = (intel as Record<string, unknown> | null)?.company_size as string ?? 'small'
    const targetCustomer = (intel?.target_market as string) ?? 'Unknown'

    const currentStack = (stackItems ?? [])
      .map(s => (s.software as unknown as { name: string; category: string })?.name)
      .filter(Boolean)
      .join(', ') || 'None yet'

    // Group catalog by category for prompt
    const catalogByCategory = (catalog ?? []).reduce<Record<string, SoftwareItem[]>>((acc, sw) => {
      if (!acc[sw.category]) acc[sw.category] = []
      acc[sw.category].push(sw)
      return acc
    }, {})

    const catalogText = Object.entries(catalogByCategory)
      .map(([cat, items]) =>
        `${cat.toUpperCase()}:\n${items.map(s => `  - ${s.name} (${s.pricing_model}, ${s.price_from === 0 ? 'free' : `from $${(s.price_from / 100).toFixed(0)}/mo`}): ${s.tagline ?? ''}`).join('\n')}`
      )
      .join('\n\n')

    const anthropic = new Anthropic({ apiKey })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are a business technology advisor. Based on this business profile, recommend the most impactful software tools they should use.

Business: ${businessName}, Industry: ${industry}, Size: ${size}, Target: ${targetCustomer}
Software already in their stack: ${currentStack}

Available software catalog:
${catalogText}

Return JSON array of 6-8 recommendations. Only recommend tools NOT already in their stack. Focus on gaps:
[{
  "name": "HubSpot",
  "reason": "2-sentence personalized reason why this is perfect for their specific business",
  "priority": "must-have",
  "category": "crm"
}]

Priority rules:
- "must-have": Critical for their business type, they likely have significant pain without it
- "recommended": Would meaningfully improve their operations
- "nice-to-have": Beneficial but not urgent

Prioritize free/freemium options for small businesses. Return only valid JSON array, no explanation.`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return NextResponse.json({ recommendations: [] })

    const raw: Recommendation[] = JSON.parse(jsonMatch[0])

    // Map to software IDs from catalog
    const catalogMap = new Map((catalog ?? []).map(s => [s.name.toLowerCase(), s.id]))
    const recommendations = raw.map(r => ({
      ...r,
      software_id: catalogMap.get(r.name.toLowerCase()) ?? null,
    }))

    return NextResponse.json({ recommendations }, { headers: { 'X-Credits-Remaining': String(credit.balance) } })
  } catch (error) {
    console.error('POST /api/software/recommend error:', error)
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 })
  }
}
