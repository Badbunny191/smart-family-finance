/**
 * Reconciliation Library
 *
 * Helpers for detecting, explaining, and repairing account balance mismatches.
 *
 * IMPORTANT:
 * - Reuses getBalanceImpact() and getTransferImpact() from @/lib/transaction-balance.
 *   Do NOT duplicate balance formulas here.
 * - Root cause analysis is heuristic, not authoritative.
 *   Always worded as "Possible Cause".
 */

import { and, eq, isNull, or, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import { accounts, transactions } from '@/db/schema';
import {
  getBalanceImpact,
  getTransferImpact,
  type TransactionForBalance,
} from '@/lib/transaction-balance';

export type Severity = 'low' | 'medium' | 'high';

export interface ReconcileAccountRow {
  accountId: string;
  accountName: string;
  openingBalance: number;
  storedBalance: number;
  expectedBalance: number;
  discrepancy: number;
  severity: Severity;
}

export interface ReconcileReport {
  accounts: ReconcileAccountRow[];
  hasDiscrepancy: boolean;
  totalAccounts: number;
  mismatchCount: number;
}

const MISMATCH_EPSILON = 0.01;

export function classifySeverity(absDiff: number): Severity {
  if (absDiff <= MISMATCH_EPSILON) return 'low';
  if (absDiff <= 100) return 'low';
  if (absDiff <= 1000) return 'medium';
  return 'high';
}

/**
 * Run reconciliation across all active accounts.
 *
 * Returns the FULL report (including OK rows) when includeAll=true,
 * otherwise only returns mismatched accounts.
 *
 * Math uses the same getBalanceImpact / getTransferImpact helpers
 * that the runtime transaction code uses — no duplicated formulas.
 */
export async function runReconciliation(
  db: AppDatabase,
  options: { includeAll?: boolean } = {}
): Promise<ReconcileReport> {
  const allAccounts = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      openingBalance: accounts.openingBalance,
      currentBalance: accounts.currentBalance,
    })
    .from(accounts)
    .where(isNull(accounts.deletedAt));

  const allTransactions = await db
    .select({
      type: transactions.type,
      amount: transactions.amount,
      status: transactions.status,
      adjustmentDirection: transactions.adjustmentDirection,
      sourceAccountId: transactions.sourceAccountId,
      destinationAccountId: transactions.destinationAccountId,
    })
    .from(transactions)
    .where(
      and(
        isNull(transactions.deletedAt),
        or(eq(transactions.status, 'completed'), eq(transactions.status, 'pending'))
      )
    );

  const expectedByAccount = new Map<string, number>();
  for (const acc of allAccounts) {
    expectedByAccount.set(acc.id, acc.openingBalance);
  }

  for (const tx of allTransactions) {
    const txForBalance: TransactionForBalance = {
      type: tx.type,
      amount: tx.amount,
      status: tx.status,
      adjustmentDirection: tx.adjustmentDirection,
      sourceAccountId: tx.sourceAccountId,
      destinationAccountId: tx.destinationAccountId,
    };

    if (tx.type === 'transfer') {
      if (tx.sourceAccountId) {
        const impact = getTransferImpact(txForBalance, tx.sourceAccountId);
        if (impact !== 0) {
          expectedByAccount.set(
            tx.sourceAccountId,
            (expectedByAccount.get(tx.sourceAccountId) ?? 0) + impact
          );
        }
      }
      if (tx.destinationAccountId) {
        const impact = getTransferImpact(txForBalance, tx.destinationAccountId);
        if (impact !== 0) {
          expectedByAccount.set(
            tx.destinationAccountId,
            (expectedByAccount.get(tx.destinationAccountId) ?? 0) + impact
          );
        }
      }
    } else {
      const impact = getBalanceImpact(txForBalance);
      if (impact !== 0) {
        const targetAccountId =
          tx.type === 'income' ? tx.destinationAccountId : tx.sourceAccountId;
        if (targetAccountId) {
          expectedByAccount.set(
            targetAccountId,
            (expectedByAccount.get(targetAccountId) ?? 0) + impact
          );
        }
      }
    }
  }

  const fullReport: ReconcileAccountRow[] = allAccounts.map((acc) => {
    const expected = expectedByAccount.get(acc.id) ?? acc.openingBalance;
    const discrepancy = acc.currentBalance - expected;
    return {
      accountId: acc.id,
      accountName: acc.name,
      openingBalance: acc.openingBalance,
      storedBalance: acc.currentBalance,
      expectedBalance: expected,
      discrepancy,
      severity: classifySeverity(Math.abs(discrepancy)),
    };
  });

  const filtered = options.includeAll
    ? fullReport
    : fullReport.filter((r) => Math.abs(r.discrepancy) > MISMATCH_EPSILON);

  const mismatchCount = fullReport.filter(
    (r) => Math.abs(r.discrepancy) > MISMATCH_EPSILON
  ).length;

  return {
    accounts: filtered,
    hasDiscrepancy: mismatchCount > 0,
    totalAccounts: fullReport.length,
    mismatchCount,
  };
}

export type PossibleCause =
  | 'pending_inconsistency'
  | 'historical_bug'
  | 'deleted_tx_inconsistency'
  | 'adjustment_inconsistency'
  | 'unknown';

