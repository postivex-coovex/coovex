import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

interface Message {
  sender_type: string
  sender_name: string | null
  content: string
  created_at: string
}

function buildPrompt(opts: {
  propertyName: string
  propertyDomain: string | null
  customerName: string | null
  messages: Message[]
}): string {
  const { propertyName, propertyDomain, customerName, messages } = opts
  const history = messages
    .slice(-10)
    .map(m => {
      const role = m.sender_type === 'customer' ? 'Customer' : 'Support Agent'
      return `[${role}${m.sender_name ? ` (${m.sender_name})` : ''}]: ${m.content}`
    })
    .join('\n\n')

  return `You are a helpful and professional customer support agent for ${propertyName}${propertyDomain ? ` (${propertyDomain})` : ''}.

Conversation history:
${history}

Write a professional, helpful, and concise reply to the customer${customerName ? ` (${customerName})` : ''}.
- Be direct and solve their issue
- Keep it friendly but professional
- Do NOT use placeholder brackets like [Your Name] — just write the reply
- End with a helpful closing
- Reply in the same language the customer wrote in

Write only the reply text, nothing else:`
}

async function tryAnthropic(prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = response.content[0]
  return block.type === 'text' ? block.text.trim() : ''
}

async function tryOpenAI(prompt: string): Promise<string> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })
  return response.choices[0]?.message?.content?.trim() ?? ''
}

export async function generateAiReply(opts: {
  propertyName: string
  propertyDomain: string | null
  customerName: string | null
  customerEmail: string | null
  subject: string | null
  messages: Message[]
}): Promise<string> {
  const prompt = buildPrompt(opts)

  // Try Anthropic first, fall back to OpenAI
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await tryAnthropic(prompt)
    } catch {
      // Fall through to OpenAI
    }
  }

  if (process.env.OPENAI_API_KEY) {
    return await tryOpenAI(prompt)
  }

  throw new Error('No AI provider configured (ANTHROPIC_API_KEY or OPENAI_API_KEY required)')
}
