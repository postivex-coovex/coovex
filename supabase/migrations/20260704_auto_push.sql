-- Auto-push toggle per business
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS auto_push boolean default false;
