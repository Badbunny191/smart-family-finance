ALTER TABLE `users` ADD COLUMN `email_verified` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `users` ADD COLUMN `image` TEXT;

CREATE TABLE IF NOT EXISTS `auth_sessions` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `expires_at` INTEGER NOT NULL,
  `ip_address` TEXT,
  `user_agent` TEXT,
  `user_id` TEXT NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `sessions_user_idx` ON `auth_sessions` (`user_id`);

CREATE TABLE IF NOT EXISTS `auth_accounts` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `account_id` TEXT NOT NULL,
  `provider_id` TEXT NOT NULL,
  `user_id` TEXT NOT NULL,
  `access_token` TEXT,
  `refresh_token` TEXT,
  `id_token` TEXT,
  `expires_at` INTEGER,
  `password` TEXT,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `accounts_auth_user_idx` ON `auth_accounts` (`user_id`);

CREATE TABLE IF NOT EXISTS `auth_verifications` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `identifier` TEXT NOT NULL,
  `value` TEXT NOT NULL,
  `expires_at` INTEGER NOT NULL,
  `created_at` INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS `verifications_identifier_idx` ON `auth_verifications` (`identifier`);