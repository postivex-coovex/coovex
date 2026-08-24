-- ─────────────────────────────────────────────────────────────
-- Support System — Global (user-level, not workspace-scoped)
-- ─────────────────────────────────────────────────────────────

-- Properties: one per website/brand
CREATE TABLE IF NOT EXISTS support_properties (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  domain         TEXT,
  api_key        TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),

  -- SMTP (password stored encrypted via app-layer AES-256)
  smtp_host      TEXT,
  smtp_port      INT         DEFAULT 587,
  smtp_user      TEXT,
  smtp_password  TEXT,
  smtp_secure    BOOLEAN     DEFAULT false,
  from_email     TEXT,
  from_name      TEXT,

  -- Widget appearance
  widget_color    TEXT       DEFAULT '#2563eb',
  widget_position TEXT       DEFAULT 'bottom-right',
  widget_title    TEXT       DEFAULT 'Support',
  widget_subtitle TEXT       DEFAULT 'How can we help?',
  welcome_message TEXT       DEFAULT 'Hi! How can we help you today?',

  -- Inbound email: user forwards their support@ address to the webhook
  inbound_email   TEXT,

  -- Auto-reply
  auto_reply_enabled BOOLEAN DEFAULT false,
  auto_reply_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations: one thread per customer
CREATE TABLE IF NOT EXISTS support_conversations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID        NOT NULL REFERENCES support_properties(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL,

  customer_email  TEXT,
  customer_name   TEXT,
  customer_phone  TEXT,
  subject         TEXT,

  status          TEXT        DEFAULT 'open'
                  CHECK (status IN ('open','pending','closed','spam')),
  source          TEXT        DEFAULT 'widget'
                  CHECK (source IN ('widget','email','api')),

  is_read         BOOLEAN     DEFAULT false,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),

  -- Email threading (for inbound email conversations)
  email_thread_id TEXT,

  -- Widget session (localStorage conversation_id for returning visitors)
  widget_session_id TEXT,

  metadata        JSONB       DEFAULT '{}',

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Individual messages within a conversation
CREATE TABLE IF NOT EXISTS support_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  property_id     UUID        NOT NULL,

  sender_type     TEXT        NOT NULL
                  CHECK (sender_type IN ('customer','agent','ai')),
  sender_name     TEXT,
  sender_email    TEXT,

  content         TEXT        NOT NULL,
  content_html    TEXT,

  source          TEXT        DEFAULT 'widget'
                  CHECK (source IN ('widget','email','api','system')),

  attachments     JSONB       DEFAULT '[]',
  email_message_id TEXT,

  is_read         BOOLEAN     DEFAULT false,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Resources/credentials vault per property
CREATE TABLE IF NOT EXISTS support_resources (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID  NOT NULL REFERENCES support_properties(id) ON DELETE CASCADE,
  user_id     UUID  NOT NULL,

  name        TEXT  NOT NULL,
  category    TEXT  DEFAULT 'credential'
              CHECK (category IN ('credential','note','link','document','api_key','other')),

  -- Encrypted content (AES-256 via app layer)
  content     TEXT,

  -- Structured metadata (username, url, notes, etc.)
  metadata    JSONB DEFAULT '{}',

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_support_properties_user      ON support_properties(user_id);
CREATE INDEX IF NOT EXISTS idx_support_conv_property        ON support_conversations(property_id);
CREATE INDEX IF NOT EXISTS idx_support_conv_user            ON support_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_support_conv_status          ON support_conversations(status);
CREATE INDEX IF NOT EXISTS idx_support_conv_last_msg        ON support_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_conv_session         ON support_conversations(widget_session_id);
CREATE INDEX IF NOT EXISTS idx_support_msg_conversation     ON support_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_support_msg_property         ON support_messages(property_id);
CREATE INDEX IF NOT EXISTS idx_support_resources_property   ON support_resources(property_id);

-- ── Row Level Security ──────────────────────────────────────────
ALTER TABLE support_properties    ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_resources     ENABLE ROW LEVEL SECURITY;

-- Properties: owner only
CREATE POLICY "support_properties_owner" ON support_properties
  FOR ALL USING (auth.uid() = user_id);

-- Conversations: property owner sees their conversations
CREATE POLICY "support_conversations_owner" ON support_conversations
  FOR ALL USING (auth.uid() = user_id);

-- Messages: owner of the conversation's property
CREATE POLICY "support_messages_owner" ON support_messages
  FOR ALL USING (
    property_id IN (SELECT id FROM support_properties WHERE user_id = auth.uid())
  );

-- Resources: owner
CREATE POLICY "support_resources_owner" ON support_resources
  FOR ALL USING (auth.uid() = user_id);

-- ── updated_at triggers ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_support_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER trg_support_properties_updated
  BEFORE UPDATE ON support_properties
  FOR EACH ROW EXECUTE FUNCTION update_support_updated_at();

CREATE TRIGGER trg_support_conversations_updated
  BEFORE UPDATE ON support_conversations
  FOR EACH ROW EXECUTE FUNCTION update_support_updated_at();

CREATE TRIGGER trg_support_resources_updated
  BEFORE UPDATE ON support_resources
  FOR EACH ROW EXECUTE FUNCTION update_support_updated_at();
