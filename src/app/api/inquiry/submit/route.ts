// Public endpoint — receives form submissions from any website
// Requires: api_key, domain, email (mandatory)
// All other fields stored dynamically in extra_fields JSONB
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {}
  const ct = req.headers.get('content-type') || ''

  try {
    if (ct.includes('application/json')) {
      body = await req.json()
    } else {
      const fd = await req.formData()
      fd.forEach((v, k) => { body[k] = v })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400, headers: CORS })
  }

  const apiKey = (body.api_key || body.apiKey) as string | undefined
  const domain = (body.domain) as string | undefined
  const email  = (body.email)  as string | undefined

  if (!apiKey)  return NextResponse.json({ error: 'api_key is required' },  { status: 400, headers: CORS })
  if (!domain)  return NextResponse.json({ error: 'domain is required' },   { status: 400, headers: CORS })
  if (!email)   return NextResponse.json({ error: 'email is required' },    { status: 400, headers: CORS })

  const supabase = serviceClient()

  // Resolve user from api_key
  const { data: keyRow } = await supabase
    .from('inquiry_api_keys')
    .select('user_id')
    .eq('api_key', apiKey)
    .single()

  if (!keyRow) {
    return NextResponse.json({ error: 'Invalid api_key' }, { status: 401, headers: CORS })
  }

  const userId = keyRow.user_id

  // Normalise domain (strip protocol/path, lowercase)
  const cleanDomain = domain.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase().trim()

  // Find or auto-create property for this domain
  let propertyId: string

  const { data: existing } = await supabase
    .from('inquiry_properties')
    .select('id')
    .eq('user_id', userId)
    .eq('domain', cleanDomain)
    .single()

  if (existing) {
    propertyId = existing.id
  } else {
    const { data: created, error: createErr } = await supabase
      .from('inquiry_properties')
      .insert({ user_id: userId, domain: cleanDomain })
      .select('id')
      .single()
    if (createErr || !created) {
      return NextResponse.json({ error: 'Failed to create property' }, { status: 500, headers: CORS })
    }
    propertyId = created.id
  }

  // Build extra_fields — everything except reserved keys
  const RESERVED = new Set(['api_key', 'apiKey', 'domain', 'email'])
  const extra: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (!RESERVED.has(k)) extra[k] = v
  }

  // Insert submission
  const { data: submission, error: subErr } = await supabase
    .from('inquiry_submissions')
    .insert({
      property_id:  propertyId,
      user_id:      userId,
      domain:       cleanDomain,
      email:        (email as string).toLowerCase().trim(),
      extra_fields: extra,
      source_url:   req.headers.get('referer') || null,
    })
    .select('id')
    .single()

  if (subErr || !submission) {
    return NextResponse.json({ error: 'Failed to save submission' }, { status: 500, headers: CORS })
  }

  return NextResponse.json({ ok: true, id: submission.id }, { headers: CORS })
}
