export type Plan = 'free_trial' | 'starter' | 'growth' | 'scale'

const PLAN_FEATURES: Record<string, Plan[]> = {
  // Always available
  agent_inbox: ['free_trial', 'starter', 'growth', 'scale'],
  website_audit: ['free_trial', 'starter', 'growth', 'scale'],
  lead_management: ['free_trial', 'starter', 'growth', 'scale'],
  content_calendar: ['free_trial', 'starter', 'growth', 'scale'],
  reviews: ['free_trial', 'starter', 'growth', 'scale'],
  analytics: ['free_trial', 'starter', 'growth', 'scale'],

  // Starter+
  ai_post_generator: ['starter', 'growth', 'scale'],
  trends: ['starter', 'growth', 'scale'],
  competitors: ['starter', 'growth', 'scale'],
  csv_import: ['starter', 'growth', 'scale'],

  // Growth+
  ai_lead_scoring: ['growth', 'scale'],
  fill_calendar: ['growth', 'scale'],
  team_members: ['growth', 'scale'],
  embed_widget: ['growth', 'scale'],

  // Scale only
  white_label: ['scale'],
  unlimited_workspaces: ['scale'],
}

export function hasFeature(feature: string, plan: Plan = 'free_trial'): boolean {
  const allowed = PLAN_FEATURES[feature]
  if (!allowed) return true // unknown features default to allowed
  return allowed.includes(plan)
}

export function planFromString(s: string | null | undefined): Plan {
  if (!s) return 'free_trial'
  const lower = s.toLowerCase()
  if (lower.includes('scale')) return 'scale'
  if (lower.includes('growth')) return 'growth'
  if (lower.includes('starter')) return 'starter'
  return 'free_trial'
}
