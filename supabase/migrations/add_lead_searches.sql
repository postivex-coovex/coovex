CREATE TABLE IF NOT EXISTS lead_searches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  audit_id    uuid REFERENCES audits(id) ON DELETE SET NULL,
  icp         jsonb,
  candidates  jsonb DEFAULT '[]'::jsonb,
  has_real_results boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_searches_business_id_idx ON lead_searches(business_id);
CREATE INDEX IF NOT EXISTS lead_searches_created_at_idx ON lead_searches(created_at DESC);
