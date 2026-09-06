-- Migration: Smart Family Finance V1 Final Architecture
-- Target: Cloudflare D1 (SQLite Engine)

-- 1. USERS
CREATE TABLE IF NOT EXISTS `users` (
    `id` TEXT PRIMARY KEY NOT NULL,
    `name` TEXT NOT NULL,
    `email` TEXT NOT NULL UNIQUE,
    `role` TEXT NOT NULL DEFAULT 'viewer' CHECK(`role` IN ('admin', 'viewer')),
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    `deleted_at` INTEGER
);
CREATE INDEX IF NOT EXISTS `users_deleted_idx` ON `users` (`deleted_at`);

-- 2. PERSONS
CREATE TABLE IF NOT EXISTS `persons` (
    `id` TEXT PRIMARY KEY NOT NULL,
    `name` TEXT NOT NULL,
    `is_daughter` INTEGER NOT NULL DEFAULT 0,
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    `deleted_at` INTEGER
);
CREATE INDEX IF NOT EXISTS `persons_deleted_idx` ON `persons` (`deleted_at`);

-- 3. PROPERTIES
CREATE TABLE IF NOT EXISTS `properties` (
    `id` TEXT PRIMARY KEY NOT NULL,
    `name` TEXT NOT NULL,
    `owner_person_id` TEXT NOT NULL,
    `status` TEXT NOT NULL DEFAULT 'active' CHECK(`status` IN ('active', 'inactive')),
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    `deleted_at` INTEGER,
    FOREIGN KEY (`owner_person_id`) REFERENCES `persons`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS `properties_owner_idx` ON `properties` (`owner_person_id`);
CREATE INDEX IF NOT EXISTS `properties_deleted_idx` ON `properties` (`deleted_at`);

-- 4. ACCOUNTS
CREATE TABLE IF NOT EXISTS `accounts` (
    `id` TEXT PRIMARY KEY NOT NULL,
    `name` TEXT NOT NULL,
    `person_id` TEXT NOT NULL,
    `property_id` TEXT,
    `account_type` TEXT NOT NULL CHECK(`account_type` IN ('bank', 'cash')),
    `opening_balance` REAL NOT NULL DEFAULT 0,
    `current_balance` REAL NOT NULL DEFAULT 0,
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    `deleted_at` INTEGER,
    FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS `accounts_person_idx` ON `accounts` (`person_id`);
CREATE INDEX IF NOT EXISTS `accounts_property_idx` ON `accounts` (`property_id`);
CREATE INDEX IF NOT EXISTS `accounts_deleted_idx` ON `accounts` (`deleted_at`);

-- 5. CATEGORIES
CREATE TABLE IF NOT EXISTS `categories` (
    `id` TEXT PRIMARY KEY NOT NULL,
    `name` TEXT NOT NULL,
    `type` TEXT NOT NULL CHECK(`type` IN ('income', 'expense')),
    `icon` TEXT,
    `color` TEXT,
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    `deleted_at` INTEGER
);
CREATE INDEX IF NOT EXISTS `categories_deleted_idx` ON `categories` (`deleted_at`);

-- 6. TRANSACTIONS
CREATE TABLE IF NOT EXISTS `transactions` (
    `id` TEXT PRIMARY KEY NOT NULL,
    `type` TEXT NOT NULL CHECK(`type` IN ('income', 'expense', 'transfer')),
    `amount` REAL NOT NULL,
    `date` INTEGER NOT NULL,
    `title` TEXT NOT NULL,
    `owner_person_id` TEXT NOT NULL,
    `payer_person_id` TEXT NOT NULL,
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
    FOREIGN KEY (`owner_person_id`) REFERENCES `persons`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`payer_person_id`) REFERENCES `persons`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`source_account_id`) REFERENCES `accounts`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`destination_account_id`) REFERENCES `accounts`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS `transactions_date_idx` ON `transactions` (`date`);
