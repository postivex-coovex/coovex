-- Add share/tracking columns to proposals (run AFTER add_proposals.sql)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS share_token  UUID        UNIQUE DEFAULT gen_random_uuid();
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS view_count   INT         NOT NULL DEFAULT 0;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;

-- Back-fill existing rows that have no token yet
UPDATE proposals SET share_token = gen_random_uuid() WHERE share_token IS NULL;

CREATE INDEX IF NOT EXISTS proposals_share_token_idx ON proposals(share_token);
