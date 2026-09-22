-- ============================================================
-- Migration: 0014_add_line_notification_settings.sql
-- Date: 2026-09-22
-- Description: Add LINE notification settings table
-- 
-- This migration is idempotent - safe to run multiple times
-- ============================================================

-- ============================================================
-- 1. Create notification_settings table (IF NOT EXISTS)
-- This table stores settings for each notification type
-- ============================================================
CREATE TABLE IF NOT EXISTS `notification_settings` (
  `id` text PRIMARY KEY,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `notification_type` text NOT NULL CHECK (
    `notification_type` IN ('daily_summary', 'pending_reminder', 'overdue_alert')
  ),
  `settings` text NOT NULL DEFAULT '{}',
  `enabled` integer NOT NULL DEFAULT 1,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  UNIQUE(`user_id`, `notification_type`)
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS `notification_settings_user_idx` 
  ON `notification_settings` (`user_id`);

-- Index for fast lookup by notification type
CREATE INDEX IF NOT EXISTS `notification_settings_type_idx` 
  ON `notification_settings` (`notification_type`);

-- ============================================================
-- 2. Insert default daily_summary settings for users who don't have one
-- Using INSERT OR IGNORE to avoid duplicates
-- Default: send at 08:00 ICT, show all metrics, enabled
-- ============================================================
INSERT OR IGNORE INTO `notification_settings` 
  (`id`, `user_id`, `notification_type`, `settings`, `enabled`, `created_at`, `updated_at`)
SELECT 
  'ns_daily_' || `id`,
  `id`,
  'daily_summary',
  '{"sendTime":"08:00","showBalance":true,"showIncome":true,"showExpense":true,"showPending":true,"showOverdue":true}',
  1,
  UNIXEPOCH(),
  UNIXEPOCH()
FROM `users`
WHERE `id` NOT IN (
  SELECT `user_id` FROM `notification_settings` WHERE `notification_type` = 'daily_summary'
);
