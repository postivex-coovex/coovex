import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

const ACTION_META: Record<string, { label: string; icon: string; color: string }> = {
  respond_review:  { label: 'Review Response Published',   icon: '⭐', color: 'text-blue-400'    },
  approve_post:    { label: 'Social Post Published',        icon: '📱', color: 'text-violet-400'  },
  view_lead:       { label: 'Follow-up Email Queued',       icon: '📧', color: 'text-emerald-400' },
  user_bulk:       { label: 'Bulk Action',                  icon: '⚡', color: 'text-amber-400'   },
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100)
  const filter = url.searchParams.get('filter') ?? 'all'   // all | auto | user

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single()

  const service = createServiceClient()

  let query = service
    .from('agent_activity_log')
    .select('*')
    .eq('workspace_id', profile?.current_workspace_id)
    .order('executed_at', { ascending: false })
    .limit(limit)

  if (filter === 'auto') {
    query = query.eq('executed_by', 'agent')
  } else if (filter === 'user') {
    query = query.in('executed_by', ['user', 'user_bulk'])
  }

  const { data: logs, error } = await query

  // If table doesn't exist yet, return empty
  if (error) {
    return NextResponse.json({ logs: [], total: 0 })
  }

  const enriched = (logs ?? []).map(log => {
    const meta = ACTION_META[log.action_type] ?? ACTION_META[log.executed_by] ?? {
      label: log.action_type,
      icon: '🤖',
      color: 'text-slate-400',
    }
    return {
      id: log.id,
      action_type: log.action_type,
      label: meta.label,
      icon: meta.icon,
      color: meta.color,
      executed_by: log.executed_by,
      executed_at: log.executed_at,
      confidence: log.action_data_json?.confidence ?? null,
      result: log.result_json,
      signal_id: log.signal_id,
    }
  })

  const autoCount = enriched.filter(l => l.executed_by === 'agent').length
  const userCount = enriched.filter(l => l.executed_by !== 'agent').length

  return NextResponse.json({
    logs: enriched,
    total: enriched.length,
    auto_count: autoCount,
    user_count: userCount,
  })
}
