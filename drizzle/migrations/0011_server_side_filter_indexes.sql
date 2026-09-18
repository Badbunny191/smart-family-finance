-- ============================================================
-- Migration: 0011_server_side_filter_indexes.sql
-- Date: 2026-09-18
-- Description: Add index for server-side filter support on categoryId
-- Rationale:
--   - categoryId filter needs index for efficient lookup
--   - source/destination account indexes already exist in migration 0009
-- Impact:
--   - Will benefit queries filtering by category
-- Performance Gain:
--   - Without index: O(n) full table scan
--   - With index: O(log n) b-tree lookup
-- ============================================================

-- Index for categoryId filter
CREATE INDEX IF NOT EXISTS `transactions_category_idx`
    ON `transactions` (`category_id`);

-- Note: source_account_id and destination_account_id indexes
-- are already defined in migration 0009
-- (CREATE INDEX IF NOT EXISTS is idempotent, so no harm in having it here)
