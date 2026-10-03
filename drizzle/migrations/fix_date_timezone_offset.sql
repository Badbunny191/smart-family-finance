-- Migration: Fix stored date timezone offset
-- Problem: Old client code sent new Date("YYYY-MM-DD"T00:00:00").toISOString()
-- which stores UTC 17:00 (Bangkok midnight = UTC 17:00 previous day).
-- Every transaction is stored +1 Bangkok calendar date.
--
-- Fix: Subtract 7 hours from every date so UTC 17:00 → UTC 10:00
-- which correctly maps to Bangkok 00:00:00.
--
-- Verification: strftime(date-25200, 'unixepoch', '+07:00') = Bangkok midnight
-- (e.g. 2026-09-29 17:00 UTC - 7h = 2026-09-29 10:00 UTC → Bangkok 00:00 same day)

UPDATE transactions SET date = date - 25200 WHERE date IS NOT NULL;
