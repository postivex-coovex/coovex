ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS lead_ids uuid[] DEFAULT '{}';
