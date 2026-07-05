-- Add response tracking columns to proposals
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS responded_at  TIMESTAMPTZ;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS client_note   TEXT;

-- Allow public (unauthenticated) updates via service role for receiver responses
-- The respond API uses createServiceClient which bypasses RLS
