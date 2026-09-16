import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { accounts, transactions } from '@/db/schema';
import { getBalanceImpact, getTransferImpact, type TransactionForBalance } from '@/lib/transaction-balance';
import { ForbiddenError, getRequestContext, handleApiError, isAdmin } from '@/lib/api-auth';

export const runtime = 'nodejs';

/**
 * GET /api/admin/reconcile
 * Admin-only reconciliation report
 *
 * Compares accounts.currentBalance with the expected value calculated from
 * the transaction history using the same logic as getBalanceImpact() and
 * getTransferImpact().
 */
export async function GET(request: NextRequest) {
  try {
    const { db, session } = await getRequestContext(request);

    if (!isAdmin(session)) {
      throw new ForbiddenError('ต้องเป็น admin เท่านั้น');
    }

    // Load all non-deleted accounts
    const allAccounts = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        openingBalance: accounts.openingBalance,
        currentBalance: accounts.currentBalance,
      })
      .from(accounts)
      .where(isNull(accounts.deletedAt));

    // Load all non-deleted completed transactions
    // We need all fields that affect balance (type, amount, status, source, destination, direction)
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
          or(
            eq(transactions.status, 'completed'),
            eq(transactions.status, 'pending')
          )
        )
      );

    // Calculate expected balance per account using the same logic as the runtime code
    // (getBalanceImpact + getTransferImpact). No duplicated formulas.
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
        // Transfers are handled per-account using getTransferImpact
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
        // income / expense / adjustment — single scalar via getBalanceImpact
        const impact = getBalanceImpact(txForBalance);
        if (impact !== 0) {
          // Determine which account was affected
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

    // Build report
    const report = allAccounts.map((acc) => {
      const expected = expectedByAccount.get(acc.id) ?? acc.openingBalance;
      const discrepancy = acc.currentBalance - expected;
      return {
        accountId: acc.id,
        accountName: acc.name,
        openingBalance: acc.openingBalance,
        storedBalance: acc.currentBalance,
        expectedBalance: expected,
        discrepancy,
      };
    });

    const mismatchCount = report.filter((r) => Math.abs(r.discrepancy) > 0.01).length;

    return NextResponse.json({
      accounts: report,
      hasDiscrepancy: mismatchCount > 0,
      totalAccounts: report.length,
      mismatchCount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
