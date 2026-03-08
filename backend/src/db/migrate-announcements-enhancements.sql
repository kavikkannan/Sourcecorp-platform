-- Migration: Add image_path and category columns to announcements table
-- Run this SQL directly in your PostgreSQL database

BEGIN;

-- Add image_path column
ALTER TABLE admin_schema.announcements
ADD COLUMN IF NOT EXISTS image_path VARCHAR(500);

-- Add category column (GENERAL or BANK_UPDATES)
ALTER TABLE admin_schema.announcements
ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'GENERAL'
CHECK (category IN ('GENERAL', 'BANK_UPDATES'));

-- Create index on category for faster filtering
CREATE INDEX IF NOT EXISTS idx_announcements_category 
ON admin_schema.announcements(category);

COMMIT;

