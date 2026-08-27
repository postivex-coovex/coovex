-- AI Agent config per property
ALTER TABLE support_properties
  ADD COLUMN IF NOT EXISTS ai_enabled      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_auto_reply   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_system_prompt text,
  ADD COLUMN IF NOT EXISTS ai_integrations  jsonb   DEFAULT '[]'::jsonb;
