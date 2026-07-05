import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Task, TaskVerifySource } from '@/types'

async function checkCondition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  verifyVia: TaskVerifySource,
  businessId: string,
  workspaceId: string,
): Promise<boolean> {
  switch (verifyVia) {
    case 'audit': {
      const { count } = await supabase
        .from('audits').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
      return (count ?? 0) > 0
    }
    case 'integration': {
      const { count } = await supabase
        .from('integrations').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId).eq('status', 'connected')
      return (count ?? 0) > 0
    }
    case 'team': {
      const { count } = await supabase
        .from('profiles').select('*', { count: 'exact', head: true })
        .eq('current_workspace_id', workspaceId)
      return (count ?? 0) > 1
    }
    case 'content': {
      const { count } = await supabase
        .from('posts').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId).eq('status', 'published')
      return (count ?? 0) > 0
    }
    case 'proposal': {
      const { count } = await supabase
        .from('proposals').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
      return (count ?? 0) > 0
    }
    case 'campaign': {
      const { count } = await supabase
        .from('email_campaigns').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
      return (count ?? 0) > 0
    }
    case 'review_responded': {
      const { count } = await supabase
        .from('reviews').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId).eq('status', 'responded')
      return (count ?? 0) > 0
    }
    case 'lead': {
      const { count } = await supabase
        .from('leads').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
      return (count ?? 0) > 0
    }
    default:
      return false
  }
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const { data: business } = await supabase
    .from('businesses').select('id')
    .eq('workspace_id', profile.current_workspace_id).maybeSingle()
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const today = new Date().toISOString().split('T')[0]
  const { data: record } = await supabase
    .from('daily_tasks').select('*')
    .eq('business_id', business.id).eq('date', today).maybeSingle()

  if (!record) return NextResponse.json({ tasks: null })

  const tasks = record.tasks_json as Task[]

  // Only check incomplete tasks that have a verify_via source
  const verifiableIncomplete = tasks.filter(t => !t.completed && t.verify_via)
  if (verifiableIncomplete.length === 0) return NextResponse.json({ tasks: record })

  // Check all conditions in parallel
  const results = await Promise.all(
    verifiableIncomplete.map(t =>
      checkCondition(supabase, t.verify_via!, business.id, profile.current_workspace_id)
    )
  )

  let changed = false
  const updatedTasks = tasks.map(task => {
    if (task.completed || !task.verify_via) return task
    const idx = verifiableIncomplete.findIndex(t => t.id === task.id)
    if (idx === -1) return task
    if (results[idx]) {
      changed = true
      return { ...task, completed: true, auto_completed: true }
    }
    return task
  })

  if (!changed) return NextResponse.json({ tasks: record })

  const completedCount = updatedTasks.filter(t => t.completed).length
  const { data: updated } = await supabase
    .from('daily_tasks')
    .update({ tasks_json: updatedTasks, completed_count: completedCount })
    .eq('id', record.id)
    .select().single()

  return NextResponse.json({ tasks: updated, auto_completed_count: results.filter(Boolean).length })
}
