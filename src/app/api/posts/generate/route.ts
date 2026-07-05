import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MOCK_POSTS: Record<string, string[]> = {
  linkedin: [
    `🚀 Excited to share a key insight: consistency beats perfection every time.\n\nShowing up regularly — even with imperfect content — builds more trust than waiting for the "perfect" post.\n\nWhat's your take? Drop your thoughts below. 👇`,
  ],
  facebook: [
    `Hey everyone! 👋\n\nWe've got something exciting coming your way this week. Stay tuned — you won't want to miss it!\n\nHit "Like" if you're curious what we have planned. ❤️`,
  ],
  instagram: [
    `✨ Behind the scenes.\n\nEvery great result starts with a great process.\n\n📌 Save this post for inspiration!\n\n#BusinessGrowth #BehindTheScenes #SmallBusiness`,
  ],
  wordpress: [
    `# [Topic Title]\n\nAre you struggling with [problem]? In this post, we break down the most effective strategies.\n\n## The Core Insight\n\n[Key insight here.]\n\n## 3 Steps to Get Started\n\n1. First step\n2. Second step  \n3. Third step\n\nReady to take action? Contact us today.`,
  ],
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
    const { data: business } = await supabase.from('businesses')
      .select('id, name, industry, website_intel')
      .eq('workspace_id', profile?.current_workspace_id ?? '')
      .maybeSingle()

    const { channel, topic, tone = 'professional', businessName, industry, audit_id, product_id } = await request.json()
    if (!channel) return NextResponse.json({ error: 'channel is required' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey === 'your_anthropic_api_key') {
      const mockVariants = MOCK_POSTS[channel] || MOCK_POSTS.linkedin
      const content = mockVariants[Math.floor(Math.random() * mockVariants.length)]
        .replace('[Business Name]', businessName || business?.name || 'your business')
      return NextResponse.json({ content })
    }

    // Fetch product details if product_id provided
    let productCtx = ''
    if (product_id && business) {
      const { data: product } = await supabase.from('products').select('*').eq('id', product_id).eq('business_id', business.id).maybeSingle()
      if (product) {
        const price = product.price ? `${product.currency} ${product.price} ${product.price_unit}` : null
        const benefits = product.key_benefits ? product.key_benefits.split('\n').filter(Boolean).slice(0, 4) : []
        productCtx = `
FEATURED PRODUCT/SERVICE (write content specifically promoting this):
  Name: ${product.name}
  Type: ${product.type}
  Tagline: ${product.tagline || '—'}
  Description: ${product.description || '—'}
  ${price ? `Price: ${price}` : ''}
  Target audience: ${product.target_audience || '—'}
  Key benefits: ${benefits.length > 0 ? benefits.join(', ') : '—'}

The post MUST be specifically about this ${product.type}. Highlight its value proposition and CTA should drive interest in it.`
      }
    }

    // Fetch website audit intel
    let intel: Record<string, unknown> | null = null
    if (business) {
      if (audit_id) {
        const { data: audit } = await supabase.from('audits').select('report_json').eq('id', audit_id).eq('business_id', business.id).single()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        intel = (audit?.report_json as any)?.intel ?? null
      } else {
        const { data: allAudits } = await supabase.from('audits').select('report_json').eq('business_id', business.id).eq('type', 'website').order('created_at', { ascending: false }).limit(10)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const best = (allAudits ?? []).find((a: any) => a.report_json?.purpose === 'my_business') ?? allAudits?.[0]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        intel = (best?.report_json as any)?.intel ?? null
      }
    }

    const channelGuide: Record<string, string> = {
      linkedin:  'LinkedIn (professional, max 1300 chars, use line breaks, 1-3 emojis, end with engagement question)',
      facebook:  'Facebook (conversational, 150-400 chars, warm, can use emojis, encourage likes/shares)',
      instagram: 'Instagram (visual-focused, 150-300 chars + hashtags, energetic, 5-10 relevant hashtags at end)',
      tiktok:    'TikTok (very short hook in first line, 100-150 chars, trendy, include hook/CTA)',
      wordpress: 'WordPress blog post (500-800 words, SEO-friendly, use ## headings, actionable)',
    }

    const intelCtx = intel && !productCtx ? `
Business context from website audit:
- Services: ${(intel.services as string[])?.join(', ') || '—'}
- Target audience: ${intel.target_market || '—'}
- Unique value: ${intel.unique_value_proposition || '—'}
- Pricing model: ${intel.pricing_model || '—'}` : ''

    const bName = businessName || business?.name || 'our business'
    const bIndustry = industry || business?.industry || 'business'
    const topicLine = topic
      ? `Topic/brief: ${topic}`
      : `No topic specified — choose the most relevant and timely angle for this business.`

    const prompt = `Write a ${channelGuide[channel] || 'social media post'} for a ${bIndustry} called "${bName}". Tone: ${tone}.
${productCtx || intelCtx}
${topicLine}

Important: ${productCtx ? 'Make this post entirely focused on the featured product/service above.' : 'Reference the actual services and value proposition — make it feel authentic, not generic.'} Return only the post content, no extra commentary.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) throw new Error(`Claude API error: ${res.status}`)
    const data = await res.json()
    return NextResponse.json({ content: data.content[0].text })
  } catch (error) {
    console.error('POST /api/posts/generate error:', error)
    return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 })
  }
}
