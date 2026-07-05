CREATE TABLE IF NOT EXISTS email_campaigns (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  subject        TEXT        NOT NULL,
  from_name      TEXT        NOT NULL DEFAULT 'The Team',
  content        TEXT,
  segment        TEXT        NOT NULL DEFAULT 'all',
  status         TEXT        NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','scheduled','sending','sent')),
  recipient_count INT        NOT NULL DEFAULT 0,
  sent_count      INT        NOT NULL DEFAULT 0,
  open_count      INT        NOT NULL DEFAULT 0,
  click_count     INT        NOT NULL DEFAULT 0,
  scheduled_at   TIMESTAMPTZ,
  sent_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_campaigns_business_id_idx ON email_campaigns(business_id);
CREATE INDEX IF NOT EXISTS email_campaigns_status_idx      ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS email_campaigns_scheduled_at_idx ON email_campaigns(scheduled_at) WHERE status = 'scheduled';

ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_select" ON email_campaigns FOR SELECT USING (
  business_id IN (
    SELECT b.id FROM businesses b
    JOIN profiles p ON p.current_workspace_id = b.workspace_id
    WHERE p.id = auth.uid()
  )
);
CREATE POLICY "campaigns_insert" ON email_campaigns FOR INSERT WITH CHECK (
  business_id IN (
    SELECT b.id FROM businesses b
    JOIN profiles p ON p.current_workspace_id = b.workspace_id
    WHERE p.id = auth.uid()
  )
);
CREATE POLICY "campaigns_update" ON email_campaigns FOR UPDATE USING (
  business_id IN (
    SELECT b.id FROM businesses b
    JOIN profiles p ON p.current_workspace_id = b.workspace_id
    WHERE p.id = auth.uid()
  )
);
CREATE POLICY "campaigns_delete" ON email_campaigns FOR DELETE USING (
  business_id IN (
    SELECT b.id FROM businesses b
    JOIN profiles p ON p.current_workspace_id = b.workspace_id
    WHERE p.id = auth.uid()
  )
);
