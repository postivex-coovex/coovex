import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { task_title, task_desc, website_url, business_name, business_desc } = await req.json()
  if (!task_title) return NextResponse.json({ error: 'task_title required' }, { status: 400 })

  const systemPrompt = `You are an expert web developer and SEO/GEO specialist. Generate ready-to-use code or file content to fix a specific website issue.

Rules:
- Output ONLY the actual fix (code, file content, or step-by-step instructions)
- Use the business info provided to make it specific and accurate
- Format code blocks with language tags
- Keep explanations minimal — just what's needed to implement
- If generating a file, output the complete file content
- If generating HTML/code snippets, show exactly where to place them`

  const prompt = `Fix this issue for ${business_name || 'the website'} (${website_url || 'their website'}):

Issue: ${task_title}
Details: ${task_desc}
${business_desc ? `Business: ${business_desc}` : ''}

Generate the complete, ready-to-use fix. Be specific to this business.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
    system: systemPrompt,
  })

  const fix = message.content[0].type === 'text' ? message.content[0].text : ''
  return NextResponse.json({ fix })
}
