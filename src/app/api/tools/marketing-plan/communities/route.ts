import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export type { Community } from '@/types/marketing-plan'
import type { Community } from '@/types/marketing-plan'

const FALLBACK_COMMUNITIES: Community[] = [
  { name: 'r/SaaS', platform: 'reddit', url: 'https://reddit.com/r/SaaS', members: '230K', why: 'SaaS founders and buyers actively discuss tools — ideal for product showcases', post_tip: 'Share a transparent revenue milestone or "what I learned building X" — avoid direct promotion', post_type: 'story' },
  { name: 'r/Entrepreneur', platform: 'reddit', url: 'https://reddit.com/r/Entrepreneur', members: '1.5M', why: 'Business owners looking for tools and advice — your target audience', post_tip: 'Answer questions about problems your product solves, mention your tool naturally in context', post_type: 'value' },
  { name: 'r/startups', platform: 'reddit', url: 'https://reddit.com/r/startups', members: '950K', why: 'Early-stage founders seeking tools and feedback — perfect for beta users', post_tip: 'Post "I built X to solve Y — feedback welcome" — this community loves giving input', post_type: 'showcase' },
  { name: 'Indie Hackers Community', platform: 'other', url: 'https://indiehackers.com', members: '80K', why: 'Indie founders share revenue, milestones, and product wins openly', post_tip: 'Post your MRR milestone update monthly — even $1 MRR is worth posting about here', post_type: 'story' },
  { name: 'B2B SaaS Founders (Facebook)', platform: 'facebook', url: 'https://facebook.com/groups/b2bsaasfounders', members: '45K', why: 'Active B2B SaaS community with daily posts and tool recommendations', post_tip: 'Ask a strategic question, provide value in the thread, mention your tool only when directly relevant', post_type: 'question' },
  { name: 'SaaS Growth Hacks (LinkedIn)', platform: 'linkedin', url: 'https://linkedin.com/groups/saas-growth', members: '120K', why: 'Decision makers and marketers who buy B2B tools are active here', post_tip: 'Share a data-backed insight or case study — LinkedIn rewards educational content over promotion', post_type: 'value' },
  { name: 'Product Led Growth Slack', platform: 'slack', url: 'https://productledgrowth.com/community', members: '18K', why: 'Product and growth professionals actively discuss tools and strategies', post_tip: 'Introduce yourself in #intros, contribute to discussions before sharing your product', post_type: 'value' },
  { name: 'Demand Curve Community', platform: 'slack', url: 'https://demandcurve.com/community', members: '12K', why: 'Growth marketers who can become power users and advocates for your product', post_tip: 'Share a specific growth experiment you ran with real numbers — this audience loves data', post_type: 'story' },
]

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const generatePost: string = body.generate_post ?? ''
  const community: Community | null = body.community ?? null

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const wsId = profile?.current_workspace_id

  const { data: biz } = wsId
    ? await supabase.from('businesses').select('name, industry, target_customer').eq('workspace_id', wsId).maybeSingle()
    : { data: null }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key') {
    if (generatePost && community) return NextResponse.json({ post: getFallbackPost(community, biz?.name) })
    return NextResponse.json({ communities: FALLBACK_COMMUNITIES })
  }

  const client = new Anthropic({ apiKey })

  // ── Generate community post ───────────────────────────────────────────────────
  if (generatePost && community) {
    try {
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `Write a post for "${community.name}" (${community.platform}) for this business:
- Business: ${biz?.name || 'Unknown'}
- Industry: ${biz?.industry || 'B2B SaaS'}
- Target customer: ${biz?.target_customer || 'SMBs'}

Community tip: ${community.post_tip}
Post type: ${community.post_type}

Write a post that fits naturally in this community. Do NOT sound promotional or spammy.
${community.platform === 'reddit' ? 'Reddit format: title on first line, then body. No emojis.' : ''}
${community.platform === 'linkedin' ? 'LinkedIn format: strong first line hook, short paragraphs, 2-3 hashtags.' : ''}
Max 200 words. Return ONLY the post text.`,
        }],
      })
      const post = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
      return NextResponse.json({ post })
    } catch {
      return NextResponse.json({ post: getFallbackPost(community, biz?.name) })
    }
  }

  // ── Suggest communities ───────────────────────────────────────────────────────
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Suggest the 8 best online communities for this business to join and engage in. Return ONLY valid JSON array.

Business: ${biz?.name || 'B2B SaaS'}
Industry: ${biz?.industry || 'Technology'}
Target customer: ${biz?.target_customer || 'SMBs'}

Return JSON array:
[
  {
    "name": "community name",
    "platform": "reddit|facebook|linkedin|slack|discord|other",
    "url": "direct URL to the community",
    "members": "member count e.g. 150K",
    "why": "1 sentence — why THIS specific community fits this business",
    "post_tip": "1 concrete tip on how to post there without getting banned or ignored",
    "post_type": "story|question|value|showcase"
  }
]

Mix platforms. Include Reddit subreddits, LinkedIn groups, Slack communities, and Facebook groups. Be specific — real communities that actually exist. No generic advice.`,
      }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const match = text.match(/\[[\s\S]*\]/)
    if (match) {
      const communities: Community[] = JSON.parse(match[0])
      return NextResponse.json({ communities })
    }
  } catch { /* fall through */ }

  return NextResponse.json({ communities: FALLBACK_COMMUNITIES })
}

function getFallbackPost(community: Community, bizName?: string): string {
  const name = bizName || 'our product'
  if (community.post_type === 'story') return `I've been building ${name} for the past 6 months and just hit our first 10 paying customers.\n\nHere's what actually worked (and what didn't):\n\n→ Cold email outperformed paid ads 3:1\n→ Talking to churned users taught us more than surveys\n→ The feature we thought was our "big thing" — nobody uses it\n\nStill figuring it out day by day. Happy to share more if useful.\n\nWhat's been your most surprising lesson building in public?`
  if (community.post_type === 'question') return `For those who manage [target problem area] — what's the #1 thing that wastes your time every week?\n\nI'm building ${name} to solve exactly this and want to make sure I'm not building the wrong solution.\n\nHonest answers only, even if it hurts.`
  return `Quick tip for anyone dealing with [specific pain point]:\n\nInstead of [common approach], try [better approach].\n\nWe tested this with 20+ customers and saw [specific result]. Happy to share the full breakdown in the comments.`
}
