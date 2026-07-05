ALTER TABLE leads ADD COLUMN IF NOT EXISTS research_data jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS website text;
