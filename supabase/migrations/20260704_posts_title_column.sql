-- Add title column to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS title text;
