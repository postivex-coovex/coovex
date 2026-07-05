import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AgentSettingsClient from './agent-client'

export const dynamic = 'force-dynamic'

const DEFAULT_CONFIG = {
  auto_respond_reviews: false,
  auto_score_leads: true,
  auto_schedule_posts: false,
  auto_run_audits: true,
  daily_brief: true,
  signal_threshold: 'medium' as const,
  response_tone: 'professional' as const,
  max_posts_per_week: 5,
  working_hours_only: true,
  // Execution permissions
  auto_exec_spend_limit: 0,
  auto_publish_confidence: 85,
  auto_publish_reviews: false,
  auto_publish_posts: false,
  auto_publish_emails: false,
  // Auto follow-up
  auto_followup_enabled: false,
  auto_followup_days: 3,
}

export default async function AgentSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load saved config from profile (stored in agent_config_json or fall back to default)
  const { data: profile } = await supabase
    .from('profiles')
    .select('agent_config_json')
    .eq('id', user.id)
    .single()

  const savedConfig = {
    ...DEFAULT_CONFIG,
    ...(profile?.agent_config_json || {}),
  }

  return <AgentSettingsClient savedConfig={savedConfig} />
}
