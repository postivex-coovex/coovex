import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 15

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { post_title, post_body, subreddit, product_name, product_tagline, product_description, target_audience, category } = await req.json()

  if (!post_title || !product_name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `You are writing a Reddit comment on behalf of a business owner.

REDDIT POST (r/${subreddit}):
Title: "${post_title}"
${post_body ? `Body: "${post_body.slice(0, 400)}"` : ''}

THEIR BUSINESS:
Product/Service: ${product_name}
${product_tagline ? `Tagline: ${product_tagline}` : ''}
${product_description ? `Description: ${product_description}` : ''}
${category ? `Category: ${category}` : ''}
${target_audience ? `Target audience: ${target_audience}` : ''}

Write a SHORT (2-4 sentences), genuinely helpful Reddit comment that:
1. Directly answers or relates to what the Reddit post is asking
2. Naturally and subtly mentions their product/service as a solution (NOT spammy, NOT "Check out my service!")
3. Sounds like a real helpful person, not an advertisement
4. Fits Reddit's casual tone

Output ONLY the comment text. No quotes, no explanation.`,
    }],
  })

  const comment = (msg.content[0] as { type: string; text: string }).text.trim()
  return NextResponse.json({ comment })
}
