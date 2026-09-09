import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { transactions } from '@/db/schema';
import { getRequestContext, handleApiError } from '@/lib/api-auth';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(request);
    const { id } = await params;
    
    const usage = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(and(eq(transactions.categoryId, id), isNull(transactions.deletedAt)));
    
    return NextResponse.json({ count: usage[0].count });
  } catch (error) {
    return handleApiError(error);
  }
}
