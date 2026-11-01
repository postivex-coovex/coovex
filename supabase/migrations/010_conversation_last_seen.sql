-- Widget presence heartbeat: last time the visitor had the chat open and visible
ALTER TABLE support_conversations
  ADD COLUMN IF NOT EXISTS widget_last_seen_at timestamptz;
