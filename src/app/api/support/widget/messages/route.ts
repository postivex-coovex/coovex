import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const conversationId = searchParams.get('conversation_id')
  const since          = searchParams.get('since') // ISO timestamp

  if (!conversationId) {
    return NextResponse.json({ error: 'conversation_id required' }, { status: 400, headers: CORS })
  }

  const supabase = await createServiceClient()

  let q = supabase
    .from('support_messages')
    .select('id, content, sender_type, created_at, attachments')
    .eq('conversation_id', conversationId)
    .in('sender_type', ['agent', 'ai'])
    .order('created_at', { ascending: true })

  if (since) q = q.gt('created_at', since)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS })

  return NextResponse.json({ messages: data ?? [] }, { headers: CORS })
}
