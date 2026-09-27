-- Add notification preferences column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferences_json JSONB DEFAULT '{}';
