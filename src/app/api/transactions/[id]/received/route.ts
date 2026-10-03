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

    // ดึงข้อมูล transaction ก่อน
    const [tx] = await db
      .select()
      .from(transactions)
      .where(and(
        eq(transactions.id, id),
        eq(transactions.businessStatus, 'pending')
      ));

    if (!tx) {
      return NextResponse.json({ error: 'รายการนี้ไม่อยู่ในสถานะรอรับเงิน' }, { status: 409 });
    }

    // อัพเดท businessStatus, status และ date ให้สอดคล้องกัน
    // businessStatus = received หมายถึง ได้รับ/จ่ายเงินแล้ว → status ต้องเป็น completed
    // date = วันที่จ่ายจริง (ปัจจุบัน) แทนวันที่นัดหมาย
    // Use UTC midnight so Bangkok date = today's calendar date (not UTC-1 midnight).
    // e.g. Bangkok 2026-09-30 00:30 → new Date() = UTC 2026-09-29 17:30 → off-by-one.
    // Fix: start from UTC midnight of today, then add Bangkok offset to get Bangkok 00:00.
    const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
    const now = new Date();
    const bangkokNow = new Date(now.getTime() + BANGKOK_OFFSET_MS);
    bangkokNow.setHours(0, 0, 0, 0);
    const [updated] = await db
      .update(transactions)
      .set({
        businessStatus: 'received',
        status: 'completed',
        date: bangkokNow,
        updatedAt: new Date()
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
