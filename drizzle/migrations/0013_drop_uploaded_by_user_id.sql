-- ============================================================
-- Migration: 0013_drop_uploaded_by_user_id.sql
-- Date: 2026-09-19
-- Description: Remove unused uploaded_by_user_id from attachments
-- Reason: Field was removed from schema design but D1 table
--         still has it, causing NOT NULL constraint failures
-- ============================================================

-- SQLite doesn't support DROP COLUMN directly in older versions
-- and has foreign key constraints. We need to recreate the table.

-- Step 1: Create new table without uploaded_by_user_id
CREATE TABLE IF NOT EXISTS `attachments_new` (
  `id` text PRIMARY KEY,
  `transaction_id` text NOT NULL,
  `file_key` text NOT NULL,
  `file_name` text NOT NULL,
  `file_type` text NOT NULL,
  `file_size` integer NOT NULL,
  `width` integer,
  `height` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `deleted_at` integer,
  FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE NO ACTION
);

-- Step 2: Copy data from old table
INSERT INTO `attachments_new` (
  `id`, `transaction_id`, `file_key`, `file_name`, `file_type`,
  `file_size`, `width`, `height`, `created_at`, `updated_at`, `deleted_at`
)
SELECT
  `id`, `transaction_id`, `file_key`, `file_name`, `file_type`,
  `file_size`, `width`, `height`, `created_at`, `updated_at`, `deleted_at`
FROM `attachments`;

-- Step 3: Drop old table
DROP TABLE `attachments`;

-- Step 4: Rename new table
ALTER TABLE `attachments_new` RENAME TO `attachments`;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS `attachments_transaction_idx` ON `attachments` (`transaction_id`);
CREATE INDEX IF NOT EXISTS `attachments_deleted_idx` ON `attachments` (`deleted_at`);
