import { NextRequest, NextResponse } from 'next/server';
import { and, asc, desc, eq, isNull, or } from 'drizzle-orm';
import { accounts, transactions } from '@/db/schema';
import {
  ForbiddenError,
  getRequestContext,
  handleApiError,
  isAdmin,
} from '@/lib/api-auth';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/reconcile/accounts/:id/transactions
 *
 * Admin-only. Returns the full transaction list that participates in
 * this account's expected balance, plus any soft-deleted transactions
 * that touched this account (for forensics).
 *
 * Note: Includes both `completed` and `pending` so an admin can verify
 * which transactions actually moved money vs. which were never applied.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { db, session } = await getRequestContext(request);
    if (!isAdmin(session)) {
      throw new ForbiddenError('ต้องเป็น admin เท่านั้น');
    }

    const { id: accountId } = await params;

    const accountRow = await db
      .select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)))
      .limit(1);

    if (!accountRow[0]) {
      return NextResponse.json({ error: 'ไม่พบบัญชี' }, { status: 404 });
    }

    const rows = await db
      .select({
        id: transactions.id,
        type: transactions.type,
        amount: transactions.amount,
        date: transactions.date,
        title: transactions.title,
        status: transactions.status,
        businessStatus: transactions.businessStatus,
        sourceAccountId: transactions.sourceAccountId,
        destinationAccountId: transactions.destinationAccountId,
        adjustmentDirection: transactions.adjustmentDirection,
        note: transactions.note,
        createdAt: transactions.createdAt,
        deletedAt: transactions.deletedAt,
      })
      .from(transactions)
      .where(
        or(
          eq(transactions.sourceAccountId, accountId),
          eq(transactions.destinationAccountId, accountId)
        )
      )
      .orderBy(asc(transactions.date), desc(transactions.createdAt));

    return NextResponse.json({
      accountId,
      accountName: accountRow[0].name,
      transactions: rows,
      total: rows.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
