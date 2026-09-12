import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { accounts, transactions } from '@/db/schema';
import { getRequestContext, handleApiError } from '@/lib/api-auth';

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
        eq(transactions.businessStatus, 'pending'),
        isNull(transactions.deletedAt)
      ));
    
    if (!tx) {
      return NextResponse.json({ error: 'รายการนี้ไม่อยู่ในสถานะรอชำระ' }, { status: 409 });
    }
    
    // อัพเดท businessStatus และ status ให้สอดคล้องกัน
    // businessStatus = received หมายถึง ได้รับเงินแล้ว → status ต้องเป็น completed
    const [updated] = await db
      .update(transactions)
      .set({ 
        businessStatus: 'received', 
        status: 'completed',
        updatedAt: new Date() 
      })
      .where(and(
        eq(transactions.id, id),
        eq(transactions.businessStatus, 'pending'),
        isNull(transactions.deletedAt)
      ))
      .returning();
    
    // อัพเดทยอดบัญชี
    // รายรับ หรือ การโอน (เข้าบัญชีปลายทาง)
    if ((tx.type === 'income' || tx.type === 'transfer') && tx.destinationAccountId) {
      await db
        .update(accounts)
        .set({ currentBalance: sql`${accounts.currentBalance} + ${tx.amount}`, updatedAt: new Date() })
        .where(eq(accounts.id, tx.destinationAccountId));
    }
    
    // รายจ่าย (หักจากบัญชีต้นทาง)
    if (tx.type === 'expense' && tx.sourceAccountId) {
      await db
        .update(accounts)
        .set({ currentBalance: sql`${accounts.currentBalance} - ${tx.amount}`, updatedAt: new Date() })
        .where(eq(accounts.id, tx.sourceAccountId));
    }
    
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
