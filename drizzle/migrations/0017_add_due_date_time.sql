-- ============================================================
-- Migration: 0017_add_due_date_time.sql
-- Date: 2026-09-28
-- Phase: 1 of v3.0 (Master Spec)
-- Description: Add due_date_time column to transactions
--              for per-transaction Due DateTime.
--
-- Backward compatible: column is nullable.
-- Idempotent: safe to run multiple times.
-- ============================================================

-- 1. Add due_date_time column (nullable integer unix epoch seconds)
--    Stored in UTC. Client converts ICT date+time → UTC before send.
ALTER TABLE transactions ADD COLUMN due_date_time INTEGER;

-- 2. Composite index for derived overdue/due-soon queries (Phase 2+)
CREATE INDEX IF NOT EXISTS transactions_status_due_idx
  ON transactions(business_status, due_date_time);

-- 3. Backfill existing pending income to match legacy "date + 1 day + 18:00 ICT"
--    Bangkok (UTC+7) 18:00 = UTC 11:00 → offset = (18 - 7) * 3600 = 39600 seconds
--    Legacy deadline (seconds since epoch) = date + 86400 + 39600
--                                             = date + 126000
UPDATE transactions
SET due_date_time = date + 126000
WHERE status = 'pending'
  AND business_status = 'pending'
  AND type = 'income'
  AND due_date_time IS NULL;

-- 4. Cleanup: completed transactions must have NULL (no due date)
UPDATE transactions SET due_date_time = NULL
WHERE status = 'completed';
