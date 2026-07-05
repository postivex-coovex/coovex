-- Global raw leads table (stores all URL results from VPS 8000 scraper)
CREATE TABLE IF NOT EXISTS scraped_leads_global (
  id         uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword    text      NOT NULL,
  country    text,
  city       text,
  google_rank_title text,
  website_url text     NOT NULL,
  domain     text,
  scrapping_date date,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT scraped_leads_global_unique UNIQUE (keyword, website_url)
);

CREATE INDEX IF NOT EXISTS idx_scraped_leads_kw ON scraped_leads_global(keyword, country, city);

-- Enriched lead details (from VPS 8091 website scraper, keyed by domain)
CREATE TABLE IF NOT EXISTS scraped_lead_details (
  id               uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  domain           text      NOT NULL UNIQUE,
  website_url      text,
  emails           text[]    DEFAULT '{}',
  phones           text[]    DEFAULT '{}',
  address          text,
  brand_name       text,
  title            text,
  description      text,
  technologies     text[]    DEFAULT '{}',
  products_services text[]   DEFAULT '{}',
  pain_points      jsonb     DEFAULT '[]',
  solutions_offered text[]   DEFAULT '{}',
  social_links     text[]    DEFAULT '{}',
  enriched_at      timestamptz DEFAULT now()
);
