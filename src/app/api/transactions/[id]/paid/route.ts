import { and, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { accounts, transactions } from '@/db/schema';
import { getRequestContext, handleApiError } from '@/lib/api-auth';
import { getBalanceImpact, getTransferImpact } from '@/lib/transaction-balance';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(request);
    const { id } = await params;

    // Parse optional settlement date from request body
    let settlementDate: Date | null = null;
    try {
      const body = await request.json() as { settlementDate?: string };
      if (body.settlementDate) {
        const parsed = new Date(body.settlementDate);
        if (!isNaN(parsed.getTime())) {
          settlementDate = parsed;
        }
      }
    } catch {
      // Empty body is fine — use current time as fallback
    }

    // Phase B v3.0 — Future-date guard (backend, defense in depth)
    // Reject settlementDate in the future. Compare against Date.now() UTC.
    // Note: this is a strict server-side check. Frontend dialog also blocks
    // future dates (see SettlementDateDialog), but a malicious or buggy client
    // could bypass that — backend is the final authority.
    if (settlementDate && settlementDate.getTime() > Date.now()) {
      return NextResponse.json(
        {
          error: 'ไม่สามารถบันทึกวันที่/เวลาในอนาคตได้',
          code: 'FUTURE_SETTLEMENT_DATE',
        },
        { status: 400 }
      );
    }

    // ดึงข้อมูล transaction ก่อน
    const [tx] = await db
      .select()
      .from(transactions)
      .where(and(
        eq(transactions.id, id),
        eq(transactions.businessStatus, 'pending')
      ));

    if (!tx) {
      return NextResponse.json({ error: 'รายการนี้ไม่อยู่ในสถานะรอจ่าย' }, { status: 409 });
    }

    // อัพเดท businessStatus, status ให้สอดคล้องกัน
    // businessStatus = received หมายถึง ได้รับ/จ่ายเงินแล้ว → status ต้องเป็น completed
    // ห้ามแก้ date เพราะ date คือวันที่ทำธุรกรรมจริง (original transaction date)
    // ใช้ paidDate เพื่อบันทึกวันที่ตอกย้ำว่าจ่ายเงินแล้ว
    const now = new Date();
    const paidDate = settlementDate ?? now;
    const [updated] = await db
      .update(transactions)
      .set({
        businessStatus: 'received',
        status: 'completed',
        paidDate: paidDate,
        updatedAt: now
      })
      .where(and(
        eq(transactions.id, id),
        eq(transactions.businessStatus, 'pending')
      ))
      .returning();

    // อัพเดทยอดบัญชี
    // ใช้ helper เพื่อคำนวณ impact (forward) บนแต่ละ account
    const completedTx = {
      type: tx.type,
      amount: tx.amount,
      status: 'completed' as const,
      adjustmentDirection: tx.adjustmentDirection,
      sourceAccountId: tx.sourceAccountId,
      destinationAccountId: tx.destinationAccountId,
    };

    // transfer: per-account impact via getTransferImpact
    if (tx.type === 'transfer') {
      if (tx.sourceAccountId) {
        const impact = getTransferImpact(completedTx, tx.sourceAccountId);
        if (impact !== 0) {
          await db
            .update(accounts)
            .set({ currentBalance: sql`${accounts.currentBalance} + ${impact}`, updatedAt: new Date() })
            .where(eq(accounts.id, tx.sourceAccountId));
        }
      }
      if (tx.destinationAccountId) {
        const impact = getTransferImpact(completedTx, tx.destinationAccountId);
        if (impact !== 0) {
          await db
            .update(accounts)
            .set({ currentBalance: sql`${accounts.currentBalance} + ${impact}`, updatedAt: new Date() })
            .where(eq(accounts.id, tx.destinationAccountId));
        }
      }
    } else {
      // income / expense / adjustment: scalar impact via getBalanceImpact
      const targetAccountId = tx.type === 'income' ? tx.destinationAccountId : tx.sourceAccountId;
      if (targetAccountId) {
        const impact = getBalanceImpact(completedTx);
        if (impact !== 0) {
          await db
            .update(accounts)
            .set({ currentBalance: sql`${accounts.currentBalance} + ${impact}`, updatedAt: new Date() })
            .where(eq(accounts.id, targetAccountId));
        }
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
