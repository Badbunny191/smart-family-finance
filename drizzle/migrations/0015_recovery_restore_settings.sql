-- ============================================================
-- Recovery: Restore notification_settings from backup
-- Date: 2026-09-23
-- Source: backup-2026-09-23-remote-pre-migration.sql (lines 480-481)
--
-- Goal: Restore 2 rows (Per-user design) to pre-migration state
-- Schema: NOT modified (still NOT NULL on user_id, UNIQUE constraint)
-- ============================================================

INSERT INTO "notification_settings" ("id","user_id","notification_type","settings","enabled","created_at","updated_at") VALUES('ns_daily_0afb0145f706eb489c962be13c122610','0afb0145f706eb489c962be13c122610','daily_summary','{"sendTime":"08:00","showBalance":true,"showIncome":true,"showExpense":true,"showPending":true,"showOverdue":true}',1,1790091066,1790091066);
INSERT INTO "notification_settings" ("id","user_id","notification_type","settings","enabled","created_at","updated_at") VALUES('ns_daily_IhjmTSizXWJl90fku-lpn','IhjmTSizXWJl90fku-lpn','daily_summary','{"sendTime":"18:30","showBalance":true,"showIncome":true,"showExpense":true,"showPending":true,"showOverdue":true}',1,1790091066,1790162133);
