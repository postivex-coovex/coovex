import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export interface LogActivityParams {
  action: string
  description: string
  credits_used?: number
  business_id?: string
  metadata?: Record<string, unknown>
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_workspace_id, name')
      .eq('id', user.id)
      .single()
    if (!profile?.current_workspace_id) return

    const service = createServiceClient()
    await service.from('activity_logs').insert({
      workspace_id:  profile.current_workspace_id,
      business_id:   params.business_id ?? null,
      user_id:       user.id,
      user_email:    user.email ?? null,
      user_name:     profile.name ?? null,
      action:        params.action,
      description:   params.description,
      credits_used:  params.credits_used ?? 0,
      metadata:      params.metadata ?? {},
    })
  } catch {
    // Never throw from logging
  }
}
