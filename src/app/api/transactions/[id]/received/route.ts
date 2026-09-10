import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { transactions } from '@/db/schema';
import { getRequestContext, handleApiError } from '@/lib/api-auth';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(request);
    const { id } = await params;
    
    // เปลี่ยนจาก customer_paid เป็น received
    const updated = await db
      .update(transactions)
      .set({ businessStatus: 'received', updatedAt: new Date() })
      .where(and(
        eq(transactions.id, id), 
        eq(transactions.businessStatus, 'pending'),
        isNull(transactions.deletedAt)
      ))
      .returning();
    
    return updated[0]
      ? NextResponse.json(updated[0])
      : NextResponse.json({ error: 'รายการนี้ไม่อยู่ในสถานะรอชำระ' }, { status: 409 });
  } catch (error) {
    return handleApiError(error);
  }
}
