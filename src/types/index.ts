// ─── User & Workspace ────────────────────────────────────────────────────────

export type UserRole = 'superadmin' | 'owner' | 'admin' | 'manager' | 'creator' | 'sales' | 'viewer' | 'client'

export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
  plan: PlanType
  role: UserRole
  language: string
  timezone: string
  created_at: string
}

export interface Workspace {
  id: string
  name: string
  owner_id: string
  plan: PlanType
  white_label_config?: WhiteLabelConfig
  custom_domain?: string
  billing_status: 'active' | 'trialing' | 'past_due' | 'canceled'
  created_at: string
}

export interface WhiteLabelConfig {
  logo_url?: string
  brand_color?: string
  brand_name?: string
  custom_domain?: string
  sender_email?: string
  sender_name?: string
}

export interface WorkspaceMember {
  workspace_id: string
  user_id: string
  role: UserRole
  user?: User
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export type PlanType = 'starter' | 'growth' | 'scale' | 'agency' | 'enterprise'

export const PLAN_LIMITS: Record<PlanType, {
  businesses: number
  team_members: number
  competitors: number
  posts_per_month: number
  crm_integrations: number
  erp_integrations: boolean
  white_label: boolean
  ai_coach: boolean
}> = {
  starter:    { businesses: 1, team_members: 1,  competitors: 3,  posts_per_month: 30,  crm_integrations: 0, erp_integrations: false, white_label: false, ai_coach: false },
  growth:     { businesses: 1, team_members: 3,  competitors: 5,  posts_per_month: 100, crm_integrations: 2, erp_integrations: false, white_label: false, ai_coach: true  },
  scale:      { businesses: 1, team_members: 5,  competitors: 10, posts_per_month: 300, crm_integrations: 5, erp_integrations: true,  white_label: false, ai_coach: true  },
  agency:     { businesses: 15, team_members: 20, competitors: 50, posts_per_month: 999, crm_integrations: 5, erp_integrations: true,  white_label: true,  ai_coach: true  },
  enterprise: { businesses: 999, team_members: 999, competitors: 999, posts_per_month: 999, crm_integrations: 999, erp_integrations: true, white_label: true, ai_coach: true },
}

// ─── Business ─────────────────────────────────────────────────────────────────

export type BusinessSize = '1' | '2-10' | '11-50' | '51-200' | '201-500' | '500+'
export type TargetCustomer = 'b2b' | 'b2c' | 'both'

export interface Business {
  id: string
  workspace_id: string
  name: string
  industry: string
  size: BusinessSize
  website_url?: string
  description?: string
  target_customer: TargetCustomer
  country: string
  logo_url?: string
  health_score: number
  created_at: string
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export type IntegrationType =
  | 'linkedin' | 'facebook' | 'instagram' | 'tiktok'
  | 'google_ads' | 'google_analytics' | 'google_mybusiness' | 'google_search_console'
  | 'hubspot' | 'salesforce' | 'zoho' | 'pipedrive' | 'monday' | 'notion'
  | 'quickbooks' | 'xero' | 'odoo' | 'sap' | 'netsuite' | 'dynamics365'
  | 'shopify' | 'woocommerce'
  | 'mailchimp' | 'activecampaign' | 'sendgrid' | 'klaviyo' | 'brevo'
  | 'trustpilot' | 'g2'
  | 'zapier' | 'make' | 'wordpress'

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'expired'

export interface Integration {
  id: string
  business_id: string
  type: IntegrationType
  status: IntegrationStatus
  access_token?: string
  refresh_token?: string
  token_expires_at?: string
  meta_json?: Record<string, unknown>
  connected_at: string
}

// ─── Posts / Content ──────────────────────────────────────────────────────────

export type PostChannel = 'linkedin' | 'facebook' | 'instagram' | 'tiktok' | 'wordpress'
export type PostStatus = 'draft' | 'pending_approval' | 'scheduled' | 'published' | 'failed'

export interface Post {
  id: string
  business_id: string
  channel: PostChannel
  content: string
  media_urls?: string[]
  status: PostStatus
  scheduled_at?: string
  published_at?: string
  created_by: string
  approved_by?: string
  campaign_id?: string
  performance_json?: PostPerformance
  created_at: string
}

export interface PostPerformance {
  likes?: number
  comments?: number
  shares?: number
  reach?: number
  impressions?: number
  clicks?: number
  engagement_rate?: number
}

// ─── Leads & Pipeline ─────────────────────────────────────────────────────────

export type LeadStage = 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost'
export type LeadSource = 'website_form' | 'linkedin' | 'facebook' | 'google_ads' | 'referral' | 'manual' | 'email' | 'other' | 'web_search' | 'map_search' | 'keyword_scraper'

export interface Lead {
  id: string
  business_id: string
  name: string
  email?: string
  phone?: string
  company?: string
  job_title?: string
  website?: string
  source: LeadSource
  score: number
  stage: LeadStage
  assigned_to?: string
  tags?: string[]
  notes?: string
  research_data?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type ActivityType = 'email_sent' | 'email_opened' | 'link_clicked' | 'form_submitted' | 'call' | 'meeting' | 'note' | 'stage_change' | 'score_change' | 'ad_click'

export interface LeadActivity {
  id: string
  lead_id: string
  type: ActivityType
  data_json?: Record<string, unknown>
  created_by?: string
  created_at: string
}

export interface Deal {
  id: string
  lead_id: string
  business_id: string
  value: number
  currency: string
  close_date?: string
  probability: number
  status: 'open' | 'won' | 'lost'
  crm_id?: string
  created_at: string
}

// ─── Agent System ─────────────────────────────────────────────────────────────

export type AgentJobType =
  | 'website_audit' | 'linkedin_audit' | 'facebook_audit' | 'full_audit'
  | 'social_pull' | 'competitor_check' | 'lead_score' | 'daily_brief'
  | 'trend_feed' | 'review_check' | 'email_send' | 'post_publish'

export type AgentJobStatus = 'queued' | 'running' | 'done' | 'failed'

export interface AgentJob {
  id: string
  business_id: string
  type: AgentJobType
  status: AgentJobStatus
  result_json?: Record<string, unknown>
  error?: string
  trigger: string
  started_at?: string
  completed_at?: string
  created_at: string
}

export type SignalType = 'urgent' | 'warning' | 'opportunity' | 'done' | 'insight'
export type SignalActionType = 'approve_post' | 'respond_review' | 'view_lead' | 'view_report' | 'open_url' | 'open_chat' | 'none'

export interface AgentSignal {
  id: string
  business_id: string
  type: SignalType
  title: string
  body: string
  action_label?: string
  action_type: SignalActionType
  action_data_json?: Record<string, unknown>
  dismissed: boolean
  created_at: string
}

export interface DailyTask {
  id: string
  business_id: string
  date: string
  tasks_json: Task[]
  completed_count: number
  total_count: number
}

export type TaskVerifySource = 'audit' | 'integration' | 'team' | 'content' | 'proposal' | 'campaign' | 'review_responded' | 'lead'

export interface Task {
  id: string
  title: string
  description: string
  channel?: string
  action_type?: string
  action_data?: Record<string, unknown>
  completed: boolean
  verify_via?: TaskVerifySource | null
  auto_completed?: boolean
  priority?: 'critical' | 'high' | 'medium' | 'low'
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface ChatSession {
  id: string
  user_id: string
  business_id: string
  messages_json: ChatMessage[]
  created_at: string
  updated_at: string
}

// ─── Audit & Intelligence ─────────────────────────────────────────────────────

export type AuditType = 'website' | 'linkedin' | 'facebook' | 'full'

export interface Audit {
  id: string
  business_id: string
  type: AuditType
  score: number
  report_json: AuditReport
  created_at: string
}

export interface AuditReport {
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  summary: string
  issues: AuditIssue[]
  wins: string[]
  recommendations: AuditRecommendation[]
}

export interface AuditIssue {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  fix: string
  impact: string
}

export interface AuditRecommendation {
  priority: number
  title: string
  description: string
  effort: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
}

export interface Competitor {
  id: string
  business_id: string
  name: string
  website?: string
  linkedin_url?: string
  facebook_url?: string
  added_at: string
}

export interface TrendItem {
  id: string
  business_id: string
  topic: string
  source: string
  relevance: number
  url?: string
  summary: string
  detected_at: string
  actioned: boolean
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export type ReviewPlatform = 'google' | 'trustpilot' | 'g2' | 'capterra' | 'facebook' | 'tripadvisor'
export type ReviewStatus = 'new' | 'responded' | 'flagged' | 'ignored'

export interface Review {
  id: string
  business_id: string
  platform: ReviewPlatform
  reviewer_name: string
  rating: number
  body: string
  response?: string
  status: ReviewStatus
  posted_at: string
  responded_at?: string
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface BusinessMetrics {
  id: string
  business_id: string
  date: string
  health_score: number
  metrics_json: MetricsSnapshot
}

export interface MetricsSnapshot {
  leads_captured: number
  leads_converted: number
  posts_published: number
  reviews_received: number
  avg_review_rating: number
  pipeline_value: number
  website_score: number
  linkedin_score: number
  facebook_score: number
}

// ─── API Response helpers ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  has_more: boolean
}
