import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const { token, name, email, company, page_url } = await req.json()

  if (!token || !name || !email) {
    return NextResponse.json({ error: 'token, name, email required' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('embed_token', token)
    .maybeSingle()

  if (!business) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  // Duplicate check
  const { data: existing } = await supabase
    .from('leads')
    .select('id')
    .eq('business_id', business.id)
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (!existing) {
    await supabase.from('leads').insert({
      business_id: business.id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: company?.trim() || null,
      source: 'website_form',
      stage: 'new',
      lead_score: 30,
      notes: page_url ? `Captured from: ${page_url}` : null,
    })
  }

  return NextResponse.json({ ok: true }, {
    headers: { 'Access-Control-Allow-Origin': '*' }
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
