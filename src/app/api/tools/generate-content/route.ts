import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessName, industry, topic, platform, tone } = body

    if (!businessName || !industry || !topic || !platform) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey === 'your_anthropic_api_key') {
      // Return mock content when API key isn't configured
      return NextResponse.json({
        posts: [
          {
            content: `🚀 Exciting news for ${industry} professionals!\n\nAt ${businessName}, we've been thinking deeply about ${topic}. Here's what we've learned:\n\n✅ Focus on your core strengths\n✅ Listen to your customers first\n✅ Measure what matters\n\nWhat's your approach? Drop a comment below 👇\n\n#${industry.replace(/\s+/g, '')} #Business #Growth`,
            platform,
            type: 'Thought Leadership',
          },
          {
            content: `Did you know that ${topic} is one of the biggest opportunities in ${industry} right now?\n\nHere at ${businessName}, we help businesses navigate exactly this.\n\n3 things that actually work:\n1. Start with customer pain points\n2. Build a clear process\n3. Track your results weekly\n\nWant to know more? Let's connect. 🤝`,
            platform,
            type: 'Educational',
          },
          {
            content: `The #1 mistake businesses make with ${topic}?\n\nThey try to do everything at once.\n\nAt ${businessName}, we've seen it happen 100 times. The solution is surprisingly simple — focus on ONE thing, do it exceptionally well, then expand.\n\nTag a business owner who needs to hear this 👇`,
            platform,
            type: 'Engagement Hook',
          },
          {
            content: `Behind the scenes at ${businessName} 👇\n\nEvery day we're working to help our clients with ${topic}. It's not always glamorous, but the results speak for themselves.\n\nProud of our team's dedication to excellence in ${industry}. 💪\n\nWhat's driving your business forward today?`,
            platform,
            type: 'Behind the Scenes',
          },
          {
            content: `Quick tip for ${industry} businesses:\n\nIf you're struggling with ${topic}, try this:\n\n→ Step 1: Identify your biggest bottleneck\n→ Step 2: Fix just that one thing\n→ Step 3: Measure the impact\n→ Step 4: Move to the next priority\n\nSimple? Yes. Effective? Absolutely.\n\nSave this for later! 🔖\n\n#${industry.replace(/\s+/g, '')} #BusinessTips`,
            platform,
            type: 'Quick Tip',
          },
        ],
      })
    }

    const prompt = `You are a professional social media content writer. Generate 5 unique, engaging ${platform} posts for a business.

Business Details:
- Name: ${businessName}
- Industry: ${industry}
- Topic/Focus: ${topic}
- Tone: ${tone || 'professional but approachable'}
- Platform: ${platform}

Requirements:
- Each post should be different in style and format (e.g., thought leadership, question, story, list, quick tip)
- Include relevant emojis naturally
- Add 2-3 relevant hashtags at the end
- Keep appropriate length for ${platform} (LinkedIn: up to 1300 chars, Instagram: up to 2200 chars, Facebook: 400-500 chars)
- Make posts genuinely valuable, not salesy
- Include a clear call-to-action in each post

Return ONLY a JSON array with this structure (no markdown, just raw JSON):
[
  {"content": "post text here", "type": "Post Type Name"},
  ...
]`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`)
    }

    const data = await response.json()
    const text = data.content[0].text

    let posts
    try {
      posts = JSON.parse(text)
    } catch {
      // Try to extract JSON from response
      const match = text.match(/\[[\s\S]*\]/)
      if (match) {
        posts = JSON.parse(match[0])
      } else {
        throw new Error('Failed to parse AI response')
      }
    }

    return NextResponse.json({ posts: posts.map((p: { content: string; type: string }) => ({ ...p, platform })) })
  } catch (error) {
    console.error('Content generation error:', error)
    return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 })
  }
}
