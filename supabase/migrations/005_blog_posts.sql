-- ============================================================
-- 005_blog_posts.sql — CMS table for admin-managed blog posts
-- ============================================================

CREATE TABLE IF NOT EXISTS blog_posts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text UNIQUE NOT NULL,
  title        text NOT NULL,
  subtitle     text NOT NULL DEFAULT '',
  category     text NOT NULL DEFAULT 'General',
  icon         text NOT NULL DEFAULT '📄',
  read_time    int  NOT NULL DEFAULT 5,
  description  text NOT NULL DEFAULT '',
  tags         text[] DEFAULT '{}',
  -- content: array of steps [{title, content, tip?, warning?}]
  content      jsonb NOT NULL DEFAULT '[]',
  published    boolean NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug      ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published);

-- RLS: published posts are public; admin (service role) manages all
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published posts" ON blog_posts;
CREATE POLICY "Public read published posts" ON blog_posts
  FOR SELECT USING (published = true);

-- service role bypasses RLS — admin API uses createServiceClient()
