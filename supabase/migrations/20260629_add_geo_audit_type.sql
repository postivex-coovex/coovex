-- Add 'geo' to audit_type enum for GEO-only scans
ALTER TYPE audit_type ADD VALUE IF NOT EXISTS 'geo';
