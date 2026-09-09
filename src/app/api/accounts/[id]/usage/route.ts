import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { transactions } from '@/db/schema';
import { getRequestContext, handleApiError } from '@/lib/api-auth';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(request);
    const { id } = await params;

    // Count transactions where this account is either source or destination
    const transactionUsage = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(
        and(
          isNull(transactions.deletedAt),
          or(
            eq(transactions.sourceAccountId, id),
            eq(transactions.destinationAccountId, id)
          )
        )
      );

    return NextResponse.json({
      transactionCount: transactionUsage[0].count,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
