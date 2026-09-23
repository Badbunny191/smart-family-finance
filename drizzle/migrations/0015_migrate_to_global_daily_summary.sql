-- ============================================================
-- Migration: 0015_migrate_to_global_daily_summary.sql
-- Date: 2026-09-23
-- Description: Migrate notification_settings.daily_summary to Global Setting
--
-- BEFORE: Per-user design (UNIQUE(user_id, notification_type))
--   - ns_daily_IhjmTSiz... → sendTime = "18:30" (updated 2026-09-23)
--   - ns_daily_0afb0145... → sendTime = "08:00" (updated 2026-09-22)
--
-- AFTER: Global design (1 row total, user_id = NULL)
--   - ns_daily_global → sendTime = LATEST from UI (18:30)
--
-- This migration is idempotent - safe to run multiple times
-- Note: D1 does not support BEGIN TRANSACTION in raw SQL.
-- D1 auto-wraps each batch in an implicit transaction.
-- ============================================================

-- ============================================================
-- Step 1: Capture the LATEST sendTime from existing rows
-- ============================================================
CREATE TEMP TABLE IF NOT EXISTS winner_sendtime (
  send_time TEXT NOT NULL
);

INSERT INTO winner_sendtime (send_time)
SELECT COALESCE(
  (
    SELECT json_extract(settings, '$.sendTime')
    FROM notification_settings
    WHERE notification_type = 'daily_summary'
      AND user_id IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT 1
  ),
  '08:00'
);

-- ============================================================
-- Step 2: Delete existing per-user daily_summary rows
-- ============================================================
DELETE FROM notification_settings
WHERE notification_type = 'daily_summary';

-- ============================================================
-- Step 3: Schema change - make user_id nullable
-- ============================================================
-- SQLite cannot ALTER COLUMN, so we recreate the table.

CREATE TABLE IF NOT EXISTS ns_backup AS
  SELECT * FROM notification_settings;

DROP TABLE notification_settings;

CREATE TABLE notification_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (
    notification_type IN ('daily_summary', 'pending_reminder', 'overdue_alert')
  ),
  settings TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO notification_settings
  SELECT * FROM ns_backup;

DROP TABLE ns_backup;

-- ============================================================
-- Step 4: Recreate indexes
-- ============================================================
DROP INDEX IF EXISTS notification_settings_user_idx;
DROP INDEX IF EXISTS notification_settings_type_idx;

CREATE INDEX IF NOT EXISTS notification_settings_user_idx
  ON notification_settings (user_id);

CREATE INDEX IF NOT EXISTS notification_settings_type_idx
  ON notification_settings (notification_type);

-- New: enforce only ONE global row per notification_type
CREATE UNIQUE INDEX IF NOT EXISTS notification_settings_global_unique_idx
  ON notification_settings (notification_type)
  WHERE user_id IS NULL;

-- ============================================================
-- Step 5: Insert the single GLOBAL daily_summary row
-- ============================================================
INSERT INTO notification_settings
  (id, user_id, notification_type, settings, enabled, created_at, updated_at)
VALUES (
  'ns_daily_global',
  NULL,
  'daily_summary',
  json_object(
    'sendTime', (SELECT send_time FROM winner_sendtime),
    'showBalance', 1,
    'showIncome', 1,
    'showExpense', 1,
    'showPending', 1,
    'showOverdue', 1
  ),
  1,
  UNIXEPOCH(),
  UNIXEPOCH()
);

-- Cleanup
DROP TABLE winner_sendtime;
