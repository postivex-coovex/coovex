export type WebsiteStatus = 'up' | 'down' | 'checking' | 'unknown'
export type AlertType = 'down' | 'recovered' | 'ssl_expiry' | 'domain_expiry' | 'slow_load'
export type Severity = 'info' | 'warning' | 'critical'
export type NotesVisibility = 'private' | 'team'

export interface MonitoredWebsite {
  id: string
  user_id: string
  url: string
  name: string
  is_active: boolean
  status: WebsiteStatus
  last_check_at: string | null
  next_check_at: string | null
  retry_count: number
  consecutive_failures: number
  uptime_7d: number | null
  avg_load_time_ms: number | null
  last_load_time_ms: number | null
  last_http_status: number | null
  ssl_valid: boolean | null
  ssl_expiry_date: string | null
  ssl_days_left: number | null
  domain_expiry_date: string | null
  domain_days_left: number | null
  alert_emails: string[]
  alert_on_down: boolean
  alert_on_ssl_expiry: boolean
  alert_on_domain_expiry: boolean
  alert_on_slow_load: boolean
  slow_load_threshold_ms: number
  down_notified_at: string | null
  ssl_notified_30d_at: string | null
  ssl_notified_7d_at: string | null
  domain_notified_30d_at: string | null
  domain_notified_7d_at: string | null
  credential_notes: string | null
  notes_visibility: NotesVisibility
  created_at: string
  updated_at: string
}

export interface WebsiteCheck {
  id: string
  website_id: string
  checked_at: string
  is_up: boolean | null
  http_status: number | null
  load_time_ms: number | null
  ssl_valid: boolean | null
  ssl_expiry_date: string | null
  ssl_days_left: number | null
  domain_expiry_date: string | null
  domain_days_left: number | null
  has_robots_txt: boolean | null
  has_sitemap: boolean | null
  has_https: boolean | null
  security_score: number | null
  security_headers: Record<string, boolean>
  seo_score: number | null
  seo_data: {
    hasTitle: boolean
    hasMetaDescription: boolean
    hasOgTitle: boolean
    hasCanonical: boolean
    title: string | null
    metaDescription: string | null
  }
  error_message: string | null
}

export interface WebsiteNotification {
  id: string
  website_id: string
  user_id: string
  type: AlertType
  severity: Severity
  title: string
  message: string
  is_read: boolean
  email_sent: boolean
  created_at: string
}

// Checker output
export interface CheckResult {
  isUp: boolean
  httpStatus: number | null
  loadTimeMs: number | null
  hasHttps: boolean
  hasRobotsTxt: boolean
  hasSitemap: boolean
  ssl: {
    valid: boolean
    expiryDate: Date | null
    daysLeft: number | null
    issuer: string | null
    error: string | null
  }
  domain: {
    expiryDate: Date | null
    daysLeft: number | null
    error: string | null
  }
  security: {
    score: number
    hasHsts: boolean
    hasXFrame: boolean
    hasXContentType: boolean
    hasCSP: boolean
    hasReferrerPolicy: boolean
    hasPermissionsPolicy: boolean
  }
  seo: {
    score: number
    hasTitle: boolean
    hasMetaDescription: boolean
    hasOgTitle: boolean
    hasCanonical: boolean
    title: string | null
    metaDescription: string | null
  }
  errorMessage: string | null
}
