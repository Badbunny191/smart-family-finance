import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { accounts } from '@/db/schema';
import {
  ForbiddenError,
  getRequestContext,
  handleApiError,
  isAdmin,
} from '@/lib/api-auth';
import {
  analyzePossibleCauses,
  runReconciliation,
  RECONCILE_EPSILON,
} from '@/lib/reconciliation';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/reconcile/accounts/:id/analysis
 *
 * Admin-only. Returns:
 *   - the row for this account (stored vs expected vs discrepancy)
 *   - a list of possible causes with evidence (heuristic, never concluded)
 *   - a preview of what the repair would set currentBalance to
 *
 * Does NOT mutate anything.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { db, session } = await getRequestContext(request);
    if (!isAdmin(session)) {
      throw new ForbiddenError('ต้องเป็น admin เท่านั้น');
    }

    const { id: accountId } = await params;

    const accountRow = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        accountAlias: accounts.accountAlias,
        bankName: accounts.bankName,
        accountNumber: accounts.accountNumber,
        accountType: accounts.accountType,
        openingBalance: accounts.openingBalance,
        currentBalance: accounts.currentBalance,
      })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)))
      .limit(1);

    if (!accountRow[0]) {
      return NextResponse.json({ error: 'ไม่พบบัญชี' }, { status: 404 });
    }

    // Pull the row from the existing reconciliation report to keep math consistent
    const report = await runReconciliation(db, { includeAll: true });
    const row = report.accounts.find((r) => r.accountId === accountId);

    if (!row) {
      return NextResponse.json({ error: 'ไม่พบบัญชีในรายงาน' }, { status: 404 });
    }

    const possibleCauses = await analyzePossibleCauses(
      db,
      accountId,
      row.discrepancy
    );

    const needsRepair = Math.abs(row.discrepancy) > RECONCILE_EPSILON;

    return NextResponse.json({
      account: row,
      possibleCauses,
      needsRepair,
      repairPreview: needsRepair
        ? {
            oldBalance: row.storedBalance,
            newBalance: row.expectedBalance,
            discrepancy: row.discrepancy,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
