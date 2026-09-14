-- ============================================================
-- Migration: 0007_add_adjustment_columns.sql
-- Date: 2026-09-14
-- Author: Smart Family Finance
-- Description: Add adjustment_reason and adjustment_direction 
--             columns to transactions table for account adjustment feature
-- ============================================================

-- Step 1: Add adjustment_reason column (nullable text)
ALTER TABLE transactions ADD COLUMN adjustment_reason text;

-- Step 2: Add adjustment_direction column (nullable text)
-- Only accepts 'increase' or 'decrease' values
ALTER TABLE transactions ADD COLUMN adjustment_direction text;

-- Step 3: Verify columns were added (optional, for debugging)
-- SELECT adjustment_reason, adjustment_direction FROM transactions LIMIT 1;
