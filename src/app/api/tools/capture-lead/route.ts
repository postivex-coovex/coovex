import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, name, tool_used, result_json } = body

    if (!email || !tool_used) {
      return NextResponse.json({ error: 'Email and tool_used are required' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    const { error } = await supabase
      .from('free_tool_leads')
      .insert({
        email: email.toLowerCase().trim(),
        name: name?.trim() || null,
        tool_used,
        result_json: result_json || null,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      })

    if (error && !error.message.includes('duplicate')) {
      console.error('Lead capture error:', error)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
