import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/credits'

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_business_stats',
    description: 'Get the current business stats: lead count, post count, review count, health score, recent signals.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'create_post_draft',
    description: 'Create a draft post for the specified channel. Use when the user asks to write or create a post.',
    input_schema: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: 'The post content text' },
        channel: { type: 'string', enum: ['linkedin', 'facebook', 'instagram', 'tiktok', 'wordpress'], description: 'Social channel' },
        topic: { type: 'string', description: 'Brief topic label' },
      },
      required: ['content', 'channel'],
    },
  },
  {
    name: 'add_lead',
    description: 'Add a new lead to the pipeline.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        company: { type: 'string' },
        phone: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_recent_leads',
    description: 'Get the top 5 most recent or highest-scored leads.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_recent_signals',
    description: 'Get recent undismissed agent signals/alerts.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'navigate_to',
    description: 'Tell the user to navigate to a specific page in the app.',
    input_schema: {
      type: 'object' as const,
      properties: {
        page: { type: 'string', enum: ['leads', 'content', 'reviews', 'audit', 'analytics', 'trends', 'competitors', 'settings', 'dashboard'] },
      },
      required: ['page'],
    },
  },
]

async function executeTool(name: string, input: Record<string, unknown>, context: {
  supabase: Awaited<ReturnType<typeof createClient>>
  businessId: string
  userId: string
  workspaceId: string
}): Promise<string> {
  const { supabase, businessId, userId } = context

  switch (name) {
    case 'get_business_stats': {
      const [{ count: leads }, { count: posts }, { count: reviews }, { data: biz }, { data: signals }] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', businessId),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', businessId),
        supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', businessId),
        supabase.from('businesses').select('health_score, name').eq('id', businessId).single(),
        supabase.from('agent_signals').select('type, title').eq('business_id', businessId).eq('dismissed', false).limit(5),
      ])
      return JSON.stringify({ leads, posts, reviews, health_score: biz?.health_score, business_name: biz?.name, urgent_signals: signals?.filter(s => s.type === 'urgent').length ?? 0 })
    }

    case 'create_post_draft': {
      const { content, channel, topic } = input as { content: string; channel: string; topic?: string }
      const { data: post, error } = await supabase.from('posts').insert({
        business_id: businessId,
        channel,
        content,
        status: 'draft',
        scheduled_at: null,
      }).select('id').single()
      if (error) return JSON.stringify({ error: error.message })
      return JSON.stringify({ success: true, post_id: post.id, message: `Draft ${channel} post created. View it in /content.`, action_url: '/content' })
    }

    case 'add_lead': {
      const { name, email, company, phone, notes } = input as { name: string; email?: string; company?: string; phone?: string; notes?: string }
      const { data: lead, error } = await supabase.from('leads').insert({
        business_id: businessId,
        name,
        email: email || null,
        company: company || null,
        phone: phone || null,
        notes: notes || null,
        source: 'manual',
        stage: 'new',
        score: 50,
        assigned_to: userId,
      }).select('id').single()
      if (error) return JSON.stringify({ error: error.message })
      return JSON.stringify({ success: true, lead_id: lead.id, message: `Lead "${name}" added to pipeline.`, action_url: `/leads/${lead.id}` })
    }

    case 'get_recent_leads': {
      const { data: leads } = await supabase.from('leads').select('name, email, company, stage, score').eq('business_id', businessId).order('score', { ascending: false }).limit(5)
      return JSON.stringify({ leads: leads || [] })
    }

    case 'get_recent_signals': {
      const { data: signals } = await supabase.from('agent_signals').select('type, title, body').eq('business_id', businessId).eq('dismissed', false).order('created_at', { ascending: false }).limit(10)
      return JSON.stringify({ signals: signals || [] })
    }

    case 'navigate_to': {
      const { page } = input as { page: string }
      return JSON.stringify({ action_url: `/${page}`, message: `Opening ${page}...` })
    }

    default:
      return JSON.stringify({ error: 'Unknown tool' })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { message, history = [], page_context = '' } = await request.json()
    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey === 'your_anthropic_api_key') {
      return NextResponse.json({ reply: "I'm offline — add ANTHROPIC_API_KEY to .env.local to enable me." })
    }

    const { data: profile } = await supabase.from('profiles').select('current_workspace_id, name').eq('id', user.id).single()

    // Deduct AI credits
    let creditBalance: number | undefined
    if (profile?.current_workspace_id) {
      const credit = await deductCredits(profile.current_workspace_id, 'chat_message')
      if (!credit.ok) return NextResponse.json({ error: credit.error }, { status: 402 })
      creditBalance = credit.balance
    }
    const { data: business } = profile?.current_workspace_id
      ? await supabase.from('businesses').select('id, name, industry, target_customer, country, health_score, website_intel').eq('workspace_id', profile.current_workspace_id).maybeSingle()
      : { data: null }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const intel = business ? (business as any).website_intel as Record<string, unknown> | null : null
    const intelBlock = intel ? `
Website intelligence (scraped & AI-extracted):
- Description: ${intel.description || '—'}
- Services: ${(intel.services as string[] | undefined)?.join(', ') || '—'}
- Target market: ${intel.target_market || '—'}
- Pricing model: ${intel.pricing_model || '—'}
- USP: ${intel.unique_value_proposition || '—'}
- Clients: ${(intel.clients as string[] | undefined)?.join(', ') || 'none listed'}
- Missing elements: ${(intel.missing_elements as string[] | undefined)?.join(', ') || 'none'}
- Content quality score: ${intel.content_quality_score ?? '—'}/100` : ''

    const systemPrompt = `You are an AI Business Coach for CooVex — a smart business intelligence platform. You help the owner grow their business.

${business ? `Business context:
- Name: ${business.name}
- Industry: ${business.industry}
- Target customer: ${business.target_customer}
- Country: ${business.country}
- Health score: ${business.health_score}/100
- Owner: ${profile?.name || 'there'}
${intelBlock}` : ''}

You have tools to take REAL actions in the platform. When the user asks you to create a post, add a lead, or get data — USE THE TOOLS, don't just describe what to do.

After using a tool, give a brief human-readable summary of what you did. Keep responses concise and actionable.${page_context ? `\n\nUser is currently on: ${page_context}. Tailor your advice to what they're looking at.` : ''}`

    const client = new Anthropic({ apiKey })

    // Build message history
    const msgs: Anthropic.MessageParam[] = [
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ]

    let actionUrl: string | null = null
    let toolResults: Array<{ tool: string; result: unknown }> = []

    // Agentic loop — handle tool calls
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      tools: business ? TOOLS : [],
      messages: msgs,
    })

    let finalText = ''

    if (response.stop_reason === 'tool_use' && business) {
      // Execute tools — charge extra credits for tool actions
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
      const toolResultContents: Anthropic.ToolResultBlockParam[] = []

      // Deduct extra credits for tool invocations (e.g. creating a post, adding a lead)
      if (profile?.current_workspace_id && toolUseBlocks.length > 0) {
        await deductCredits(profile.current_workspace_id, 'chat_tool_action',
          `Chat tool: ${toolUseBlocks.map(b => b.name).join(', ')}`)
      }

      for (const block of toolUseBlocks) {
        const result = await executeTool(block.name, block.input as Record<string, unknown>, {
          supabase,
          businessId: business.id,
          userId: user.id,
          workspaceId: profile?.current_workspace_id || '',
        })
        toolResultContents.push({ type: 'tool_result', tool_use_id: block.id, content: result })
        const parsed = JSON.parse(result)
        toolResults.push({ tool: block.name, result: parsed })
        if (parsed.action_url) actionUrl = parsed.action_url
      }

      // Get final response after tool use
      const finalResponse = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        tools: TOOLS,
        messages: [
          ...msgs,
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResultContents },
        ],
      })

      finalText = finalResponse.content
        .filter(b => b.type === 'text')
        .map(b => (b as Anthropic.TextBlock).text)
        .join('')
    } else {
      finalText = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as Anthropic.TextBlock).text)
        .join('')
    }

    return NextResponse.json({ reply: finalText, action_url: actionUrl, tool_results: toolResults }, creditBalance !== undefined ? { headers: { 'X-Credits-Remaining': String(creditBalance) } } : undefined)
  } catch (error) {
    console.error('Coach chat error:', error)
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 })
  }
}
