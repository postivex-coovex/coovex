-- Drop and recreate tasks (previous partial run left a bad schema)
DROP TABLE IF EXISTS tasks CASCADE;

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','done','cancelled')),
  level TEXT DEFAULT 'normal' CHECK (level IN ('normal','emergency')),
  department TEXT DEFAULT 'general' CHECK (department IN ('technical','general','finance','marketing')),
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual','chat','email')),
  source_conversation_id UUID REFERENCES support_conversations(id) ON DELETE SET NULL,
  source_label TEXT,
  assigned_to_email TEXT,
  assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own or assigned tasks"
  ON tasks FOR SELECT
  USING (user_id = auth.uid() OR assigned_to_user_id = auth.uid());

CREATE POLICY "Users create tasks"
  ON tasks FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners and assignees update tasks"
  ON tasks FOR UPDATE
  USING (user_id = auth.uid() OR assigned_to_user_id = auth.uid());

CREATE POLICY "Owners delete tasks"
  ON tasks FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to_user_id);

CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER trg_tasks_updated
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_tasks_updated_at();

-- ── Support Property Members ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_property_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES support_properties(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_email TEXT NOT NULL,
  member_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('member','admin')),
  can_see_credentials BOOLEAN DEFAULT false,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, member_email)
);

ALTER TABLE support_property_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='support_property_members' AND policyname='Owners manage property members') THEN
    CREATE POLICY "Owners manage property members"
      ON support_property_members FOR ALL
      USING (owner_user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='support_property_members' AND policyname='Members see their own invites') THEN
    CREATE POLICY "Members see their own invites"
      ON support_property_members FOR SELECT
      USING (member_user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_spm_property_id ON support_property_members(property_id);
CREATE INDEX IF NOT EXISTS idx_spm_member_email ON support_property_members(member_email);
CREATE INDEX IF NOT EXISTS idx_spm_member_user_id ON support_property_members(member_user_id);

-- Allow invited members to read the properties they're assigned to
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='support_properties' AND policyname='Members read invited properties') THEN
    CREATE POLICY "Members read invited properties"
      ON support_properties FOR SELECT
      USING (
        id IN (
          SELECT property_id FROM support_property_members
          WHERE member_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Allow invited members to read conversations of their assigned properties
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='support_conversations' AND policyname='Members read property conversations') THEN
    CREATE POLICY "Members read property conversations"
      ON support_conversations FOR SELECT
      USING (
        property_id IN (
          SELECT property_id FROM support_property_members
          WHERE member_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Allow invited members to read messages in those conversations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='support_messages' AND policyname='Members read property messages') THEN
    CREATE POLICY "Members read property messages"
      ON support_messages FOR SELECT
      USING (
        property_id IN (
          SELECT property_id FROM support_property_members
          WHERE member_user_id = auth.uid()
        )
      );
  END IF;
END $$;
