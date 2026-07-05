import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { post_title, post_body, platform, product_name, product_description, business_name } = await req.json() as {
    post_title: string
    post_body?: string
    platform: string
    product_name?: string
    product_description?: string
    business_name?: string
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key') {
    return NextResponse.json({
      reply: `Great question! If you're looking for a solution to this, [${product_name ?? 'our service'}] might be exactly what you need. We specialize in helping businesses like yours with ${product_description ?? 'this exact problem'}. Feel free to reach out if you'd like to know more!`
    })
  }

  const anthropic = new Anthropic({ apiKey })

  const platformName = platform === 'reddit' ? 'Reddit' : platform === 'hackernews' ? 'Hacker News' : platform

  const prompt = `You are a helpful community member on ${platformName}.

Post title: "${post_title}"
${post_body ? `Post content: "${post_body}"` : ''}

Your business: ${business_name ?? 'a digital services company'}
Your service/product: ${product_name ?? 'our service'}
Description: ${product_description ?? 'we help businesses grow online'}

Write a genuine, helpful ${platformName} comment/reply that:
1. Directly addresses the person's question or problem
2. Provides real value or insight (NOT just an ad)
3. Naturally mentions your service/product ONLY if it's genuinely relevant
4. Sounds like a real community member, NOT a bot or salesperson
5. Is concise (2-4 sentences max for ${platform === 'hackernews' ? 'HN' : 'Reddit'})
6. Does NOT use phrases like "I work at" or "full disclosure"

${platform === 'reddit' ? 'Reddit tone: conversational, direct, no corporate speak.' : 'HN tone: technical, thoughtful, value-first.'}

Return ONLY the reply text, nothing else.`

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const reply = (res.content[0] as { type: string; text: string }).text.trim()
  return NextResponse.json({ reply })
}
