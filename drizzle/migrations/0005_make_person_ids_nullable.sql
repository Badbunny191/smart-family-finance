-- Migration: Make transaction person IDs nullable
-- Target: Cloudflare D1 (SQLite Engine)
-- Date: 2026-09-09

-- SQLite doesn't support ALTER COLUMN DROP NOT NULL directly
-- Use table recreation approach

-- Step 1: Create new table with nullable columns (matching exact column order from production)
CREATE TABLE IF NOT EXISTS `transactions_new` (
    `id` TEXT PRIMARY KEY NOT NULL,
    `type` TEXT NOT NULL CHECK(`type` IN ('income', 'expense', 'transfer')),
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
    `note` TEXT,
    `created_by_user_id` TEXT NOT NULL,
    `recurring_schedule_id` TEXT,
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    `deleted_at` INTEGER,
    `business_status` TEXT CHECK(`business_status` IN ('customer_paid', 'business_received', 'closed')),
    FOREIGN KEY (`owner_person_id`) REFERENCES `persons`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`payer_person_id`) REFERENCES `persons`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`source_account_id`) REFERENCES `accounts`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`destination_account_id`) REFERENCES `accounts`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- Step 2: Copy data from old table (explicit column list for safety)
INSERT INTO `transactions_new` (
    `id`, `type`, `amount`, `date`, `title`,
    `owner_person_id`, `payer_person_id`, `property_id`, `category_id`,
    `source_account_id`, `destination_account_id`, `status`,
    `note`, `created_by_user_id`, `recurring_schedule_id`,
    `created_at`, `updated_at`, `deleted_at`, `business_status`
) SELECT
    `id`, `type`, `amount`, `date`, `title`,
    `owner_person_id`, `payer_person_id`, `property_id`, `category_id`,
    `source_account_id`, `destination_account_id`, `status`,
    `note`, `created_by_user_id`, `recurring_schedule_id`,
    `created_at`, `updated_at`, `deleted_at`, `business_status`
FROM `transactions`;

-- Step 3: Drop old table
DROP TABLE `transactions`;

-- Step 4: Rename new table
ALTER TABLE `transactions_new` RENAME TO `transactions`;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS `transactions_date_idx` ON `transactions` (`date`);
CREATE INDEX IF NOT EXISTS `transactions_support_idx` ON `transactions` (`payer_person_id`, `owner_person_id`, `type`, `status`, `deleted_at`);
CREATE INDEX IF NOT EXISTS `transactions_property_idx` ON `transactions` (`property_id`);
CREATE INDEX IF NOT EXISTS `transactions_deleted_idx` ON `transactions` (`deleted_at`);
