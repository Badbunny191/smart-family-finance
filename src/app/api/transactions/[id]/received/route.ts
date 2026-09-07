import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { transactions } from '@/db/schema';
import { getRequestContext, serverErrorResponse, unauthorizedResponse } from '@/lib/api-auth';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(request);
    const { id } = await params;
    const updated = await db
      .update(transactions)
      .set({ businessStatus: 'business_received', updatedAt: new Date() })
      .where(and(eq(transactions.id, id), eq(transactions.businessStatus, 'customer_paid'), isNull(transactions.deletedAt)))
      .returning();
    return updated[0]
      ? NextResponse.json(updated[0])
      : NextResponse.json({ error: 'รายการนี้ไม่อยู่ในสถานะลูกค้าโอนแล้ว' }, { status: 409 });
  } catch (error) {
    return error instanceof Error && error.message === 'UNAUTHORIZED' ? unauthorizedResponse() : serverErrorResponse();
  }
}