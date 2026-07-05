ALTER TABLE leads ADD COLUMN IF NOT EXISTS website text;
ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'keyword_scraper';
CREATE INDEX IF NOT EXISTS idx_leads_biz_website ON leads(business_id, website);
