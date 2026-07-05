-- Add competitor_correction_note to businesses table
-- Stores the user's correction note for AI competitor analysis
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS competitor_correction_note text;
