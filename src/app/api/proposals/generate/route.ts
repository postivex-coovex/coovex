import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/credits'

const MOCK_PROPOSAL = {
  title: 'Business Growth Partnership Proposal',
  sections: [
    { heading: 'Executive Summary', body: 'We are delighted to present this proposal outlining how our services can help your organization achieve significant growth. Based on our analysis, we have identified key opportunities to drive measurable results within 90 days.' },
    { heading: 'Understanding Your Needs', body: 'Through our initial conversations, we understand that your primary goals are to increase lead generation, improve online visibility, and streamline your marketing operations. We have tailored this proposal specifically to address these objectives.' },
    { heading: 'Our Solution', body: 'We propose a comprehensive engagement covering three core pillars: (1) Digital presence optimization to improve your SEO and website performance, (2) Targeted lead generation campaigns across LinkedIn and Google, and (3) Monthly reporting and strategy sessions to ensure continuous improvement.' },
    { heading: 'Investment & Timeline', body: 'Phase 1 (Months 1–2): Audit, strategy development, and initial campaigns — $3,500/month.\nPhase 2 (Months 3–6): Full campaign execution and optimization — $5,000/month.\nAll work includes weekly check-ins, monthly reports, and a dedicated account manager.' },
    { heading: 'Why Choose Us', body: 'We have helped over 50 businesses in your industry grow their revenue by an average of 40% within 12 months. Our approach is data-driven, transparent, and entirely focused on your bottom line.' },
    { heading: 'Next Steps', body: 'We would love to schedule a 30-minute call to walk you through this proposal in detail and answer any questions. Please reply to this email or call us at your convenience. We are ready to get started.' },
  ],
  footer: 'This proposal is valid for 30 days from the date of issue.',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { client_name, client_company, service_description, budget, timeline, notes } = await req.json()
  if (!client_name || !service_description) {
    return NextResponse.json({ error: 'client_name and service_description required' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id, name').eq('id', user.id).single()
  const { data: business } = await supabase.from('businesses').select('name, industry, target_customer, country').eq('workspace_id', profile?.current_workspace_id).maybeSingle()

  let creditBalance: number | undefined
  if (profile?.current_workspace_id) {
    const credit = await deductCredits(profile.current_workspace_id, 'proposal_generate', 'Proposal generation')
    if (!credit.ok) return NextResponse.json({ error: credit.error }, { status: 402 })
    creditBalance = credit.balance
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key') {
    return NextResponse.json({ proposal: MOCK_PROPOSAL }, creditBalance !== undefined ? { headers: { 'X-Credits-Remaining': String(creditBalance) } } : undefined)
  }

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Generate a professional business proposal. Return ONLY valid JSON matching the exact schema below.

Sender: ${business?.name || 'Our Company'} (${business?.industry || 'Business Services'})
Client: ${client_name}${client_company ? ` at ${client_company}` : ''}
Service: ${service_description}
${budget ? `Budget: ${budget}` : ''}
${timeline ? `Timeline: ${timeline}` : ''}
${notes ? `Additional notes: ${notes}` : ''}

Return JSON with exactly this structure:
{
  "title": "proposal title",
  "sections": [
    {"heading": "Executive Summary", "body": "..."},
    {"heading": "Understanding Your Needs", "body": "..."},
    {"heading": "Our Solution", "body": "..."},
    {"heading": "Investment & Timeline", "body": "..."},
    {"heading": "Why Choose Us", "body": "..."},
    {"heading": "Next Steps", "body": "..."}
  ],
  "footer": "proposal valid notice"
}

Write professional, persuasive business English. Be specific, not generic. The body should be 3-5 sentences each.`
      }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const proposal = JSON.parse(match[0])
      return NextResponse.json({ proposal }, creditBalance !== undefined ? { headers: { 'X-Credits-Remaining': String(creditBalance) } } : undefined)
    }
  } catch {
    // fall through to mock
  }

  return NextResponse.json({ proposal: MOCK_PROPOSAL }, creditBalance !== undefined ? { headers: { 'X-Credits-Remaining': String(creditBalance) } } : undefined)
}
