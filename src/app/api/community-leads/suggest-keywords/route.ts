import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { product_name, product_description, product_tagline, platform } = await req.json() as {
    product_name: string
    product_description?: string
    product_tagline?: string
    platform: string
  }

  const platformLabel = platform === 'reddit' ? 'Reddit' : 'Hacker News'

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key') {
    // Fallback: template-based keywords
    const base = product_name.toLowerCase()
    return NextResponse.json({
      keywords: [
        `looking for ${base}`,
        `need help with ${base}`,
        `best ${base} tool`,
        `recommend ${base}`,
        `how to ${base}`,
        `${base} for small business`,
      ],
    })
  }

  const anthropic = new Anthropic({ apiKey })

  const prompt = `You are a lead-generation expert for ${platformLabel}.

Product: "${product_name}"
${product_description ? `Description: "${product_description}"` : ''}
${product_tagline ? `Tagline: "${product_tagline}"` : ''}

Generate 6 search phrases that potential customers would POST on ${platformLabel} when they NEED or are LOOKING FOR this product/service.

Rules:
- Focus on customer PAIN POINTS and NEEDS, not the product name itself
- Use conversational phrases people actually type on ${platformLabel}
- Include buying signals: "looking for", "need help", "recommend", "best tool for", "how do I"
- Each phrase: 3-8 words
- Return ONLY a valid JSON array of strings, no explanation

Example for "Email Marketing Software": ["looking for email marketing tool", "best newsletter software small business", "need help automating emails", "recommend email list management", "how to grow email subscribers"]`

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (res.content[0] as { type: string; text: string }).text.trim()

  try {
    const match = text.match(/\[[\s\S]*\]/)
    const keywords: string[] = match ? JSON.parse(match[0]) : []
    return NextResponse.json({ keywords: keywords.slice(0, 6) })
  } catch {
    return NextResponse.json({ keywords: [] })
  }
}
