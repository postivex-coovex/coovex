-- Run this in the Supabase SQL editor

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS monitored_websites (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url                   text NOT NULL,
  name                  text NOT NULL,
  is_active             boolean DEFAULT true,
  status                text DEFAULT 'unknown',       -- up | down | checking | unknown
  last_check_at         timestamptz,
  next_check_at         timestamptz DEFAULT now(),
  retry_count           integer DEFAULT 0,            -- 0 = normal, 1-5 = retry cycle
  consecutive_failures  integer DEFAULT 0,
  uptime_7d             numeric(5,2),                 -- percent, e.g. 99.95
  avg_load_time_ms      integer,
  last_load_time_ms     integer,
  last_http_status      integer,
  ssl_valid             boolean,
  ssl_expiry_date       timestamptz,
  ssl_days_left         integer,
  domain_expiry_date    timestamptz,
  domain_days_left      integer,
  alert_emails          text[] DEFAULT '{}',
  alert_on_down         boolean DEFAULT true,
  alert_on_ssl_expiry   boolean DEFAULT true,
  alert_on_domain_expiry boolean DEFAULT true,
  alert_on_slow_load    boolean DEFAULT true,
  slow_load_threshold_ms integer DEFAULT 3000,
  -- notification dedup timestamps
  down_notified_at      timestamptz,
  ssl_notified_30d_at   timestamptz,
  ssl_notified_7d_at    timestamptz,
  domain_notified_30d_at timestamptz,
  domain_notified_7d_at  timestamptz,
  -- credentials & notes
  credential_notes      text,
  notes_visibility      text DEFAULT 'private',       -- private | team
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS website_checks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id        uuid REFERENCES monitored_websites(id) ON DELETE CASCADE NOT NULL,
  checked_at        timestamptz DEFAULT now(),
  is_up             boolean,
  http_status       integer,
  load_time_ms      integer,
  ssl_valid         boolean,
  ssl_expiry_date   timestamptz,
  ssl_days_left     integer,
  domain_expiry_date timestamptz,
  domain_days_left  integer,
  has_robots_txt    boolean,
  has_sitemap       boolean,
  has_https         boolean,
  security_score    integer,
  security_headers  jsonb DEFAULT '{}',
  seo_score         integer,
  seo_data          jsonb DEFAULT '{}',
  error_message     text
);

CREATE TABLE IF NOT EXISTS website_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id  uuid REFERENCES monitored_websites(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type        text NOT NULL,         -- down | recovered | ssl_expiry | domain_expiry | slow_load
  severity    text DEFAULT 'warning', -- info | warning | critical
  title       text NOT NULL,
  message     text NOT NULL,
  is_read     boolean DEFAULT false,
  email_sent  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_monitored_websites_user    ON monitored_websites (user_id);
CREATE INDEX IF NOT EXISTS idx_monitored_websites_cron    ON monitored_websites (is_active, retry_count, next_check_at);
CREATE INDEX IF NOT EXISTS idx_website_checks_website     ON website_checks (website_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_notifications_site ON website_notifications (website_id, user_id, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE monitored_websites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_checks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_notifications ENABLE ROW LEVEL SECURITY;

-- Users can manage their own websites
CREATE POLICY "users_own_websites" ON monitored_websites
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can view checks for their own websites
CREATE POLICY "users_own_checks" ON website_checks
  USING (
    website_id IN (SELECT id FROM monitored_websites WHERE user_id = auth.uid())
  );

-- Users can manage their own notifications
CREATE POLICY "users_own_notifications" ON website_notifications
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Auto-prune old checks (keep last 30 days) ────────────────────────────────
-- Optional: run manually or as a separate cron
-- DELETE FROM website_checks WHERE checked_at < now() - interval '30 days';
