import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()

  const { data: business } = await supabase
    .from('businesses').select('id')
    .eq('workspace_id', profile?.current_workspace_id).maybeSingle()

  if (!business) return NextResponse.json({ error: 'No business found' }, { status: 404 })

  const body = await req.json()
  const { name, industry, website_url, description, country, size, target_customer } = body

  const { error } = await supabase
    .from('businesses')
    .update({ name, industry, website_url: website_url || null, description: description || null, country, size, target_customer })
    .eq('id', business.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
