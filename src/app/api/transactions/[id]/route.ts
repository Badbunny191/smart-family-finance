import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { accounts, categories, transactions } from '@/db/schema';
import { getRequestContext, handleApiError } from '@/lib/api-auth';
import { transactionMetadataSchema, validationError } from '@/lib/validation';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(request);
    const { id } = await params;
    const parsed = transactionMetadataSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 });

    const existing = await db.select({ type: transactions.type }).from(transactions).where(and(eq(transactions.id, id), isNull(transactions.deletedAt))).limit(1);
    if (!existing[0]) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });
    if (parsed.data.categoryId) {
      const category = await db.select({ type: categories.type }).from(categories).where(and(eq(categories.id, parsed.data.categoryId), isNull(categories.deletedAt))).limit(1);
      if (!category[0] || category[0].type !== existing[0].type) return NextResponse.json({ error: 'หมวดหมู่ไม่ตรงกับประเภทรายการ' }, { status: 400 });
    }

    const updated = await db.update(transactions).set({ ...parsed.data, updatedAt: new Date() }).where(eq(transactions.id, id)).returning();
    return NextResponse.json(updated[0]);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { db, session } = await getRequestContext(request);
    const { id } = await params;
    const transaction = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
      .limit(1);
    if (!transaction[0]) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });

    const row = transaction[0];

    // Permission check for deleting adjustment
    const userEmail = (session.user as { email?: string }).email;
    if (row.type === 'adjustment' && userEmail !== 'thanet_30@hotmail.com') {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์ลบรายการปรับยอด' }, { status: 403 });
    }

    await db.batch([
      db.update(transactions).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(transactions.id, id)),
      ...rollbackStatements(db, row.type, row.amount, row.adjustmentDirection, row.sourceAccountId, row.destinationAccountId),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

function rollbackStatements(
  db: Awaited<ReturnType<typeof getRequestContext>>['db'],
  type: 'income' | 'expense' | 'transfer' | 'adjustment',
  amount: number,
  adjustmentDirection: 'increase' | 'decrease' | null,
  sourceAccountId: string | null,
  destinationAccountId: string | null
) {
  const statements = [];

  // expense = reverse: add back to source
  if (type === 'expense' && sourceAccountId) {
    statements.push(
      db.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} + ${amount}`, updatedAt: new Date() }).where(eq(accounts.id, sourceAccountId))
    );
  }

  // transfer = reverse BOTH accounts:
  // - subtract from destination (what was added)
  // - add back to source (what was subtracted)
  if (type === 'transfer') {
    if (sourceAccountId) {
      statements.push(
        db.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} + ${amount}`, updatedAt: new Date() }).where(eq(accounts.id, sourceAccountId))
      );
    }
    if (destinationAccountId) {
      statements.push(
        db.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} - ${amount}`, updatedAt: new Date() }).where(eq(accounts.id, destinationAccountId))
      );
    }
  }

  // adjustment = reverse based on explicit direction
  // increase: balance was increased, so subtract back
  // decrease: balance was decreased, so add back
  if (type === 'adjustment' && sourceAccountId) {
    if (adjustmentDirection === 'increase') {
      // Was added (+), so subtract back (-)
      statements.push(
        db.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} - ${amount}`, updatedAt: new Date() }).where(eq(accounts.id, sourceAccountId))
      );
    } else {
      // 'decrease' or default: was subtracted (-), so add back (+)
      statements.push(
        db.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} + ${amount}`, updatedAt: new Date() }).where(eq(accounts.id, sourceAccountId))
      );
    }
  }

  // income = reverse: subtract from destination
  if (type === 'income' && destinationAccountId) {
    statements.push(
      db.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} - ${amount}`, updatedAt: new Date() }).where(eq(accounts.id, destinationAccountId))
    );
  }

  return statements;
}