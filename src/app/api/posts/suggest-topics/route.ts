import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { channel = 'linkedin', audit_id } = await request.json().catch(() => ({}))

    const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
    const { data: business } = await supabase.from('businesses')
      .select('id, name, industry, target_customer, website_intel')
      .eq('workspace_id', profile?.current_workspace_id ?? '')
      .maybeSingle()

    if (!business) return NextResponse.json({ topics: defaultTopics(channel) })

    // Use selected audit if provided, otherwise find "my_business" purpose audit, then latest
    let selectedAudit: { id: string; report_json: unknown } | null = null

    if (audit_id) {
      const { data } = await supabase.from('audits').select('id, report_json').eq('id', audit_id).eq('business_id', business.id).single()
      selectedAudit = data
    } else {
      // Prefer "my_business" purpose, fall back to latest
      const { data: allAudits } = await supabase
        .from('audits').select('id, report_json')
        .eq('business_id', business.id).eq('type', 'website')
        .order('created_at', { ascending: false }).limit(10)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      selectedAudit = (allAudits ?? []).find((a: any) => a.report_json?.purpose === 'my_business')
        ?? allAudits?.[0]
        ?? null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const intel = (selectedAudit?.report_json as any)?.intel ?? {}

    // Fetch recent signals (opportunities/insights) for context
    const { data: signals } = await supabase
      .from('agent_signals')
      .select('title, body, type')
      .eq('business_id', business.id)
      .eq('dismissed', false)
      .in('type', ['opportunity', 'info'])
      .order('created_at', { ascending: false })
      .limit(5)

    // Fetch recent post titles to avoid repetition
    const { data: recentPosts } = await supabase
      .from('posts')
      .select('title')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .limit(6)

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey === 'your_anthropic_api_key') {
      return NextResponse.json({ topics: defaultTopics(channel) })
    }

    const channelContext: Record<string, string> = {
      linkedin:  'LinkedIn (professional, thought leadership, B2B)',
      facebook:  'Facebook (community, story-driven, engagement)',
      instagram: 'Instagram (visual, inspirational, short + punchy)',
      tiktok:    'TikTok (hook-first, trendy, very short)',
      blog:      'Blog / WordPress (educational, SEO, long-form)',
    }

    const client = new Anthropic({ apiKey })
    const hasIntel = !!(intel.services?.length || intel.target_market)

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `You are a content strategist for a business. Suggest 5 specific, timely content topics for ${channelContext[channel] || 'social media'}.

Business: ${business.name}
Industry: ${business.industry || '—'}
Target customer: ${intel.target_market || business.target_customer || '—'}
${hasIntel ? `Services: ${intel.services?.join(', ') || '—'}
Unique value: ${intel.unique_value_proposition || '—'}
Missing from website: ${intel.missing_elements?.join(', ') || '—'}` : `Note: No website audit data available — suggest topics based on the industry and business name only.`}
${signals?.length ? `\nCurrent opportunities/signals:\n${signals.map(s => `- ${s.title}: ${s.body ?? ''}`).join('\n')}` : ''}
${recentPosts?.length ? `\nRecent posts (avoid repeating these):\n${recentPosts.map(p => `- ${p.title}`).join('\n')}` : ''}

Rules:
- Each topic must be specific to THIS business (mention their services/audience)
- Mix educational, promotional, and story-driven angles
- Make them actionable for a single post, not a series
- No generic topics like "tips for success" — be specific

Return JSON only:
{
  "topics": [
    { "title": "Short topic title (5-8 words)", "angle": "educational|promotional|story|question", "why": "One sentence why this matters now" },
    ...5 items
  ]
}`,
      }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ topics: defaultTopics(channel) })

    const parsed = JSON.parse(match[0])
    return NextResponse.json({ topics: parsed.topics ?? defaultTopics(channel) })

  } catch (err) {
    console.error('suggest-topics error:', err)
    return NextResponse.json({ topics: defaultTopics('linkedin') })
  }
}

function defaultTopics(channel: string) {
  const base = [
    { title: 'How we help clients save time', angle: 'educational', why: 'Addresses a common pain point' },
    { title: 'Behind the scenes at our business', angle: 'story', why: 'Builds authenticity and trust' },
    { title: 'Top 3 mistakes our clients avoid', angle: 'educational', why: 'High engagement format' },
    { title: 'Client success story this week', angle: 'promotional', why: 'Social proof drives conversions' },
    { title: 'What question do you get asked most?', angle: 'question', why: 'Drives comments and discussion' },
  ]
  void channel
  return base
}
