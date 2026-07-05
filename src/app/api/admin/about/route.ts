import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('site_content')
    .select('value')
    .eq('key', 'about')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data?.value ?? {})
}

export async function POST(req: Request) {
  const supabase = await createServiceClient()
  const value = await req.json()
  const { error } = await supabase
    .from('site_content')
    .upsert({ key: 'about', value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
