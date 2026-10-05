/**
 * Transaction Effective Date Query Helpers
 *
 * Purpose:
 * - Single source of truth for the "effective date" SQL CASE expression
 *   used across Dashboard / LINE Summary / Report / API filters / API sorting.
 *
 * Background:
 * - transactions.date = when the transaction was created (Business Date)
 * - transactions.receivedDate = when customer actually paid (income, completed)
 * - transactions.paidDate = when payment was actually made (expense, completed)
 *
 * Rule (aligned with getEffectiveDate() in src/lib/utils.ts):
 * - pending          -> date
 * - completed income -> receivedDate ?? date
 * - completed expense -> paidDate ?? date
 * - transfer / adjustment -> date (no settlement semantic)
 *
 * Why this file:
 * - getEffectiveDate() in src/lib/utils.ts is a UI/JS helper (Date object)
 * - This module produces the SAME rule as a SQL expression for Drizzle
 *   and raw SQL queries. Sharing the rule avoids drift between UI and DB.
 *
 * Usage:
 *   import { effectiveDateExpr, effectiveDateExprDesc } from '@/lib/transaction-effective-date-query';
 *
 *   // Filter
 *   .where(gte(effectiveDateExpr, sql`${monthStartSec}`))
 *
 *   // Order by
 *   .orderBy(effectiveDateExprDesc, desc(transactions.createdAt))
 *
 *   // Manual CASE (raw)
 *   import { EFFECTIVE_DATE_SQL_CASE } from '@/lib/transaction-effective-date-query';
 *   const where = sql`${EFFECTIVE_DATE_SQL_CASE} >= ${start}`;
 */

import { sql, type SQL } from 'drizzle-orm';
import { transactions } from '@/db/schema';

/**
 * Raw SQL CASE expression (string) — use when you need to reference the effective
 * date inside a raw `sql\`...\`` template.
 *
 * MUST stay in sync with effectiveDateExpr() below.
 */
export const EFFECTIVE_DATE_SQL_CASE = `CASE
  WHEN ${transactions.type.name} = 'income'
    AND ${transactions.businessStatus.name} = 'received'
    AND ${transactions.receivedDate.name} IS NOT NULL
    THEN ${transactions.receivedDate.name}
  WHEN ${transactions.type.name} = 'expense'
    AND ${transactions.businessStatus.name} = 'received'
    AND ${transactions.paidDate.name} IS NOT NULL
    THEN ${transactions.paidDate.name}
  ELSE ${transactions.date.name}
END`;

/**
 * Drizzle SQL expression for the effective date — use in WHERE / ORDER BY
 * with Drizzle query builder.
 *
 * Returns a unix timestamp (seconds since epoch), matching how
 * transactions.date / receivedDate / paidDate are stored (Drizzle mode=timestamp).
 */
export function effectiveDateExpr(): SQL<number> {
  return sql<number>`CASE
    WHEN ${transactions.type} = 'income'
      AND ${transactions.businessStatus} = 'received'
      AND ${transactions.receivedDate} IS NOT NULL
      THEN ${transactions.receivedDate}
    WHEN ${transactions.type} = 'expense'
      AND ${transactions.businessStatus} = 'received'
      AND ${transactions.paidDate} IS NOT NULL
      THEN ${transactions.paidDate}
    ELSE ${transactions.date}
  END`;
}

/**
 * Convenience: effectiveDateExpr() DESC — for sorting newest first.
 */
export const effectiveDateExprDesc: SQL<number> = sql<number>`${effectiveDateExpr()} DESC`;