export interface CauseEvidence {
  code: PossibleCause;
  description: string;
  /** Optional related transaction IDs (for "view" affordance) */
  relatedTransactionIds?: string[];
}

/**
 * Heuristic root cause analysis.
 *
 * IMPORTANT: Never concludes. Always returns POSSIBLE causes with evidence.
 *
 * Strategies:
 * 1. If there are pending transactions for this account → likely pending inconsistency
 * 2. If discrepancy is exactly matched by a soft-deleted transaction's amount → likely deleted inconsistency
 * 3. If there are adjustments on the account → possibly adjustment inconsistency
 * 4. Otherwise → possible historical bug
 */
export async function analyzePossibleCauses(
  db: AppDatabase,
  accountId: string,
  discrepancy: number
): Promise<CauseEvidence[]> {
  const causes: CauseEvidence[] = [];
  const absDiff = Math.abs(discrepancy);

  // 1. Pending transactions involving this account
  const pendingRows = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      status: transactions.status,
      sourceAccountId: transactions.sourceAccountId,
      destinationAccountId: transactions.destinationAccountId,
    })
    .from(transactions)
    .where(
      and(
        isNull(transactions.deletedAt),
        eq(transactions.status, 'pending'),
        or(
          eq(transactions.sourceAccountId, accountId),
          eq(transactions.destinationAccountId, accountId)
        )
      )
    );

  if (pendingRows.length > 0) {
    causes.push({
      code: 'pending_inconsistency',
      description: `มีรายการที่ยังไม่ complete ${pendingRows.length} รายการ — ตรวจสอบว่ามีรายการรอจ่าย/รอรับ ที่ควรได้รับการ mark เป็น received แล้วหรือไม่`,
      relatedTransactionIds: pendingRows.map((p) => p.id),
    });
  }

  // 2. Soft-deleted transactions that, had they existed, would have caused this exact discrepancy
  const deletedRows = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      status: transactions.status,
      adjustmentDirection: transactions.adjustmentDirection,
      sourceAccountId: transactions.sourceAccountId,
      destinationAccountId: transactions.destinationAccountId,
      deletedAt: transactions.deletedAt,
    })
    .from(transactions)
    .where(
      and(
        sql`${transactions.deletedAt} IS NOT NULL`,
        or(
          eq(transactions.sourceAccountId, accountId),
          eq(transactions.destinationAccountId, accountId)
        )
      )
    );

  // For each deleted tx, compute the impact it WOULD have had (if completed)
  const matchedDeleted: string[] = [];
  for (const tx of deletedRows) {
    const txForBalance: TransactionForBalance = {
      type: tx.type,
      amount: tx.amount,
      status: tx.status,
      adjustmentDirection: tx.adjustmentDirection,
      sourceAccountId: tx.sourceAccountId,
      destinationAccountId: tx.destinationAccountId,
    };
    let impactOnAccount = 0;
    if (tx.type === 'transfer') {
      impactOnAccount = getTransferImpact(txForBalance, accountId);
    } else {
      impactOnAccount = getBalanceImpact(txForBalance);
    }
    // If the impact is exactly equal to the discrepancy (with sign),
    // this deleted transaction is a strong candidate for explaining the discrepancy.
    if (Math.abs(impactOnAccount - discrepancy) < MISMATCH_EPSILON && impactOnAccount !== 0) {
      matchedDeleted.push(tx.id);
    }
  }

  if (matchedDeleted.length > 0) {
    causes.push({
      code: 'deleted_tx_inconsistency',
      description: `พบรายการที่ถูกลบไปแล้ว ${matchedDeleted.length} รายการ — ยอดที่หายไปอาจเกิดจากการลบรายการที่เคยหัก/เพิ่มยอดไปแล้ว`,
      relatedTransactionIds: matchedDeleted,
    });
  }

  // 3. Adjustments on this account — possible adjustment inconsistency
  const adjustments = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        isNull(transactions.deletedAt),
        eq(transactions.type, 'adjustment'),
        eq(transactions.sourceAccountId, accountId)
      )
    );

  if (adjustments.length > 0) {
    causes.push({
      code: 'adjustment_inconsistency',
      description: `มีรายการปรับยอด ${adjustments.length} รายการ — ตรวจสอบทิศทาง (increase/decrease) ของการปรับยอดให้ถูกต้อง`,
      relatedTransactionIds: adjustments.map((a) => a.id),
    });
  }

  // 4. Always provide a "historical bug" hint if we couldn't explain fully
  if (causes.length === 0) {
    causes.push({
      code: 'historical_bug',
      description: 'ระบบตรวจไม่พบ transaction ที่ตรงกับยอดที่ผิด — อาจเกิดจากบั๊กของระบบก่อนหน้า (ก่อน Financial Integrity v1.3.0)',
    });
  } else if (absDiff > 100) {
    // For larger discrepancies, also flag historical bug as a possible contributor
    causes.push({
      code: 'historical_bug',
      description: 'ยอดที่ผิดมีมูลค่าสูง อาจมีสาเหตุจากบั๊กของระบบก่อนหน้าผสมอยู่ด้วย',
    });
  }

  return causes;
}

export const RECONCILE_EPSILON = MISMATCH_EPSILON;
