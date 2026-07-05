/**
 * LLM Provider Abstraction
 * Provider + API key can be configured from Admin Panel (/admin/settings)
 * and are stored in Supabase admin_settings table.
 * Falls back to environment variables if DB not configured.
 */

import { createServiceClient } from './supabase/service'

export type LLMProvider = 'claude' | 'openai' | 'gemini'

export interface LLMSettings {
  provider: LLMProvider
  claude_api_key?: string
  claude_model?: string
  openai_api_key?: string
  openai_model?: string
  gemini_api_key?: string
  gemini_model?: string
}

export interface LLMMessage {
  role: 'user' | 'assistant'
  content: string
}

// ── In-memory cache (60s TTL) ──────────────────────────────────────────────
let _cachedSettings: LLMSettings | null = null
let _cacheExpiry = 0

async function getSettings(): Promise<LLMSettings> {
  if (_cachedSettings && Date.now() < _cacheExpiry) return _cachedSettings

  try {
    const service = createServiceClient()
    const { data } = await service
      .from('admin_settings')
      .select('key, value')
      .in('key', [
        'llm_provider',
        'claude_api_key', 'claude_model',
        'openai_api_key', 'openai_model',
        'gemini_api_key', 'gemini_model',
      ])

    const map: Record<string, string> = {}
    for (const row of (data ?? [])) {
      if (row.key && row.value) map[row.key] = row.value
    }

    _cachedSettings = {
      provider: (map.llm_provider as LLMProvider) || (process.env.LLM_PROVIDER as LLMProvider) || 'claude',
      claude_api_key:  map.claude_api_key  || process.env.ANTHROPIC_API_KEY,
      claude_model:    map.claude_model    || process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      openai_api_key:  map.openai_api_key  || process.env.OPENAI_API_KEY,
      openai_model:    map.openai_model    || process.env.OPENAI_MODEL || 'gpt-4o',
      gemini_api_key:  map.gemini_api_key  || process.env.GEMINI_API_KEY,
      gemini_model:    map.gemini_model    || process.env.GEMINI_MODEL || 'gemini-1.5-pro',
    }
    _cacheExpiry = Date.now() + 60_000
  } catch {
    // DB not ready yet — use env vars
    _cachedSettings = {
      provider: (process.env.LLM_PROVIDER as LLMProvider) || 'claude',
      claude_api_key: process.env.ANTHROPIC_API_KEY,
      claude_model:   process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      openai_api_key: process.env.OPENAI_API_KEY,
      openai_model:   process.env.OPENAI_MODEL || 'gpt-4o',
      gemini_api_key: process.env.GEMINI_API_KEY,
      gemini_model:   process.env.GEMINI_MODEL || 'gemini-1.5-pro',
    }
    _cacheExpiry = Date.now() + 10_000 // shorter TTL when DB failed
  }

  return _cachedSettings
}

/** Invalidate cache (call after saving new settings) */
export function invalidateLLMCache() {
  _cachedSettings = null
  _cacheExpiry = 0
}

// ── Main chat function ─────────────────────────────────────────────────────
export async function llmChat(
  messages: LLMMessage[],
  system?: string,
  opts?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const settings = await getSettings()
  const { provider } = settings
  const maxTokens = opts?.maxTokens ?? 2048

  if (provider === 'openai') {
    if (!settings.openai_api_key) throw new Error('OpenAI API key not configured')
    const { default: OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: settings.openai_api_key })
    const res = await client.chat.completions.create({
      model: settings.openai_model ?? 'gpt-4o',
      max_tokens: maxTokens,
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
    })
    return res.choices[0]?.message?.content ?? ''
  }

  if (provider === 'gemini') {
    if (!settings.gemini_api_key) throw new Error('Gemini API key not configured')
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genai = new GoogleGenerativeAI(settings.gemini_api_key)
    const model = genai.getGenerativeModel({
      model: settings.gemini_model ?? 'gemini-1.5-pro',
      systemInstruction: system,
    })
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    const lastMessage = messages.at(-1)?.content ?? ''
    const chat = model.startChat({ history })
    const res = await chat.sendMessage(lastMessage)
    return res.response.text()
  }

  // Default: Claude
  if (!settings.claude_api_key) throw new Error('Claude API key not configured')
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: settings.claude_api_key })
  const res = await client.messages.create({
    model: settings.claude_model ?? 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  })
  return res.content[0].type === 'text' ? res.content[0].text : ''
}

/** Get current provider name for display */
export async function getCurrentProvider(): Promise<LLMProvider> {
  const s = await getSettings()
  return s.provider
}

/** Test a provider connection with given credentials */
export async function testLLMConnection(
  provider: LLMProvider,
  apiKey: string,
  model: string
): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
  const start = Date.now()
  try {
    if (provider === 'openai') {
      const { default: OpenAI } = await import('openai')
      const client = new OpenAI({ apiKey })
      const res = await client.chat.completions.create({
        model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok"' }],
      })
      const text = res.choices[0]?.message?.content ?? ''
      if (!text) throw new Error('Empty response')
      return { ok: true, message: `Connected to ${model}`, latencyMs: Date.now() - start }
    }

    if (provider === 'gemini') {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genai = new GoogleGenerativeAI(apiKey)
      const m = genai.getGenerativeModel({ model })
      const res = await m.generateContent('Say "ok"')
      const text = res.response.text()
      if (!text) throw new Error('Empty response')
      return { ok: true, message: `Connected to ${model}`, latencyMs: Date.now() - start }
    }

    // Claude
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey })
    const res = await client.messages.create({
      model,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say "ok"' }],
    })
    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    if (!text) throw new Error('Empty response')
    return { ok: true, message: `Connected to ${model}`, latencyMs: Date.now() - start }
  } catch (err) {
    return { ok: false, message: (err as Error).message }
  }
}
