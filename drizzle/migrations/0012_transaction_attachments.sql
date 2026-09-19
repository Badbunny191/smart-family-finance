-- ============================================================
-- Migration: 0012_transaction_attachments.sql
-- Date: 2026-09-19
-- Description: Create attachments table for transaction images
-- Storage: R2 private bucket
-- Ownership: Via transaction (via transaction.created_by_user_id)
-- ============================================================

-- Create attachments table
CREATE TABLE IF NOT EXISTS `attachments` (
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
  FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE
);

-- Index for transaction lookups
CREATE INDEX IF NOT EXISTS `attachments_transaction_idx` ON `attachments` (`transaction_id`);

-- Index for soft delete queries
CREATE INDEX IF NOT EXISTS `attachments_deleted_idx` ON `attachments` (`deleted_at`);
