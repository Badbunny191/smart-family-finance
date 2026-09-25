-- ============================================================
-- Migration: 0016_add_last_sent_at.sql
-- Date: 2026-09-24
-- Description: Add last_sent_at column to notification_settings
--              to support preventing duplicate sends within the same day.
--
-- This migration is idempotent - safe to run multiple times.
-- ============================================================

-- ============================================================
-- 1. Add last_sent_at column (IF NOT EXISTS)
-- Tracks the last time we successfully sent a notification
-- Used by cron to skip recipients already notified today (Asia/Bangkok)
-- ============================================================
ALTER TABLE `notification_settings`
  ADD COLUMN `last_sent_at` integer;

-- ============================================================
-- 2. Index for fast lookup by last_sent_at (for cron queries)
-- ============================================================
CREATE INDEX IF NOT EXISTS `notification_settings_last_sent_at_idx`
  ON `notification_settings` (`last_sent_at`);
