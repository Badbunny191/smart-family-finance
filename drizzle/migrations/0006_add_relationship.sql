ALTER TABLE `persons` ADD COLUMN `relationship` TEXT CHECK (`relationship` IN ('father', 'mother', 'son', 'daughter', 'other'));
UPDATE `persons` SET `relationship` = 'daughter' WHERE `is_daughter` = 1 AND `relationship` IS NULL;
