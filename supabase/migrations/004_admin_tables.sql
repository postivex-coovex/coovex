-- ============================================================
-- 004_admin_tables.sql — Admin panel supporting tables
-- ============================================================

-- Announcements: admin → all users or specific segments
CREATE TABLE IF NOT EXISTS admin_announcements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  body          text NOT NULL,
  type          text NOT NULL DEFAULT 'info',  -- info | warning | feature | promo
  target        text NOT NULL DEFAULT 'all',   -- all | trialing | paid | inactive
  sent_count    int DEFAULT 0,
  status        text NOT NULL DEFAULT 'draft', -- draft | sent
  sent_at       timestamptz,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now()
);

-- Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid REFERENCES workspaces(id),
  user_id       uuid REFERENCES auth.users(id),
  subject       text NOT NULL,
  body          text NOT NULL,
  status        text NOT NULL DEFAULT 'open',    -- open | in_progress | resolved | closed
  priority      text NOT NULL DEFAULT 'normal',  -- low | normal | high | urgent
  admin_reply   text,
  replied_at    timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Meeting bookings
CREATE TABLE IF NOT EXISTS meetings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid REFERENCES workspaces(id),
  user_id       uuid REFERENCES auth.users(id),
  name          text NOT NULL,
  email         text NOT NULL,
  company       text,
  topic         text,
  preferred_time text,
  timezone      text,
  status        text NOT NULL DEFAULT 'pending', -- pending | scheduled | completed | cancelled
  scheduled_at  timestamptz,
  meeting_url   text,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- System error logs
CREATE TABLE IF NOT EXISTS error_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message       text NOT NULL,
  stack         text,
  context       jsonb DEFAULT '{}',
  severity      text NOT NULL DEFAULT 'error', -- info | warn | error | critical
  source        text,  -- api_route, agent, webhook, etc.
  workspace_id  uuid,
  resolved      boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

-- LLM provider configuration
CREATE TABLE IF NOT EXISTS llm_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      text UNIQUE NOT NULL, -- claude | openai | gemini | groq | mistral
  model_default text NOT NULL,
  enabled       boolean DEFAULT true,
  priority      int DEFAULT 1,         -- 1 = primary
  features      text[] DEFAULT '{}',   -- which features use this provider
  notes         text,
  updated_at    timestamptz DEFAULT now(),
  updated_by    uuid REFERENCES auth.users(id)
);

-- Seed default LLM config
INSERT INTO llm_config (provider, model_default, enabled, priority, features) VALUES
  ('claude',  'claude-sonnet-4-6',         true,  1, ARRAY['agent', 'audit', 'coach', 'content', 'proposals']),
  ('haiku',   'claude-haiku-4-5-20251001', true,  2, ARRAY['lead_score', 'daily_brief', 'quick_tasks'])
ON CONFLICT (provider) DO NOTHING;

-- External API usage log
CREATE TABLE IF NOT EXISTS api_usage_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      text NOT NULL,         -- google_pagespeed | similarweb | openai | stripe | etc.
  endpoint      text,
  workspace_id  uuid,
  status_code   int,
  response_ms   int,
  tokens_used   int,
  cost_usd      numeric(12,6) DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- RLS: admin_announcements — only service role (no user-level RLS needed)
ALTER TABLE admin_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only" ON admin_announcements;
CREATE POLICY "Service role only" ON admin_announcements USING (false);

-- RLS: support_tickets — users see their own; service role sees all
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users create tickets" ON support_tickets;
CREATE POLICY "Users see own tickets" ON support_tickets FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users create tickets" ON support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS: meetings — users see their own
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own meetings" ON meetings;
DROP POLICY IF EXISTS "Users create meetings" ON meetings;
CREATE POLICY "Users see own meetings" ON meetings FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users create meetings" ON meetings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS: error_logs, llm_config, api_usage_log — service role only
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No public access" ON error_logs;
CREATE POLICY "No public access" ON error_logs USING (false);

ALTER TABLE llm_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No public access" ON llm_config;
CREATE POLICY "No public access" ON llm_config USING (false);

ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No public access" ON api_usage_log;
CREATE POLICY "No public access" ON api_usage_log USING (false);
