import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { goal, tone, business_name } = await req.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key') {
    return NextResponse.json({
      content: `Hi {{first_name}},\n\nWe wanted to reach out with some exciting news from ${business_name || 'us'}.\n\nWe've been working hard to improve our services and wanted you to be the first to know about our latest updates.\n\n[Your main message here]\n\nIf you have any questions, feel free to reply to this email — we'd love to hear from you.\n\nBest regards,\nThe ${business_name || 'Team'}\n\nP.S. If you no longer wish to receive these emails, you can unsubscribe here.`,
    })
  }

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Write a professional marketing email for a business called "${business_name || 'our company'}".
Goal: ${goal || 'newsletter update'}
Tone: ${tone || 'professional and friendly'}

Include personalization token {{first_name}}.
Write just the email body — no subject line, no HTML.
Use short paragraphs. End with a clear CTA.
Include a P.S. line and an unsubscribe note.`,
      }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    return NextResponse.json({ content: text })
  } catch {
    return NextResponse.json({ content: `Hi {{first_name}},\n\nThank you for your continued support of ${business_name || 'our company'}.\n\nWe have some exciting updates to share with you this month.\n\n[Add your message here]\n\nReply to this email if you have any questions.\n\nBest,\nThe ${business_name || 'Team'}` })
  }
}
