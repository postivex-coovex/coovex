import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { calcLLMCostUsd } from '@/lib/llm'
import { deductCreditsAmount } from '@/lib/credits'
import type { LLMMessage, LLMUsage } from '@/lib/llm'

// 100 credits = $1 → 1 credit = $0.01
// CooVex charges 1.25× actual LLM cost
const MARKUP    = 1.25
const USD_PER_CREDIT = 0.01

const SYSTEM_PROMPT = `You are CooVex Dev, an AI agent embedded in WordPress. You execute code changes on behalf of the site owner.

You have full access to the WordPress site — files, database, and configuration. The site owner has granted this access.

ALWAYS respond with ONLY valid JSON in exactly this structure:
{
  "message": "Plain-language summary of what you did or found (shown to user). Be helpful and clear.",
  "changes": [
    {
      "type": "file",
      "action": "create" | "update" | "delete",
      "file": "wp-content/plugins/my-plugin/my-plugin.php",
      "content": "full file content (required for create/update)"
    },
    {
      "type": "db",
      "action": "query",
      "sql": "INSERT INTO {prefix}options ...",
      "description": "What this query does"
    }
  ],
  "read_only": false
}

For informational/read requests (no changes needed), return changes: [] and read_only: true.

RULES — strictly enforced:
- File paths must start with wp-content/ (plugins, themes, mu-plugins, uploads)
- Never touch wp-includes/, wp-admin/, wp-login.php, wp-config.php
- Never use eval(), exec(), system(), shell_exec(), passthru(), proc_open() in generated code
- For DB queries: always use {prefix} as table prefix placeholder. Never hardcode wp_.
- Destructive DB operations (DROP, TRUNCATE, DELETE without WHERE) require explicit confirmation in the message
- When creating a plugin: include a proper WordPress plugin header, use plugin_basename safety checks
- When modifying a theme: prefer child theme unless user explicitly says to modify parent
- Always validate and sanitize all user-facing input in generated code
- Return complete file contents (not diffs) — the agent replaces the whole file
- If a request is impossible, ambiguous, or would cause damage: explain in "message" and return changes: []`

async function callWithAutoSwitch(
  messages: LLMMessage[],
  system: string,
): Promise<{ text: string; usage: LLMUsage }> {
  const { llmChatWithUsage } = await import('@/lib/llm')

  // Try Claude Sonnet first (default)
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('No Claude API key')
    const client = new Anthropic({ apiKey })
    const model = 'claude-sonnet-4-6'
    const res = await client.messages.create({
      model,
      max_tokens: 8192,
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })
    return {
      text: res.content[0].type === 'text' ? res.content[0].text : '',
      usage: { input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens, model, provider: 'claude' },
    }
  } catch (claudeErr) {
    console.warn('[wp-dev] Claude Sonnet failed, switching to OpenAI:', (claudeErr as Error).message)
  }

  // Auto-fallback: OpenAI GPT-4o
  const { default: OpenAI } = await import('openai')
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) throw new Error('Both Claude and OpenAI unavailable')
  const client = new OpenAI({ apiKey: openaiKey })
  const model = 'gpt-4o'
  const res = await client.chat.completions.create({
    model,
    max_tokens: 8192,
    messages: [
      { role: 'system', content: system },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ],
  })
  return {
    text: res.choices[0]?.message?.content ?? '',
    usage: {
      input_tokens: res.usage?.prompt_tokens ?? 0,
      output_tokens: res.usage?.completion_tokens ?? 0,
      model,
      provider: 'openai',
    },
  }
}

interface SiteInfo {
  wp_version?: string
  php_version?: string
  plugins?: string[]
  active_theme?: string
  db_tables?: string[]
  site_url?: string
}

interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { api_key, command, history, site_info }: {
      api_key: string
      command: string
      history?: HistoryMessage[]
      site_info?: SiteInfo
    } = body

    if (!api_key || !command) {
      return NextResponse.json({ error: 'api_key and command required' }, { status: 400 })
    }

    const service = createServiceClient()

    // Validate API key → find workspace
    const { data: business } = await service
      .from('businesses')
      .select('id, workspace_id, name, website_url')
      .eq('api_key', api_key)
      .maybeSingle()

    if (!business) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    // Build context block
    const contextLines = [
      `Site: ${site_info?.site_url ?? business.website_url ?? 'unknown'}`,
      `WordPress: ${site_info?.wp_version ?? 'unknown'}`,
      `PHP: ${site_info?.php_version ?? 'unknown'}`,
      `Active theme: ${site_info?.active_theme ?? 'unknown'}`,
    ]
    if (site_info?.plugins?.length) {
      contextLines.push(`Active plugins (${site_info.plugins.length}): ${site_info.plugins.slice(0, 20).join(', ')}`)
    }
    if (site_info?.db_tables?.length) {
      contextLines.push(`DB tables: ${site_info.db_tables.join(', ')}`)
    }

    const contextBlock = contextLines.join('\n')

    const messages: LLMMessage[] = history?.length
      ? [
          { role: 'user', content: `SITE CONTEXT:\n${contextBlock}` },
          { role: 'assistant', content: 'Understood. Ready for your commands.' },
          ...history,
          { role: 'user', content: command },
        ]
      : [{ role: 'user', content: `SITE CONTEXT:\n${contextBlock}\n\n---\nCOMMAND: ${command}` }]

    // Call AI with auto-switch (Claude Sonnet → OpenAI fallback)
    const { text: raw, usage } = await callWithAutoSwitch(messages, SYSTEM_PROMPT)

    // Parse JSON response
    let parsed: { message: string; changes: unknown[]; read_only?: boolean }
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = { message: raw, changes: [], read_only: true }
    }

    // Billing: actual LLM cost × 1.25 markup, converted to credits (100 credits = $1)
    const llmCostUsd    = calcLLMCostUsd(usage)
    const chargedUsd    = llmCostUsd * MARKUP
    const creditsToDeduct = Math.max(1, Math.ceil(chargedUsd / USD_PER_CREDIT))

    // Deduct credits (returns 402 if insufficient)
    const creditResult = await deductCreditsAmount(
      business.workspace_id,
      creditsToDeduct,
      `CooVex Dev: ${command.slice(0, 60)}`,
    )
    if (!creditResult.ok) {
      return NextResponse.json({ error: creditResult.error }, { status: 402 })
    }

    return NextResponse.json({
      ok: true,
      message: parsed.message,
      changes: parsed.changes ?? [],
      read_only: parsed.read_only ?? false,
      credits_used:      creditsToDeduct,
      credits_remaining: creditResult.balance,
    })
  } catch (err) {
    console.error('POST /api/wp-dev/command error:', err)
    return NextResponse.json({ error: (err as Error).message || 'Internal error' }, { status: 500 })
  }
}
