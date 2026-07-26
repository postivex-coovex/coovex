import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { llmChat } from '@/lib/llm'
import { deductCredits } from '@/lib/credits'

// Vercel Cron — runs every day at 8:00 AM UTC
// vercel.json: { "path": "/api/cron/social-posts", "schedule": "0 8 * * *" }

const PENDING_LIMIT = 3
const SOCIAL_CHANNELS = ['linkedin', 'facebook', 'reddit', 'x', 'youtube'] as const
type SocialChannel = typeof SOCIAL_CHANNELS[number]

const DEFAULT_TOPICS: Record<SocialChannel, string> = {
  linkedin: 'Share a professional insight or lesson learned this week relevant to your industry',
  facebook: 'Share a helpful tip or behind-the-scenes moment your audience will find valuable',
  reddit:   'Share genuine expertise or ask for community feedback on a relevant topic',
  x:        'Share a quick industry insight or contrarian take in under 280 characters',
  youtube:  'Create a video about the most common question your customers ask',
}

const DEFAULT_TONES: Record<SocialChannel, string> = {
  linkedin: 'Professional',
  facebook: 'Conversational',
  reddit:   'Authentic',
  x:        'Punchy',
  youtube:  'Script Outline',
}

function buildPrompt(channel: SocialChannel, businessName: string, industry: string): string {
  const topic = DEFAULT_TOPICS[channel]
  const tone  = DEFAULT_TONES[channel]

  const guides: Record<SocialChannel, string> = {
    linkedin: `Write a LinkedIn post for ${businessName} (${industry}).
Topic: ${topic}
Tone: ${tone}
Rules: 150–300 words, hook in first 2 lines, line breaks for readability, end with a question or CTA, max 3 hashtags. Output only the post.`,

    facebook: `Write a Facebook post for ${businessName}.
Topic: ${topic}
Tone: ${tone}
Rules: 80–200 words, conversational, 1–2 natural emojis, end with engagement question, no hashtag spam. Output only the post.`,

    reddit: `Write an authentic Reddit post for ${businessName} (${industry}).
Topic: ${topic}
Style: ${tone}
Format — Title: (on first line) then Body: (rest)
Rules: community-native, value-first, zero promotional language, 200–400 words. Output title and body.`,

    x: `Write an X (Twitter) post for ${businessName}.
Topic: ${topic}
Style: ${tone}
Rules: single tweet under 280 characters OR a 4-tweet thread (each under 280 chars, numbered 1/4 etc.), hook first, max 1 hashtag. Output only the tweet(s).`,

    youtube: `Write a YouTube Script Outline for ${businessName} (${industry}).
Video topic: ${topic}
Include: Hook (30s), Intro, 3–5 main sections with talking points, CTA + Outro. Format with clear section headers. Output only the script outline.`,
  }

  return guides[channel]
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  // Get all businesses that have at least one social platform enabled
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, industry, workspace_id, social_connections')
    .not('social_connections', 'is', null)
    .limit(500)

  if (!businesses?.length) return NextResponse.json({ ok: true, processed: 0, posts: 0 })

  let totalPosts = 0
  let totalSkipped = 0

  for (const biz of businesses) {
    const socialConn = (biz.social_connections as Record<string, { social_enabled?: boolean }>) ?? {}

    const enabledChannels = SOCIAL_CHANNELS.filter(ch => socialConn[ch]?.social_enabled === true)
    if (!enabledChannels.length) continue

    for (const channel of enabledChannels) {
      try {
        // Check pending limit
        const { count } = await supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', biz.id)
          .eq('channel', channel)
          .eq('status', 'pending_approval')

        if ((count ?? 0) >= PENDING_LIMIT) {
          totalSkipped++
          continue
        }

        // Deduct credits
        const credit = await deductCredits(biz.workspace_id, 'content_generate', `Daily social post — ${channel}`)
        if (!credit.ok) {
          totalSkipped++
          continue
        }

        const prompt  = buildPrompt(channel, biz.name, biz.industry ?? '')
        const content = await llmChat(
          [{ role: 'user', content: prompt }],
          'You are an expert social media strategist. Write platform-native content that performs well organically. Be concise, genuine, and specific.',
          { maxTokens: 1000 },
        )

        await supabase.from('posts').insert({
          business_id: biz.id,
          channel,
          content,
          status: 'pending_approval',
        })

        totalPosts++
      } catch (err) {
        console.error(`social-posts cron: failed for biz ${biz.id} channel ${channel}:`, err)
        totalSkipped++
      }
    }
  }

  console.log(`social-posts cron: ${totalPosts} posts generated, ${totalSkipped} skipped`)
  return NextResponse.json({ ok: true, posts: totalPosts, skipped: totalSkipped })
}
