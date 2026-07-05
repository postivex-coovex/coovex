import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const MOCK_REPLIES = [
  "Thanks for reaching out! I'm here to help. Could you tell me a bit more about what you're looking for?",
  "Great question! We'd love to help you with that. Can I get your name and email so we can follow up?",
  "Absolutely! Our team specialises in exactly that. Would you like to book a quick call to discuss further?",
]
let mockIdx = 0

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { messages, visitor_name } = await req.json()

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 })
  }

  // Fetch chatbot config (table may not exist — graceful fallback)
  let config = {
    name: 'AI Assistant',
    system_prompt: 'You are a friendly business assistant. Help visitors with questions and try to capture their contact details (name + email) so the team can follow up. Be concise, warm, and helpful. Keep replies under 80 words.',
    is_active: true,
    business_name: 'this business',
  }

  try {
    const supabase = await createClient()
    const { data: row } = await supabase
      .from('chatbot_configs')
      .select('name, system_prompt, is_active, businesses(name)')
      .eq('id', id)
      .maybeSingle()

    if (row) {
      config = {
        name: row.name || config.name,
        system_prompt: row.system_prompt || config.system_prompt,
        is_active: row.is_active ?? true,
        business_name: (row.businesses as { name?: string } | null)?.name || config.business_name,
      }
    }
  } catch { /* table might not exist */ }

  if (!config.is_active) {
    return NextResponse.json({ reply: "We're currently offline. Please check back later or send us an email." })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key') {
    const reply = MOCK_REPLIES[mockIdx % MOCK_REPLIES.length]
    mockIdx++
    return NextResponse.json({ reply })
  }

  try {
    const client = new Anthropic({ apiKey })
    const systemPrompt = `${config.system_prompt}\n\nYou are the AI assistant for ${config.business_name}. Your name is ${config.name}.${visitor_name ? ` You are talking to ${visitor_name}.` : ''}`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ reply })
  } catch {
    return NextResponse.json({ reply: "Sorry, I'm having trouble right now. Please try again in a moment." })
  }
}
