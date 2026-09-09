import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { accounts } from '@/db/schema';
import { getRequestContext, handleApiError } from '@/lib/api-auth';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(request);
    const { id } = await params;

    // Count linked accounts (propertyId references)
    const accountUsage = await db
      .select({ count: sql<number>`count(*)` })
      .from(accounts)
      .where(and(eq(accounts.propertyId, id), isNull(accounts.deletedAt)));

    return NextResponse.json({
      accountCount: accountUsage[0].count,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
