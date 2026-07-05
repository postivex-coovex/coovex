CREATE TABLE IF NOT EXISTS lead_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL,
  keyword      text        NOT NULL,
  country      text        NOT NULL DEFAULT '',
  city         text        NOT NULL DEFAULT '',
  scraped_lead_ids uuid[]  DEFAULT '{}',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  CONSTRAINT lead_sessions_unique UNIQUE (business_id, keyword, country, city)
);

CREATE INDEX IF NOT EXISTS idx_lead_sessions_biz ON lead_sessions(business_id);
