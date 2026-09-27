-- ─────────────────────────────────────────────────────────────
-- Inquiry Manager
-- One API key per user; each unique domain auto-creates a Property
-- ─────────────────────────────────────────────────────────────

-- Per-user API key (auto-created on first access)
CREATE TABLE IF NOT EXISTS inquiry_api_keys (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key    TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One property per unique (user, domain) — auto-created on first submission
CREATE TABLE IF NOT EXISTS inquiry_properties (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain       TEXT        NOT NULL,
  label        TEXT,
  unread_count INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, domain)
);

-- Individual inquiry submissions
CREATE TABLE IF NOT EXISTS inquiry_submissions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID        NOT NULL REFERENCES inquiry_properties(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain       TEXT        NOT NULL,
  email        TEXT        NOT NULL,
  extra_fields JSONB       NOT NULL DEFAULT '{}',
  is_read      BOOLEAN     NOT NULL DEFAULT false,
  status       TEXT        NOT NULL DEFAULT 'new',
  source_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS inquiry_properties_user_id      ON inquiry_properties(user_id);
CREATE INDEX IF NOT EXISTS inquiry_submissions_property_id ON inquiry_submissions(property_id);
CREATE INDEX IF NOT EXISTS inquiry_submissions_user_id     ON inquiry_submissions(user_id);
CREATE INDEX IF NOT EXISTS inquiry_submissions_created_at  ON inquiry_submissions(created_at DESC);

-- RLS
ALTER TABLE inquiry_api_keys      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_properties    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_submissions   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own api keys"
  ON inquiry_api_keys FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own properties"
  ON inquiry_properties FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own submissions"
  ON inquiry_submissions FOR ALL USING (auth.uid() = user_id);
