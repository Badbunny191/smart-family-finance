-- ============================================================
-- Migration: 0009_add_account_id_indexes.sql
-- Date: 2026-09-17
-- Description: Add indexes on source_account_id and destination_account_id
-- Rationale:
--   - /api/accounts/[id]/usage queries transactions by source or destination
--   - /api/admin/reconcile walks every transaction per account
--   - /api/transactions left-joins on both columns
--   Without indexes these become full table scans as data grows.
-- ============================================================

CREATE INDEX IF NOT EXISTS `transactions_source_account_idx`
    ON `transactions` (`source_account_id`);

CREATE INDEX IF NOT EXISTS `transactions_destination_account_idx`
    ON `transactions` (`destination_account_id`);
