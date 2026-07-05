import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tone = 'professional', research_context = '', product_id = null } = await req.json().catch(() => ({}))

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('name, industry, description, target_customer').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  const { data: lead } = await supabase
    .from('leads')
    .select('name, email, company, job_title, source, stage, notes, lead_score')
    .eq('id', id)
    .single()

  const { data: product } = product_id
    ? await supabase.from('products').select('name, tagline, description, price, price_unit, currency, key_benefits, target_audience').eq('id', product_id).single()
    : { data: null }

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const isMock = !process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key'

  if (isMock) {
    const email = `Subject: Quick question about ${lead.company || 'your business'} — ${business?.name ?? 'CooVex'}

Hi ${lead.name.split(' ')[0]},

I came across ${lead.company || 'your work'} and wanted to reach out — we help ${business?.target_customer === 'b2b' ? 'businesses' : 'brands'} in the ${business?.industry || 'industry'} space ${business?.description ? 'with ' + business.description.slice(0, 60) + '…' : 'grow faster with AI'}.

Given your role${lead.job_title ? ' as ' + lead.job_title : ''}, I thought this might be relevant. Would you be open to a quick 15-minute call this week?

Best,
[Your Name]
${business?.name ?? 'Your Company'}`
    return NextResponse.json({ email, subject: `Quick question about ${lead.company || 'your business'}` })
  }

  const stageContext = {
    new: 'This is a cold outreach — they have not been contacted yet.',
    contacted: 'We have reached out once but haven\'t heard back.',
    qualified: 'This lead is qualified and interested.',
    proposal_sent: 'A proposal has already been sent — this is a follow-up.',
    won: 'This is a won customer — draft a check-in or upsell.',
    lost: 'This lead was lost — draft a re-engagement attempt.',
  }[lead.stage as string] ?? ''

  const productSection = product
    ? `PRODUCT/SERVICE BEING PITCHED:
- Name: ${product.name}${product.tagline ? ` — ${product.tagline}` : ''}
- Description: ${product.description ?? ''}
- Price: ${product.price ? `${product.currency ?? 'USD'} ${product.price} ${product.price_unit ?? ''}` : 'custom pricing'}
- Key Benefits: ${product.key_benefits ?? ''}
- Target Audience: ${product.target_audience ?? ''}`
    : `PITCH CONTEXT: Write based on the overall business offering — no specific product selected.`

  const prompt = `You are writing a ${tone} outreach email on behalf of ${business?.name ?? 'our company'} (${business?.industry ?? 'business services'}).

BUSINESS: ${business?.name} — ${business?.description ?? ''} targeting ${business?.target_customer?.toUpperCase() ?? 'B2B'} clients.

${productSection}

LEAD:
- Name: ${lead.name}
- Company: ${lead.company ?? 'unknown'}
- Job Title: ${lead.job_title ?? 'unknown'}
- Notes: ${lead.notes ?? 'none'}
- Stage context: ${stageContext}
${research_context ? `\nRESEARCH INTELLIGENCE (use this to personalize):\n${research_context}` : ''}

Write a short, personalized outreach email (2-3 short paragraphs).
Tone: ${tone}. ${product ? `Focus the email on the product "${product.name}" and how it specifically helps the lead.` : 'Keep it general but relevant to the business.'}
Include a subject line on the first line as "Subject: ...".
No fluff. End with a clear, low-friction CTA.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (message.content[0] as { text: string }).text
  const lines = text.split('\n')
  const subjectLine = lines.find(l => l.startsWith('Subject:'))
  const subject = subjectLine ? subjectLine.replace('Subject:', '').trim() : `Following up — ${business?.name}`
  const body = lines.filter(l => !l.startsWith('Subject:')).join('\n').trim()

  return NextResponse.json({ email: body, subject })
}
