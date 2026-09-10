-- Migration: Add relationship column to persons table (D1-safe)
-- Target: Cloudflare D1 (SQLite Engine)
-- Date: 2026-09-10
-- Strategy: ALTER TABLE ADD COLUMN (no DROP TABLE, no table recreation)

-- Step 1: Add relationship column (nullable, with CHECK constraint)
-- Safe to run even if column already exists (D1 will error gracefully)
ALTER TABLE `persons` ADD COLUMN `relationship` TEXT
  CHECK (`relationship` IN ('father', 'mother', 'son', 'daughter', 'other'));

-- Step 2: Migrate existing data
-- is_daughter = 1 -> 'daughter'
-- Only update rows where relationship is NULL to be idempotent
UPDATE `persons` SET `relationship` = 'daughter'
  WHERE `is_daughter` = 1 AND `relationship` IS NULL;
