import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('support_properties')
    .select('id,name,domain,api_key,from_email,from_name,widget_color,widget_position,widget_title,smtp_host,inbound_email,auto_reply_enabled,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    name, domain,
    smtp_host, smtp_port, smtp_user, smtp_password, smtp_secure,
    from_email, from_name,
    widget_color, widget_position, widget_title, widget_subtitle, welcome_message,
    inbound_email, auto_reply_enabled, auto_reply_message,
  } = body

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('support_properties')
    .insert({
      user_id: user.id,
      name, domain: domain || null,
      smtp_host: smtp_host || null,
      smtp_port: smtp_port || 587,
      smtp_user: smtp_user || null,
      smtp_password: smtp_password || null,
      smtp_secure: smtp_secure ?? false,
      from_email: from_email || null,
      from_name: from_name || null,
      widget_color: widget_color || '#2563eb',
      widget_position: widget_position || 'bottom-right',
      widget_title: widget_title || 'Support',
      widget_subtitle: widget_subtitle || 'How can we help?',
      welcome_message: welcome_message || 'Hi! How can we help you today?',
      inbound_email: inbound_email || null,
      auto_reply_enabled: auto_reply_enabled ?? false,
      auto_reply_message: auto_reply_message || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
