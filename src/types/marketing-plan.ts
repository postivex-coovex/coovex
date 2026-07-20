export interface MarketingAction {
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  effort: 'high' | 'medium' | 'low'
  timeline: string
  action_type: string
  ai_help_type: string | null
  external_tools: string[]
}

export interface MarketingPhase {
  name: string
  weeks: string
  focus: string
  actions: MarketingAction[]
}

export interface MarketingPlan {
  goal: string
  strategy_summary: string
  key_channels: string[]
  phases: MarketingPhase[]
  expected_results: { label: string; value: string }[]
}

export interface Community {
  name: string
  platform: 'reddit' | 'facebook' | 'linkedin' | 'slack' | 'discord' | 'other'
  url: string
  members: string
  why: string
  post_tip: string
  post_type: 'story' | 'question' | 'value' | 'showcase'
}
