-- Migration: Allow 'RECONCILE' action in activity_logs
--
-- The original 0000 migration added a CHECK constraint limiting action
-- to 'CREATE', 'UPDATE', 'DELETE', 'RESTORE'. The reconciliation system
-- (v1.4.0) needs to write 'RECONCILE' for audit purposes.
--
-- SQLite doesn't support ALTER TABLE … DROP CONSTRAINT, so we rebuild
-- the table. Because activity_logs is append-only, this is safe to
-- run on live data.

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS `activity_logs_new` (
    `id` TEXT PRIMARY KEY NOT NULL,
    `user_id` TEXT NOT NULL,
    `action` TEXT NOT NULL CHECK(
        `action` IN ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'RECONCILE')
    ),
    `entity` TEXT NOT NULL,
    `entity_id` TEXT NOT NULL,
    `old_value` TEXT,
    `new_value` TEXT,
    `created_at` INTEGER NOT NULL,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
        ON UPDATE NO ACTION ON DELETE NO ACTION
);

INSERT INTO `activity_logs_new` (
    `id`, `user_id`, `action`, `entity`, `entity_id`,
    `old_value`, `new_value`, `created_at`
)
SELECT
    `id`, `user_id`, `action`, `entity`, `entity_id`,
    `old_value`, `new_value`, `created_at`
FROM `activity_logs`;

DROP TABLE `activity_logs`;

ALTER TABLE `activity_logs_new` RENAME TO `activity_logs`;

CREATE INDEX IF NOT EXISTS `logs_entity_idx`
    ON `activity_logs` (`entity`, `entity_id`);

PRAGMA foreign_keys = ON;
