-- Add web_search and map_search as valid lead sources
ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'web_search';
ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'map_search';
