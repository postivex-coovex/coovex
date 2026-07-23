import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deductCredits, creditResponseHeaders } from '@/lib/credits'
import { llmChat } from '@/lib/llm'

const PENDING_LIMIT = 3

function buildPrompt(channel: string, topic: string, tone: string, businessName: string, industry: string): string {
  switch (channel) {
    case 'linkedin':
      return `Write a LinkedIn post for ${businessName} (industry: ${industry}).
Topic: ${topic}
Tone: ${tone}
Rules:
- 150–300 words
- First 2 lines must be a strong scroll-stopping hook (this is what appears before "...see more")
- Use short paragraphs and line breaks for readability
- End with a thought-provoking question or clear CTA
- Add max 3 relevant hashtags at the very end
- Professional but genuine — avoid corporate jargon

Output only the post text, ready to copy-paste.`

    case 'facebook':
      return `Write a Facebook Page post for ${businessName}.
Topic: ${topic}
Tone: ${tone}
Rules:
- 80–200 words
- Conversational and relatable tone
- Use 1–2 relevant emojis naturally (not spam)
- End with an engagement question to boost comments
- No excessive hashtags (0–1 max)

Output only the post text, ready to copy-paste.`

    case 'reddit':
      return `Write an authentic Reddit post for ${businessName} (${industry}).
Topic: ${topic}
Style: ${tone}
Format:
**Title:** (write a specific, engaging title)
**Body:** (write the post content)

Rules:
- Write as a genuine community member, not a marketer
- Value-first: provide real insights, experiences, or ask a meaningful question
- Zero promotional language or sales pitch
- Be transparent if you represent a company
- Conversational, honest, community-native tone
- 200–500 words for body

Output the Title and Body separated clearly.`

    case 'x':
      return `Write content for X (Twitter) for ${businessName}.
Topic: ${topic}
Style: ${tone}
${tone.toLowerCase().includes('thread') ? `Format as a thread of 4–6 tweets, each under 280 characters, numbered like "1/5 …"` : `Format as a single tweet under 280 characters.`}

Rules:
- Open with an irresistible hook
- High information density — every word earns its place
- 1–2 relevant hashtags max (or none if they hurt the flow)
- Make it shareable

Output only the tweet or thread, ready to copy-paste.`

    case 'youtube':
      return `Create YouTube ${tone.toLowerCase()} for ${businessName} (${industry}).
Video topic: ${topic}

${tone === 'Script Outline' ? `Provide a detailed script outline:
- Hook (first 30 seconds): attention-grabbing opening statement
- Intro: brief what the viewer will learn
- Main sections (3–5): key points with talking notes
- CTA + Outro: subscribe, comment, and next video

Format clearly with section headers.` : tone === 'Video Description' ? `Write an SEO-optimized YouTube video description:
- First 2 sentences: compelling summary with primary keyword
- Main description: 150–250 words, naturally keyword-rich
- Timestamps placeholder section: "00:00 – Intro" format
- Links section placeholder
- Subscribe reminder

Output the full description, ready to paste.` : `Provide:
1. 3 title options (each under 70 characters, high CTR, keyword-rich)
2. One full SEO-optimized video description (as above)

Format clearly.`}

Output only the content, ready to use.`

    default:
      return `Write a social media post for ${businessName} about: ${topic}. Tone: ${tone}.`
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
    if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    const { data: business } = await supabase
      .from('businesses').select('id, name, industry')
      .eq('workspace_id', profile.current_workspace_id).maybeSingle()
    if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

    const { channel, topic, tone, save = true } = await request.json()
    if (!channel || !topic) return NextResponse.json({ error: 'channel and topic required' }, { status: 400 })

    // Enforce 3-pending limit
    const { count } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('channel', channel)
      .eq('status', 'pending_approval')

    if ((count ?? 0) >= PENDING_LIMIT) {
      return NextResponse.json({
        error: `${PENDING_LIMIT} posts are already pending for ${channel}. Publish or delete existing posts first.`,
        limitReached: true,
      }, { status: 429 })
    }

    // Deduct credits
    const workspaceId = profile.current_workspace_id
    const credit = await deductCredits(workspaceId, 'content_generate', `Social post — ${channel}`)
    if (!credit.ok) return NextResponse.json({ error: credit.error }, { status: 402 })

    const prompt = buildPrompt(channel, topic, tone || 'professional', business.name, business.industry || '')
    const content = await llmChat(
      [{ role: 'user', content: prompt }],
      'You are an expert social media strategist. Write platform-native content that performs well organically.',
      { maxTokens: 1200 },
    )

    if (!save) {
      return NextResponse.json({ content }, { headers: creditResponseHeaders(credit.balance) })
    }

    // Save as pending_approval
    const { data: post, error: insertErr } = await supabase.from('posts').insert({
      business_id: business.id,
      channel,
      content,
      status: 'pending_approval',
      created_by: user.id,
    }).select('id, channel, content, status, scheduled_at, published_at, created_at, slug').single()

    if (insertErr) throw insertErr
    return NextResponse.json(
      { post, content },
      { status: 201, headers: creditResponseHeaders(credit.balance) },
    )
  } catch (err) {
    console.error('POST /api/social/posts/generate error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
