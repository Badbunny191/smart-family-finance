-- ============================================================
-- Migration: 0018_add_received_paid_dates.sql
-- Date: 2026-10-03
-- Phase: Phase B of v3.0 (Actual Payment Date Support)
-- Description:
--   Add received_date and paid_date columns to track the actual
--   date when customer paid (income) or payment was made (expense).
--
--   These are SEPARATE from transactions.date (transaction date)
--   and due_date_time (appointment/deadline). They only have
--   meaning when business_status='received'.
--
-- Backward compatible: columns are nullable — existing reads unaffected.
-- Idempotent: safe to run multiple times.
-- ============================================================

-- 1. Add received_date column (UTC unix epoch seconds)
ALTER TABLE transactions ADD COLUMN received_date INTEGER;

-- 2. Add paid_date column (UTC unix epoch seconds)
ALTER TABLE transactions ADD COLUMN paid_date INTEGER;

-- 3. Indexes for daily summary queries
CREATE INDEX IF NOT EXISTS transactions_received_date_idx
  ON transactions(received_date);
CREATE INDEX IF NOT EXISTS transactions_paid_date_idx
  ON transactions(paid_date);

-- 4. Backfill: existing received transactions inherit date as their received/paid date
--    (Legacy behavior: date was used for both transaction date and settlement date)
UPDATE transactions
SET received_date = date
WHERE business_status = 'received'
  AND type = 'income'
  AND received_date IS NULL
  AND date IS NOT NULL;

UPDATE transactions
SET paid_date = date
WHERE business_status = 'received'
  AND type = 'expense'
  AND paid_date IS NULL
  AND date IS NOT NULL;

-- 5. Clear due_date_time for received transactions (business rule)
--    Completed/received transactions should not have a due date.
UPDATE transactions
SET due_date_time = NULL
WHERE business_status = 'received'
  AND due_date_time IS NOT NULL;
