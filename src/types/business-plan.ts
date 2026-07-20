export interface PlanMilestone {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  due: string
  steps: string[]
}

export interface PlanQuarter {
  label: string
  months: string
  theme: string
  objectives: string[]
  milestones: PlanMilestone[]
}

export interface ExecutionPlan {
  product: string
  annual_goal: string
  key_metrics: { label: string; target: string; current: string }[]
  quarters: PlanQuarter[]
}
