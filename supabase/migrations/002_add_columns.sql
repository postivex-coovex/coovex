-- Migration 002: Add missing columns for Phase 1 features
-- Run this in Supabase SQL Editor

-- For website embed widget (1I-4)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS embed_token text;
CREATE UNIQUE INDEX IF NOT EXISTS businesses_embed_token_idx ON businesses(embed_token) WHERE embed_token IS NOT NULL;

-- For agent settings (agent-client.tsx)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_config_json jsonb DEFAULT '{}';

-- For notification preferences (notifications-client.tsx)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferences_json jsonb DEFAULT '{}';

-- For free tools lead capture (/api/tools/capture-lead)
CREATE TABLE IF NOT EXISTS free_tool_leads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL,
  name text,
  tool_used text NOT NULL,
  result_json jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, tool_used)
);
