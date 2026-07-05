-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/vkjqkdxkvjdeugjvfbme/sql

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS social_connections JSONB DEFAULT '{}';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS integrations JSONB DEFAULT '{}';

-- Structure stored:
-- {
--   "linkedin": {
--     "connected": true,
--     "account_name": "John Doe",
--     "account_id": "...",
--     "access_token": "...",
--     "expires_at": "2026-08-19T..."
--   },
--   "facebook": {
--     "connected": true,
--     "account_name": "John Doe",
--     "account_id": "...",
--     "user_token": "...",
--     "pages": [{ "id": "...", "name": "My Page", "access_token": "..." }]
--   },
--   "instagram": {
--     "connected": true,
--     "account_name": "myhandle",
--     "account_id": "...",
--     "page_id": "...",
--     "page_token": "..."
--   }
-- }
