import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const HELP_CONFIG: Record<string, { label: string; prompt: (biz: string, industry: string, target: string) => string }> = {
  product_hunt: {
    label: 'Product Hunt Launch Kit',
    prompt: (biz, industry, target) => `Write a Product Hunt launch kit for "${biz}" (${industry}, targeting ${target}).

Return exactly this structure:

TAGLINE (max 60 chars — punchy, benefit-first, no buzzwords):
[tagline]

DESCRIPTION (max 260 chars — what it does + who it's for):
[description]

FIRST COMMENT (200-300 words — founder story, what problem you solve, early traction, call to action):
[first comment]

TOPICS (5 relevant Product Hunt topics, comma separated):
[topics]`,
  },

  indie_hackers: {
    label: 'Indie Hackers Milestone Post',
    prompt: (biz, industry, target) => `Write an Indie Hackers milestone post for the founder of "${biz}" (${industry}).

Format:
- Title: "I built X to solve Y — here's what happened after Z months" style
- Body: 300-400 words, transparent and data-driven tone
- Include: what problem you're solving, how you built it, early numbers (even if small), what's working, what failed, next steps
- End with: a question to spark discussion
- Tone: honest, humble, specific — NOT a press release`,
  },

  hacker_news: {
    label: 'Show HN Submission',
    prompt: (biz, industry, target) => `Write a Hacker News "Show HN" submission for "${biz}" (${industry}).

Format:

TITLE (max 80 chars — must start with "Show HN:"):
[title]

DESCRIPTION (150-200 words):
- What it is and what problem it solves — technical and direct
- Why you built it
- Key technical decisions or interesting implementation details
- Current status (alpha, beta, live)
- Honest about limitations
- No marketing language — HN hates buzzwords`,
  },

  reddit: {
    label: 'Reddit Launch Post',
    prompt: (biz, industry, target) => `Write a Reddit launch post for "${biz}" (${industry}, targeting ${target}).

Subreddits to target: r/SaaS, r/Entrepreneur, r/startups (write for r/SaaS)

Format:

TITLE (no self-promotion — use question or story format):
[title]

BODY (200-300 words):
- Open with the problem, not the product
- Share a brief founder story or specific pain point that led to building this
- Mention the product naturally mid-way
- Be genuinely helpful — add value beyond just promoting
- End with a soft CTA

RULE: Never say "I'm excited to announce" or "game-changing" — Reddit will downvote instantly.`,
  },

  twitter_x: {
    label: 'Launch Tweet Thread',
    prompt: (biz, industry, target) => `Write a Twitter/X launch thread for "${biz}" (${industry}).

Write 5 tweets as a thread:

Tweet 1 (hook — make people stop scrolling):
[tweet 1]

Tweet 2 (the problem — paint the pain vividly):
[tweet 2]

Tweet 3 (the solution — what you built and why it's different):
[tweet 3]

Tweet 4 (social proof or behind-the-scenes — numbers, story, or build process):
[tweet 4]

Tweet 5 (CTA — clear, specific, with link placeholder):
[tweet 5 — include "[LINK]" where the URL goes]

Rules: max 280 chars per tweet, no hashtag spam (max 2 total, only in last tweet), conversational tone, hooks must be bold statements not questions.`,
  },

  linkedin: {
    label: 'LinkedIn Launch Post',
    prompt: (biz, industry, target) => `Write a LinkedIn launch post for the founder of "${biz}" (${industry}, targeting ${target}).

Format (300-400 words):
- First line: bold hook — a counterintuitive statement or surprising fact (NOT "I'm thrilled to announce")
- 2nd paragraph: the specific problem your customers face — make it relatable
- 3rd paragraph: what you built and why now
- 4th paragraph: one specific result or early win (even small)
- Closing: CTA + 2-3 relevant hashtags

Tone: Direct, confident, human — like a founder talking to peers, not a press release.`,
  },

  email: {
    label: 'Launch Email',
    prompt: (biz, industry, target) => `Write a product launch email for "${biz}" (${industry}) to send to the waiting list.

Format:

SUBJECT LINE (3 options — direct, curiosity, personal):
1. [option 1]
2. [option 2]
3. [option 3]

EMAIL BODY (200-250 words):
- Open: personal, not corporate
- Problem reminder: 1-2 sentences reminding them why they signed up
- The reveal: what's live now
- What makes it different: 2-3 specific features or benefits
- Social proof: mention early users or beta results if any
- CTA: one clear button/link — "[LINK]"
- P.S.: a time-limited offer or extra reason to act today

Tone: warm, direct, conversational — like an email from a person, not a company.`,
  },

  blog: {
    label: 'Launch Blog Post',
    prompt: (biz, industry, target) => `Write a launch blog post for "${biz}" (${industry}, targeting ${target}).

Format:

HEADLINE (SEO-friendly, 50-60 chars, include main keyword):
[headline]

META DESCRIPTION (150-160 chars):
[meta]

OUTLINE + INTRO (write the full intro paragraph + section headings):

Intro (150-200 words — hook with a problem or surprising stat, set context, preview what reader will learn):
[intro]

Section headings (5-6 H2s that tell a story from problem → solution → results → how to get started):
1. [H2]
2. [H2]
3. [H2]
4. [H2]
5. [H2]

CTA PARAGRAPH (50-75 words — end of post, convert reader to user):
[cta]`,
  },

  appsumo: {
    label: 'AppSumo Listing Copy',
    prompt: (biz, industry, target) => `Write an AppSumo product listing for "${biz}" (${industry}, targeting ${target}).

Format:

HEADLINE (max 70 chars — benefit-driven, uses power words):
[headline]

SUBHEADLINE (max 120 chars — expands on the headline, mentions who it's for):
[subheadline]

DESCRIPTION (300-400 words):
- Paragraph 1: the problem (make Sumo-lings feel the pain)
- Paragraph 2: introduce the product — what it does in plain language
- Paragraph 3: 3-4 key features with mini-benefits (bullet friendly)
- Paragraph 4: who it's perfect for
- Paragraph 5: what life looks like after using it

BULLET POINTS (5 crisp feature-benefit bullets for the sidebar):
• [bullet 1]
• [bullet 2]
• [bullet 3]
• [bullet 4]
• [bullet 5]`,
  },
}

