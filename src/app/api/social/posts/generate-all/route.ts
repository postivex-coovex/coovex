import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deductCredits, creditResponseHeaders } from '@/lib/credits'
import { llmChat } from '@/lib/llm'

const SOCIAL_CHANNELS = ['linkedin', 'facebook', 'reddit', 'x', 'youtube'] as const
const PENDING_LIMIT = 3

const DEFAULT_TOPICS: Record<string, string> = {
  linkedin: 'Share an industry insight or lesson learned this week',
  facebook: 'Share a tip or behind-the-scenes moment for your audience',
  reddit: 'Share genuine expertise or ask for community feedback',
  x: 'Share a quick insight or hot take in your industry',
  youtube: 'Create a video about a common question in your industry',
}

const DEFAULT_TONES: Record<string, string> = {
  linkedin: 'Professional',
  facebook: 'Conversational',
  reddit: 'Authentic',
  x: 'Punchy',
  youtube: 'Script Outline',
}

function buildPrompt(channel: string, businessName: string, industry: string): string {
  const topic = DEFAULT_TOPICS[channel] ?? 'Share valuable content with your audience'
  const tone = DEFAULT_TONES[channel] ?? 'professional'

  return `Write a ${channel} post for ${businessName} (industry: ${industry}).
Topic: ${topic}
Tone: ${tone}
Keep it platform-native, authentic, and valuable to the audience.
Output only the post content, ready to copy-paste.`
}

// POST /api/social/posts/generate-all
// Called daily (by cron or manually) — generates one post per enabled platform that has < 3 pending
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
    if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    const { data: business } = await supabase
      .from('businesses').select('id, name, industry, social_connections')
      .eq('workspace_id', profile.current_workspace_id).maybeSingle()
    if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

    const socialConn = (business.social_connections as Record<string, { social_enabled?: boolean }>) ?? {}
    const results: { channel: string; status: 'generated' | 'skipped'; reason?: string }[] = []

    let lastBalance = 0

    for (const channel of SOCIAL_CHANNELS) {
      const cfg = socialConn[channel]
      if (!cfg?.social_enabled) {
        results.push({ channel, status: 'skipped', reason: 'not enabled' })
        continue
      }

      // Check pending limit
      const { count } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .eq('channel', channel)
        .eq('status', 'pending_approval')

      if ((count ?? 0) >= PENDING_LIMIT) {
        results.push({ channel, status: 'skipped', reason: `${PENDING_LIMIT} pending posts already exist` })
        continue
      }

      const credit = await deductCredits(profile.current_workspace_id, 'content_generate', `Daily social post — ${channel}`)
      if (!credit.ok) {
        results.push({ channel, status: 'skipped', reason: 'insufficient credits' })
        continue
      }
      lastBalance = credit.balance

      const prompt = buildPrompt(channel, business.name, business.industry || '')
      const content = await llmChat(
        [{ role: 'user', content: prompt }],
        'You are an expert social media strategist. Write platform-native content that performs well organically.',
        { maxTokens: 1000 },
      )

      await supabase.from('posts').insert({
        business_id: business.id,
        channel,
        content,
        status: 'pending_approval',
        created_by: user.id,
      })

      results.push({ channel, status: 'generated' })
    }

    const generated = results.filter(r => r.status === 'generated').length
    return NextResponse.json(
      { generated, results },
      { headers: lastBalance ? creditResponseHeaders(lastBalance) : {} },
    )
  } catch (err) {
    console.error('POST /api/social/posts/generate-all error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
