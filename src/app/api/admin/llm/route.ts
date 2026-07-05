import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { testLLMConnection, invalidateLLMCache, type LLMProvider } from '@/lib/llm'

function isAdmin(email: string) {
  return (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).includes(email)
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email ?? '')) return null
  return user
}

// GET — current settings (API keys masked)
export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  const { data } = await service
    .from('admin_settings')
    .select('key, value')
    .in('key', ['llm_provider','claude_api_key','claude_model','openai_api_key','openai_model','gemini_api_key','gemini_model'])

  const map: Record<string, string> = {}
  for (const row of (data ?? [])) {
    if (row.key && row.value) map[row.key] = row.value
  }

  const mask = (val?: string) => {
    if (!val) return ''
    return '••••••••••••' + val.slice(-6)
  }

  return NextResponse.json({
    provider:          map.llm_provider  || process.env.LLM_PROVIDER       || 'claude',
    claude_key_masked: mask(map.claude_api_key  || process.env.ANTHROPIC_API_KEY),
    claude_model:      map.claude_model  || process.env.CLAUDE_MODEL        || 'claude-sonnet-4-6',
    claude_configured: !!(map.claude_api_key  || process.env.ANTHROPIC_API_KEY),
    openai_key_masked: mask(map.openai_api_key  || process.env.OPENAI_API_KEY),
    openai_model:      map.openai_model  || process.env.OPENAI_MODEL        || 'gpt-4o',
    openai_configured: !!(map.openai_api_key  || process.env.OPENAI_API_KEY),
    gemini_key_masked: mask(map.gemini_api_key  || process.env.GEMINI_API_KEY),
    gemini_model:      map.gemini_model  || process.env.GEMINI_MODEL        || 'gemini-1.5-pro',
    gemini_configured: !!(map.gemini_api_key  || process.env.GEMINI_API_KEY),
  })
}

// POST — save settings
export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as {
    provider?: string
    claude_api_key?: string; claude_model?: string
    openai_api_key?: string; openai_model?: string
    gemini_api_key?: string; gemini_model?: string
  }

  const service = createServiceClient()
  const now = new Date().toISOString()
  const upserts: { key: string; value: string; updated_at: string }[] = []
  const add = (key: string, val?: string) => {
    if (val && val.trim() && !val.includes('•')) upserts.push({ key, value: val.trim(), updated_at: now })
  }

  if (body.provider) upserts.push({ key: 'llm_provider', value: body.provider, updated_at: now })
  add('claude_model',  body.claude_model)
  add('claude_api_key', body.claude_api_key)
  add('openai_model',  body.openai_model)
  add('openai_api_key', body.openai_api_key)
  add('gemini_model',  body.gemini_model)
  add('gemini_api_key', body.gemini_api_key)

  if (upserts.length > 0) {
    const { error } = await service.from('admin_settings').upsert(upserts, { onConflict: 'key' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  invalidateLLMCache()
  return NextResponse.json({ ok: true })
}

// PUT — test connection
export async function PUT(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { provider, api_key, model } = await req.json() as {
    provider: LLMProvider; api_key: string; model: string
  }
  if (!provider || !api_key || api_key.includes('•') || !model) {
    return NextResponse.json({ ok: false, message: 'Enter the full API key to test' })
  }

  const result = await testLLMConnection(provider, api_key, model)
  return NextResponse.json(result)
}
