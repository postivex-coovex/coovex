import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { testSmtp } from '@/lib/support/smtp'
import type { SupportProperty } from '@/lib/support/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { property_id, test_to } = body

  const { data: property } = await supabase
    .from('support_properties')
    .select('*')
    .eq('id', property_id)
    .eq('user_id', user.id)
    .single()

  if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

  try {
    await testSmtp(property as SupportProperty, test_to || user.email!)
    return NextResponse.json({ ok: true, message: `Test email sent to ${test_to || user.email}` })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
