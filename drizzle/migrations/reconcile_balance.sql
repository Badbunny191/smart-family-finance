-- ============================================================
-- Reconciliation Query: Detect balance mismatches
-- Run via:
--   npx wrangler d1 execute smart-family-finance-db --remote \
--     --file drizzle/migrations/reconcile_balance.sql
--
-- Business rule (matches getBalanceImpact / getTransferImpact):
--   expected = opening_balance
--            + SUM(income.completed, destination = account.id).amount
--            - SUM(expense.completed, source = account.id).amount
--            + SUM(adjustment.completed, source = account.id, direction='increase').amount
--            - SUM(adjustment.completed, source = account.id, direction='decrease').amount
--            + SUM(transfer.completed, destination = account.id).amount
--            - SUM(transfer.completed, source = account.id).amount
--
-- Filters: deleted_at IS NULL
--          status = 'completed'  (pending/cancelled do not affect balance)
-- ============================================================

WITH tx_impact AS (
    SELECT
        a.id AS account_id,
        a.name AS account_name,
        a.opening_balance,
        a.current_balance AS stored_balance,
        COALESCE(SUM(
            CASE
                WHEN t.type = 'income'
                     AND t.status = 'completed'
                     AND t.deleted_at IS NULL
                     AND t.destination_account_id = a.id
                THEN t.amount
                WHEN t.type = 'expense'
                     AND t.status = 'completed'
                     AND t.deleted_at IS NULL
                     AND t.source_account_id = a.id
                THEN -t.amount
                WHEN t.type = 'adjustment'
                     AND t.status = 'completed'
                     AND t.deleted_at IS NULL
                     AND t.source_account_id = a.id
                     AND t.adjustment_direction = 'increase'
                THEN t.amount
                WHEN t.type = 'adjustment'
                     AND t.status = 'completed'
                     AND t.deleted_at IS NULL
                     AND t.source_account_id = a.id
                     AND t.adjustment_direction = 'decrease'
                THEN -t.amount
                WHEN t.type = 'transfer'
                     AND t.status = 'completed'
                     AND t.deleted_at IS NULL
                     AND t.destination_account_id = a.id
                THEN t.amount
                WHEN t.type = 'transfer'
                     AND t.status = 'completed'
                     AND t.deleted_at IS NULL
                     AND t.source_account_id = a.id
                THEN -t.amount
                ELSE 0
            END
        ), 0) AS calculated_delta
    FROM accounts a
    LEFT JOIN transactions t
        ON t.source_account_id = a.id OR t.destination_account_id = a.id
    WHERE a.deleted_at IS NULL
    GROUP BY a.id, a.name, a.opening_balance, a.current_balance
)
SELECT
    account_id,
    account_name,
    opening_balance,
    calculated_delta,
    (opening_balance + calculated_delta) AS expected_balance,
    stored_balance,
    stored_balance - (opening_balance + calculated_delta) AS discrepancy,
    CASE
        WHEN ABS(stored_balance - (opening_balance + calculated_delta)) > 0.01
        THEN 'MISMATCH'
        ELSE 'OK'
    END AS status
FROM tx_impact
ORDER BY ABS(stored_balance - (opening_balance + calculated_delta)) DESC, account_name;

-- Summary
-- Replace the second statement with:
--   SELECT
--       COUNT(*) AS total_accounts,
--       SUM(CASE WHEN ABS(stored_balance - (opening_balance + calculated_delta)) > 0.01 THEN 1 ELSE 0 END) AS mismatch_count
--   FROM tx_impact;
