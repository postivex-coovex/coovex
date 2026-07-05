import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, context, business_name, industry, target_customer } = await req.json().catch(() => ({}))

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key') {
    return NextResponse.json({ content: getFallback(type, business_name) })
  }

  const prompts: Record<string, string> = {
    linkedin_post: `Write a compelling LinkedIn post for ${business_name || 'this business'} (${industry || 'B2B SaaS'} targeting ${target_customer || 'SMBs'}).

Context: ${context}

Write ONE complete LinkedIn post:
- Hook in first line (no emojis in hook — make it a bold statement or question)
- 3-5 lines of insight or story
- End with a clear call to action or question to drive comments
- 2-3 relevant hashtags at bottom
- Max 200 words
- Tone: expert, direct, not salesy

Return ONLY the post text, nothing else.`,

    email_sequence: `Write a 3-email cold outreach sequence for ${business_name || 'this business'} (${industry || 'B2B SaaS'}).

Context: ${context}

Write exactly 3 emails:

EMAIL 1 — SUBJECT: [subject line]
[email body — 60-80 words, value-first, no pitch]

EMAIL 2 (Day 4) — SUBJECT: [subject line]
[email body — 50-70 words, one specific result or case study]

EMAIL 3 (Day 9) — SUBJECT: [subject line]
[email body — 40-50 words, direct ask + easy out]

Rules: No "I hope this email finds you well." No generic openers. Each email must have a clear reason for reaching out.`,

    ad_copy: `Write 3 LinkedIn ad variations for ${business_name || 'this business'} (${industry || 'B2B SaaS'}).

Context: ${context}

For each ad write:
HEADLINE: (max 70 chars)
BODY: (max 150 chars)
CTA: [one button label]

3 angles: (1) Pain-focused, (2) Result-focused, (3) Social proof/curiosity

Return only the 3 variations.`,

    linkedin_bio: `Write a LinkedIn profile optimization for ${business_name || 'this business'} founder/CEO (${industry || 'B2B SaaS'} targeting ${target_customer || 'SMBs'}).

Context: ${context}

Write:
HEADLINE: (max 220 chars — not just job title, explain who you help and how)
ABOUT SECTION: (max 350 words — tell a story, show expertise, end with CTA)

Return only the headline and about section.`,
  }

  const prompt = prompts[type] ?? `Write helpful marketing content for: ${context}`

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })
    const content = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    return NextResponse.json({ content })
  } catch {
    return NextResponse.json({ content: getFallback(type, business_name) })
  }
}

function getFallback(type: string, biz: string): string {
  if (type === 'linkedin_post') return `Most ${biz || 'businesses'} are leaving money on the table.\n\nNot because they have a bad product.\nBut because they're invisible to the people who need them most.\n\nHere's what we changed that added $10K MRR in 60 days:\n→ Talked about problems, not features\n→ Posted daily — even if it wasn't perfect\n→ Followed up with every single reply\n\nConsistency beats perfection every time.\n\nWhat's one marketing habit you'd commit to for the next 30 days?\n\n#B2B #GrowthMarketing #Founder`
  if (type === 'email_sequence') return `EMAIL 1 — SUBJECT: Quick question about [their company]\n\nHi [Name],\n\nNoticed you're building [something relevant]. Most teams at your stage struggle with [specific problem]. We built a tool that [specific result].\n\nWorth a 15-minute call this week?\n\n[Your name]\n\n---\n\nEMAIL 2 (Day 4) — SUBJECT: [Company] + [Your company]\n\nHi [Name],\n\n[Client name] was dealing with the same problem — [specific result] in 60 days.\n\nHappy to share exactly what they did. Worth a quick chat?\n\n---\n\nEMAIL 3 (Day 9) — SUBJECT: Closing the loop\n\nHi [Name],\n\nNo worries if timing isn't right. I'll stop reaching out.\n\nIf you ever want to explore [specific outcome], just reply "yes" and I'll send over some options.\n\n[Your name]`
  return 'AI content generation unavailable. Please check your API key.'
}
