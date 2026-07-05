-- proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_name   TEXT        NOT NULL,
  client_company TEXT,
  title         TEXT        NOT NULL,
  sections_json TEXT        NOT NULL DEFAULT '[]',
  footer        TEXT        NOT NULL DEFAULT '',
  budget        TEXT,
  timeline      TEXT,
  status        TEXT        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','sent','viewed','accepted','declined')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS proposals_business_id_idx ON proposals(business_id);
CREATE INDEX IF NOT EXISTS proposals_status_idx      ON proposals(status);

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposals_select" ON proposals FOR SELECT USING (
  business_id IN (
    SELECT b.id FROM businesses b
    JOIN profiles p ON p.current_workspace_id = b.workspace_id
    WHERE p.id = auth.uid()
  )
);

CREATE POLICY "proposals_insert" ON proposals FOR INSERT WITH CHECK (
  business_id IN (
    SELECT b.id FROM businesses b
    JOIN profiles p ON p.current_workspace_id = b.workspace_id
    WHERE p.id = auth.uid()
  )
);

CREATE POLICY "proposals_update" ON proposals FOR UPDATE USING (
  business_id IN (
    SELECT b.id FROM businesses b
    JOIN profiles p ON p.current_workspace_id = b.workspace_id
    WHERE p.id = auth.uid()
  )
);

CREATE POLICY "proposals_delete" ON proposals FOR DELETE USING (
  business_id IN (
    SELECT b.id FROM businesses b
    JOIN profiles p ON p.current_workspace_id = b.workspace_id
    WHERE p.id = auth.uid()
  )
);
