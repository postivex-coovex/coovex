-- API key per business (for external integrations)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS api_key text unique;

-- Push tracking on posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS external_url text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS webhook_status text default 'none';
-- webhook_status: none | pushed | confirmed | failed

-- Webhook URL registered by user
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS webhook_url text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS webhook_secret text;
