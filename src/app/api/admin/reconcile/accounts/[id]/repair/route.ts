import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { activityLogs, accounts } from '@/db/schema';
import {
  ForbiddenError,
  getRequestContext,
  handleApiError,
  isAdmin,
  ValidationError,
} from '@/lib/api-auth';
import {
  runReconciliation,
  RECONCILE_EPSILON,
} from '@/lib/reconciliation';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

interface RepairBody {
  /** Must be true. Admin has to opt-in explicitly. */
  confirm?: boolean;
  /**
   * Optional pre-flight expectedBalance to protect against races.
   * If provided and doesn't match the current expected, the repair is rejected.
   */
  expectedExpectedBalance?: number;
}

/**
 * POST /api/admin/reconcile/accounts/:id/repair
 *
 * Admin-only. Sets accounts.currentBalance to the expected balance
 * computed from the transaction history.
 *
 * Safety:
 *   - Requires { confirm: true } in the body.
 *   - Optional expectedExpectedBalance pre-flight guard.
 *   - Writes an activity_logs row (action='RECONCILE') with old/new/discrepancy.
 *   - Does NOT auto-run; the admin clicks "ซ่อมยอด" in the UI.
 *
 * Response:
 *   - { accountId, oldBalance, newBalance, discrepancy, repairedAt, logId }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { db, session } = await getRequestContext(request);
    if (!isAdmin(session)) {
      throw new ForbiddenError('ต้องเป็น admin เท่านั้น');
    }

    const { id: accountId } = await params;

    let body: RepairBody = {};
    try {
      body = (await request.json()) as RepairBody;
    } catch {
      // empty body is OK
    }

    if (body.confirm !== true) {
      throw new ValidationError({
        confirm: 'ต้องส่ง { confirm: true } เพื่อยืนยันการซ่อมยอด',
      });
    }

    // Load account
    const accountRow = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        currentBalance: accounts.currentBalance,
      })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)))
      .limit(1);

    if (!accountRow[0]) {
      return NextResponse.json({ error: 'ไม่พบบัญชี' }, { status: 404 });
    }

    // Recompute expected balance RIGHT NOW (always uses latest transactions)
    const report = await runReconciliation(db, { includeAll: true });
    const row = report.accounts.find((r) => r.accountId === accountId);
    if (!row) {
      return NextResponse.json(
        { error: 'ไม่สามารถคำนวณยอดคาดหวังได้' },
        { status: 500 }
      );
    }

    // Race-protection: if caller passed an expected value, it must match
    if (
      typeof body.expectedExpectedBalance === 'number' &&
      Math.abs(body.expectedExpectedBalance - row.expectedBalance) > RECONCILE_EPSILON
    ) {
      throw new ValidationError({
        expectedExpectedBalance:
          'ยอด expected ที่คาดไว้ไม่ตรงกับข้อมูลปัจจุบัน — กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง',
      });
    }

    const oldBalance = accountRow[0].currentBalance;
    const newBalance = row.expectedBalance;
    const discrepancy = row.discrepancy;

    // Already in sync — no-op, but still log nothing
    if (Math.abs(discrepancy) <= RECONCILE_EPSILON) {
      return NextResponse.json({
        accountId,
        oldBalance,
        newBalance,
        discrepancy: 0,
        repaired: false,
        reason: 'ยอดบัญชีตรงกันอยู่แล้ว ไม่ต้องซ่อม',
      });
    }

    const now = new Date();
    const logId = crypto.randomUUID();

    // Apply repair + write audit log atomically
    await db.batch([
      db
        .update(accounts)
        .set({ currentBalance: newBalance, updatedAt: now })
        .where(eq(accounts.id, accountId)),
      db.insert(activityLogs).values({
        id: logId,
        userId: session.user.id,
        action: 'RECONCILE',
        entity: 'account',
        entityId: accountId,
        oldValue: JSON.stringify({
          currentBalance: oldBalance,
          expectedBalance: newBalance,
          discrepancy,
        }),
        newValue: JSON.stringify({
          currentBalance: newBalance,
          expectedBalance: newBalance,
          discrepancy: 0,
        }),
        createdAt: now,
      }),
    ]);

    return NextResponse.json({
      accountId,
      accountName: accountRow[0].name,
      oldBalance,
      newBalance,
      discrepancy,
      repaired: true,
      repairedAt: now.toISOString(),
      logId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
