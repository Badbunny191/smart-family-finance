-- ============================================================
-- Migration: 0016_add_last_sent_at_to_notification_settings.sql
-- Date: 2026-09-25
-- Description: Add last_sent_at column to notification_settings table
-- 
-- Root Cause: Migration 0014 created notification_settings without last_sent_at
-- This caused D1_ERROR: no such column: ns.last_sent_at
-- ============================================================

-- Add last_sent_at column to notification_settings table
ALTER TABLE `notification_settings` 
ADD COLUMN `last_sent_at` integer;