CREATE INDEX IF NOT EXISTS `transactions_support_idx` ON `transactions` (`payer_person_id`, `owner_person_id`, `type`, `status`, `deleted_at`);
CREATE INDEX IF NOT EXISTS `transactions_property_idx` ON `transactions` (`property_id`);
CREATE INDEX IF NOT EXISTS `transactions_deleted_idx` ON `transactions` (`deleted_at`);

-- 7. ATTACHMENTS
CREATE TABLE IF NOT EXISTS `attachments` (
    `id` TEXT PRIMARY KEY NOT NULL,
    `transaction_id` TEXT NOT NULL,
    `file_key` TEXT NOT NULL,
    `file_name` TEXT NOT NULL,
    `file_type` TEXT NOT NULL,
    `file_size` INTEGER NOT NULL,
    `width` INTEGER,
    `height` INTEGER,
    `uploaded_by_user_id` TEXT NOT NULL,
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    `deleted_at` INTEGER,
    FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS `attachments_transaction_idx` ON `attachments` (`transaction_id`);
CREATE INDEX IF NOT EXISTS `attachments_deleted_idx` ON `attachments` (`deleted_at`);

-- 8. ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS `activity_logs` (
    `id` TEXT PRIMARY KEY NOT NULL,
    `user_id` TEXT NOT NULL,
    `action` TEXT NOT NULL CHECK(`action` IN ('CREATE', 'UPDATE', 'DELETE', 'RESTORE')),
    `entity` TEXT NOT NULL,
    `entity_id` TEXT NOT NULL,
    `old_value` TEXT,
    `new_value` TEXT,
    `created_at` INTEGER NOT NULL,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS `logs_entity_idx` ON `activity_logs` (`entity`, `entity_id`);

-- 9. RECURRING SCHEDULES (Dormant V2 Table)
CREATE TABLE IF NOT EXISTS `recurring_schedules` (
    `id` TEXT PRIMARY KEY NOT NULL,
    `title` TEXT NOT NULL,
    `amount` REAL NOT NULL,
    `frequency` TEXT NOT NULL CHECK(`frequency` IN ('daily', 'weekly', 'monthly', 'yearly')),
    `start_date` INTEGER NOT NULL,
    `next_run_date` INTEGER NOT NULL,
    `owner_person_id` TEXT NOT NULL,
    `payer_person_id` TEXT NOT NULL,
    `category_id` TEXT,
    `status` TEXT NOT NULL DEFAULT 'active' CHECK(`status` IN ('active', 'paused', 'terminated')),
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    `deleted_at` INTEGER,
    FOREIGN KEY (`owner_person_id`) REFERENCES `persons`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`payer_person_id`) REFERENCES `persons`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- 10. BUDGETS (Dormant V2 Table)
CREATE TABLE IF NOT EXISTS `budgets` (
    `id` TEXT PRIMARY KEY NOT NULL,
    `category_id` TEXT NOT NULL,
    `property_id` TEXT,
    `amount` REAL NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    `deleted_at` INTEGER,
    FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- 11. OCR RESULTS (Dormant V2 Table)
CREATE TABLE IF NOT EXISTS `ocr_results` (
    `id` TEXT PRIMARY KEY NOT NULL,
    `attachment_id` TEXT NOT NULL,
    `raw_payload` TEXT NOT NULL,
    `detected_amount` REAL,
    `detected_date` INTEGER,
    `confidence_score` REAL,
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    `deleted_at` INTEGER,
    FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- 12. LINE ACCOUNTS (Dormant V2 Table)
CREATE TABLE IF NOT EXISTS `line_accounts` (
    `id` TEXT PRIMARY KEY NOT NULL,
    `user_id` TEXT NOT NULL UNIQUE,
    `line_user_id` TEXT NOT NULL UNIQUE,
    `display_name` TEXT,
    `picture_url` TEXT,
    `notify_enabled` INTEGER NOT NULL DEFAULT 1,
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    `deleted_at` INTEGER,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);