const FALLBACKS: Record<string, string> = {
  product_hunt: `TAGLINE\nTurn your business data into a clear growth plan\n\nDESCRIPTION\nAI-powered platform for B2B businesses to track leads, manage proposals, and build marketing plans — all in one place.\n\nFIRST COMMENT\nHey PH community 👋 We built this after spending months in spreadsheets trying to track our pipeline, content, and marketing efforts across 5 different tools. The problem wasn't the tools themselves — it was that none of them talked to each other.\n\nWith CooVex, everything connects: your lead data informs your marketing plan, your content performance feeds into your strategy, and your AI agent gives you daily priorities instead of you hunting for insights.\n\nWe're at [X] paying customers after [X] months, and we'd love your feedback on what we should build next.\n\nTOPICS\nSaaS, Productivity, Marketing, Sales, AI`,
  twitter_x: `Tweet 1\nMost founders track their business across 7+ tools. We built one that does it all — and gives you an AI agent that tells you what to do next.\n\nTweet 2\nHere's the problem: you have leads in a spreadsheet, proposals in Google Docs, content ideas in Notion, and your marketing plan in your head. Nothing talks. You spend your energy managing tools instead of growing.\n\nTweet 3\nWe built CooVex to fix this. One platform for leads, content, campaigns, proposals, competitors, and analytics — with an AI agent that synthesizes it all and gives you your top 3 priorities every morning.\n\nTweet 4\nIn 3 months of beta: users saved 6+ hours/week on admin tasks. The most popular feature? The AI marketing plan that generates a 90-day roadmap connected directly to your tools.\n\nTweet 5\nWe just launched publicly. If you're building a B2B business and tired of juggling 10 tools — check it out: [LINK] 🚀 #SaaS #startup`,
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platform_id } = await req.json().catch(() => ({}))
  if (!platform_id) return NextResponse.json({ error: 'Missing platform_id' }, { status: 400 })

  const config = HELP_CONFIG[platform_id]
  if (!config) return NextResponse.json({ error: 'Unknown platform' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const wsId = profile?.current_workspace_id

  const { data: biz } = wsId
    ? await supabase.from('businesses').select('name, industry, target_customer').eq('workspace_id', wsId).maybeSingle()
    : { data: null }

  const bizName = biz?.name || 'our product'
  const industry = biz?.industry || 'B2B SaaS'
  const target = biz?.target_customer || 'SMBs'

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key') {
    return NextResponse.json({ content: FALLBACKS[platform_id] ?? 'API key not configured.' })
  }

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: config.prompt(bizName, industry, target) }],
    })
    const content = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    return NextResponse.json({ content })
  } catch (err) {
    console.error('[launch-help] error:', err)
    return NextResponse.json({ content: FALLBACKS[platform_id] ?? 'Generation failed. Please try again.' })
  }
}
