import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { accounts, transactions } from '@/db/schema';
import { getRequestContext, serverErrorResponse, unauthorizedResponse } from '@/lib/api-auth';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(request);
    const { id } = await params;
    const transaction = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
      .limit(1);
    if (!transaction[0]) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });

    const row = transaction[0];
    await db.batch([
      db.update(transactions).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(transactions.id, id)),
      ...rollbackStatements(db, row.type, row.amount, row.sourceAccountId, row.destinationAccountId),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return error instanceof Error && error.message === 'UNAUTHORIZED'
      ? unauthorizedResponse()
      : serverErrorResponse();
  }
}

function rollbackStatements(
  db: Awaited<ReturnType<typeof getRequestContext>>['db'],
  type: 'income' | 'expense' | 'transfer',
  amount: number,
  sourceAccountId: string | null,
  destinationAccountId: string | null
) {
  const statements = [];
  if ((type === 'expense' || type === 'transfer') && sourceAccountId) {
    statements.push(
      db.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} + ${amount}`, updatedAt: new Date() }).where(eq(accounts.id, sourceAccountId))
    );
  }
  if ((type === 'income' || type === 'transfer') && destinationAccountId) {
    statements.push(
      db.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} - ${amount}`, updatedAt: new Date() }).where(eq(accounts.id, destinationAccountId))
    );
  }
  return statements;
}