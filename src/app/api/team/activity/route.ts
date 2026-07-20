import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// GET — fetch activity logs for current workspace
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  if (!profile?.current_workspace_id) return NextResponse.json({ logs: [] })

  const service = createServiceClient()

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  let query = service
    .from('activity_logs')
    .select('id, user_id, user_email, user_name, action, description, credits_used, metadata, created_at')
    .eq('workspace_id', profile.current_workspace_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (userId) query = query.eq('user_id', userId)

  const { data: logs } = await query
  return NextResponse.json({ logs: logs ?? [] })
}
