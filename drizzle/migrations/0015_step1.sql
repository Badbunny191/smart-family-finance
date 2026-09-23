-- ============================================================
-- Migration: 0015_migrate_to_global_daily_summary.sql
-- Date: 2026-09-23
-- Description: Migrate notification_settings.daily_summary to Global Setting
--
-- This migration is idempotent - safe to run multiple times
-- NOTE: D1 script mode processes statements as separate batches
-- ============================================================

-- Capture latest sendTime
DROP TABLE IF EXISTS ns_winner;
CREATE TEMP TABLE ns_winner (send_time TEXT NOT NULL);
INSERT INTO ns_winner (send_time) SELECT COALESCE((SELECT json_extract(settings, '$.sendTime') FROM notification_settings WHERE notification_type='daily_summary' AND user_id IS NOT NULL ORDER BY updated_at DESC LIMIT 1), '08:00');
