import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { research_context = '' } = await req.json().catch(() => ({}))
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabaseClient = await createClient()
  const { data: profile } = await supabaseClient.from('profiles').select('current_workspace_id').eq('id', user.id).single()

  const { data: business } = profile?.current_workspace_id
    ? await supabaseClient.from('businesses').select('name, industry, description, target_customer').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  const { data: products } = await supabaseClient
    .from('products')
    .select('name, type, tagline, description, target_audience')
    .limit(3)

  const { data: lead } = await supabaseClient
    .from('leads')
    .select('name, email, company, job_title, source, stage, notes')
    .eq('id', id)
    .single()

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const productList = (products ?? []).map(p => `- ${p.name}: ${p.tagline ?? p.description ?? ''}`).join('\n')

  const prompt = `You are a sales coach. Generate a concise phone call script for reaching out to this lead.

SELLER: ${business?.name ?? 'Our Company'} — ${business?.description ?? ''}
PRODUCTS/SERVICES:
${productList || '- Not specified'}

LEAD:
- Name: ${lead.name}
- Company/Org: ${lead.company ?? lead.notes ?? 'Unknown'}
- Job Title: ${lead.job_title ?? 'Unknown'}
- Stage: ${lead.stage}
- Notes: ${lead.notes ?? 'none'}
${research_context ? `\nRESEARCH INTELLIGENCE (use this to personalize the script):\n${research_context}` : ''}

Generate a call script as JSON with this structure:
{
  "opening": "First 10 seconds — introduce yourself and why you're calling",
  "discovery": "2-3 discovery questions to understand their needs",
  "pitch": "Core value proposition in 2-3 sentences",
  "objections": [
    {"obj": "Common objection 1", "response": "How to handle it"},
    {"obj": "Common objection 2", "response": "How to handle it"},
    {"obj": "Common objection 3", "response": "How to handle it"}
  ],
  "closing": "Clear CTA to end the call (schedule demo, follow-up email, etc.)"
}

Be specific to this lead's context. Keep it natural and conversational. Return ONLY the JSON.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (message.content[0] as { text: string }).text.trim()
  try {
    const json = text.startsWith('{') ? text : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    return NextResponse.json(JSON.parse(json))
  } catch {
    return NextResponse.json({ error: 'Failed to parse script', raw: text }, { status: 500 })
  }
}
