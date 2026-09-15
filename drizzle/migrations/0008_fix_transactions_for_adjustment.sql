-- ============================================================
-- Migration: 0008_fix_transactions_for_adjustment.sql
-- Date: 2026-09-16
-- Author: Smart Family Finance
-- Description: Fix transactions table to support adjustment type
--              and allow NULL owner/payer person IDs
-- ============================================================

-- Step 1: Remove old CHECK constraint on type column
-- SQLite doesn't support DROP CONSTRAINT, so we recreate the table

-- Create temporary table with new schema
CREATE TABLE IF NOT EXISTS `transactions_new` (
    `id` TEXT PRIMARY KEY NOT NULL,
    `type` TEXT NOT NULL CHECK(`type` IN ('income', 'expense', 'transfer', 'adjustment')),
    `amount` REAL NOT NULL,
    `date` INTEGER NOT NULL,
    `title` TEXT NOT NULL,
    `owner_person_id` TEXT,
    `payer_person_id` TEXT,
    `property_id` TEXT,
    `category_id` TEXT,
    `source_account_id` TEXT,
    `destination_account_id` TEXT,
    `status` TEXT NOT NULL DEFAULT 'completed' CHECK(`status` IN ('pending', 'completed', 'cancelled')),
    `business_status` TEXT CHECK(`business_status` IN ('pending', 'received')),
    `note` TEXT,
    `adjustment_reason` TEXT,
    `adjustment_direction` TEXT CHECK(`adjustment_direction` IN ('increase', 'decrease')),
    `created_by_user_id` TEXT NOT NULL,
    `recurring_schedule_id` TEXT,
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    `deleted_at` INTEGER,
    FOREIGN KEY (`owner_person_id`) REFERENCES `persons`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`payer_person_id`) REFERENCES `persons`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`source_account_id`) REFERENCES `accounts`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`destination_account_id`) REFERENCES `accounts`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- Step 2: Copy data from old table to new table
INSERT INTO `transactions_new` (
    id, type, amount, date, title, owner_person_id, payer_person_id,
    property_id, category_id, source_account_id, destination_account_id,
    status, business_status, note, adjustment_reason, adjustment_direction,
    created_by_user_id, recurring_schedule_id, created_at, updated_at, deleted_at
)
SELECT
    id, type, amount, date, title, owner_person_id, payer_person_id,
    property_id, category_id, source_account_id, destination_account_id,
    status, business_status, note, adjustment_reason, adjustment_direction,
    created_by_user_id, recurring_schedule_id, created_at, updated_at, deleted_at
FROM `transactions`;

-- Step 3: Drop old table
DROP TABLE `transactions`;

-- Step 4: Rename new table to original name
ALTER TABLE `transactions_new` RENAME TO `transactions`;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS `transactions_date_idx` ON `transactions` (`date`);
CREATE INDEX IF NOT EXISTS `transactions_support_idx` ON `transactions` (`payer_person_id`, `owner_person_id`, `type`, `status`, `deleted_at`);
CREATE INDEX IF NOT EXISTS `transactions_property_idx` ON `transactions` (`property_id`);
CREATE INDEX IF NOT EXISTS `transactions_deleted_idx` ON `transactions` (`deleted_at`);
CREATE INDEX IF NOT EXISTS `transactions_business_status_idx` ON `transactions` (`business_status`);
