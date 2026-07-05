import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Public pull API — no cookie auth, uses api_key
// GET /api/public/posts?api_key=xxx&status=approved
// WordPress plugin or any website polls this to get content ready to publish

export async function GET(req: NextRequest) {
  const apiKey = req.nextUrl.searchParams.get('api_key')
  const statusFilter = req.nextUrl.searchParams.get('status') ?? 'pending_approval'

  if (!apiKey) return NextResponse.json({ error: 'api_key required' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('api_key', apiKey)
    .maybeSingle()

  if (!business) return NextResponse.json({ error: 'Invalid api_key' }, { status: 401 })

  const validStatuses = ['draft', 'pending_approval', 'approved']
  const status = validStatuses.includes(statusFilter) ? statusFilter : 'pending_approval'

  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, channel, title, content, status, webhook_status, created_at, scheduled_at')
    .eq('business_id', business.id)
    .eq('status', status)
    .neq('webhook_status', 'confirmed')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    business: business.name,
    posts: posts ?? [],
    total: posts?.length ?? 0,
    pulled_at: new Date().toISOString(),
  })
}
