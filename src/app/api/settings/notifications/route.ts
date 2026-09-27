import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const prefs = body.preferences_json ?? body

    await supabase
      .from('profiles')
      .update({ preferences_json: prefs })
      .eq('id', user.id)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('preferences_json')
    .eq('id', user.id)
    .single()

  return NextResponse.json({ preferences_json: profile?.preferences_json ?? {} })
}
