import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { accounts, categories, transactions } from '@/db/schema';
import { getRequestContext, handleApiError, isAdmin } from '@/lib/api-auth';
import { transactionMetadataSchema, validationError } from '@/lib/validation';
import { getReverseImpact, getTransferReverseImpact, getBalanceImpact, getTransferImpact } from '@/lib/transaction-balance';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { db, session } = await getRequestContext(request);
    const { id } = await params;
    const parsed = transactionMetadataSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 });

    // 1. Fetch FULL existing transaction (need all fields for balance reconciliation)
    const existingRows = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
      .limit(1);

    if (!existingRows[0]) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });

    const oldTx = existingRows[0];

    // Only admin can modify adjustment transactions
    if (oldTx.type === 'adjustment' && !isAdmin(session)) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์แก้ไขรายการปรับยอด' }, { status: 403 });
    }

    if (parsed.data.categoryId) {
      const category = await db.select({ type: categories.type }).from(categories).where(and(eq(categories.id, parsed.data.categoryId), isNull(categories.deletedAt))).limit(1);
      if (!category[0] || category[0].type !== oldTx.type) return NextResponse.json({ error: 'หมวดหมู่ไม่ตรงกับประเภทรายการ' }, { status: 400 });
    }

    // 2. Compute the new state (what status will be after update)
    // businessStatus is the source of truth: pending → status pending, received → status completed
    // If businessStatus is not provided in PATCH, no status change → no reconciliation needed
    const businessStatusChanged = parsed.data.businessStatus !== undefined;

    let newStatus = oldTx.status;
    if (businessStatusChanged) {
      const newBusinessStatus = parsed.data.businessStatus;
      newStatus = newBusinessStatus === 'pending' ? 'pending' : 'completed';
    }

    // 3. Build newTx for impact calculation
    const newTx = {
      type: oldTx.type,
      amount: oldTx.amount,
      status: newStatus,
      adjustmentDirection: oldTx.adjustmentDirection,
      sourceAccountId: oldTx.sourceAccountId,
      destinationAccountId: oldTx.destinationAccountId,
    };

    // 4. Compute old/new impact and delta
    // For income/expense/adjustment: scalar impact on a single account
    // For transfer: must compute delta per account (source + destination)
    const statements: any[] = [];

    if (businessStatusChanged) {
      if (oldTx.type === 'transfer') {
        // Transfer: compute raw impact (forward, not reverse) for old and new
        const oldImpactSource = getTransferImpact(oldTx as any, oldTx.sourceAccountId);
        const oldImpactDest = getTransferImpact(oldTx as any, oldTx.destinationAccountId);
        const newImpactSource = getTransferImpact(newTx as any, oldTx.sourceAccountId);
        const newImpactDest = getTransferImpact(newTx as any, oldTx.destinationAccountId);

        // delta = newImpact - oldImpact
        const sourceDelta = newImpactSource - oldImpactSource;
        const destDelta = newImpactDest - oldImpactDest;

        if (oldTx.sourceAccountId && sourceDelta !== 0) {
          statements.push(
            db.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} + ${sourceDelta}`, updatedAt: new Date() }).where(eq(accounts.id, oldTx.sourceAccountId))
          );
        }
        if (oldTx.destinationAccountId && destDelta !== 0) {
          statements.push(
            db.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} + ${destDelta}`, updatedAt: new Date() }).where(eq(accounts.id, oldTx.destinationAccountId))
          );
        }
      } else {
        // income / expense / adjustment: scalar impact
        const oldImpact = getBalanceImpact(oldTx as any);
        const newImpact = getBalanceImpact(newTx as any);
        const delta = newImpact - oldImpact;

        // Determine which account to update
        const targetAccountId = oldTx.type === 'income'
          ? oldTx.destinationAccountId
          : oldTx.sourceAccountId; // expense / adjustment

        if (targetAccountId && delta !== 0) {
          statements.push(
            db.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} + ${delta}`, updatedAt: new Date() }).where(eq(accounts.id, targetAccountId))
          );
        }
      }
    }

    // 5. Apply update + balance reconciliation atomically
    const updated = await db.batch([
      db.update(transactions).set({
        ...parsed.data,
        // Only sync status if businessStatus was actually changed
        ...(businessStatusChanged ? { status: newStatus } : {}),
        updatedAt: new Date(),
      }).where(eq(transactions.id, id)).returning(),
      ...statements,
    ]);

    const updatedRow = (updated[0] as any[])[0];
    return NextResponse.json(updatedRow);
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

    // Only admin can delete adjustment transactions
    if (row.type === 'adjustment' && !isAdmin(session)) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์ลบรายการปรับยอด' }, { status: 403 });
    }

    await db.batch([
      db.update(transactions).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(transactions.id, id)),
      ...rollbackStatements(
        db,
        row.type,
        row.amount,
        row.status,
        row.adjustmentDirection,
        row.sourceAccountId,
        row.destinationAccountId,
      ),
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
  status: 'pending' | 'completed' | 'cancelled',
  adjustmentDirection: 'increase' | 'decrease' | null,
  sourceAccountId: string | null,
  destinationAccountId: string | null
) {
  const statements = [];

  // Helper object for the impact calculation
  const txForImpact = {
    type,
    amount,
    status,
    adjustmentDirection,
    sourceAccountId,
    destinationAccountId,
  };

  // expense = reverse: add back to source (only if completed/has-impacted balance)
  if (type === 'expense' && sourceAccountId) {
    const reverse = getReverseImpact(txForImpact, sourceAccountId);
    if (reverse !== 0) {
      statements.push(
        db.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} + ${reverse}`, updatedAt: new Date() }).where(eq(accounts.id, sourceAccountId))
      );
    }
  }

  // transfer = reverse BOTH accounts using getTransferReverseImpact
  if (type === 'transfer') {
    if (sourceAccountId) {
      const reverse = getTransferReverseImpact(txForImpact, sourceAccountId);
      if (reverse !== 0) {
        statements.push(
          db.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} + ${reverse}`, updatedAt: new Date() }).where(eq(accounts.id, sourceAccountId))
        );
      }
    }
    if (destinationAccountId) {
      const reverse = getTransferReverseImpact(txForImpact, destinationAccountId);
      if (reverse !== 0) {
        statements.push(
          db.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} + ${reverse}`, updatedAt: new Date() }).where(eq(accounts.id, destinationAccountId))
        );
      }
    }
  }

  // adjustment = reverse based on explicit direction using getReverseImpact
  if (type === 'adjustment' && sourceAccountId) {
    const reverse = getReverseImpact(txForImpact, sourceAccountId);
    if (reverse !== 0) {
      statements.push(
        db.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} + ${reverse}`, updatedAt: new Date() }).where(eq(accounts.id, sourceAccountId))
      );
    }
  }

  // income = reverse: subtract from destination (only if completed/has-impacted balance)
  // Uses getReverseImpact: income + completed => -amount, income + pending => 0
  if (type === 'income' && destinationAccountId) {
    const reverse = getReverseImpact(txForImpact, destinationAccountId);
    if (reverse !== 0) {
      statements.push(
        db.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} + ${reverse}`, updatedAt: new Date() }).where(eq(accounts.id, destinationAccountId))
      );
    }
  }

  return statements;
}