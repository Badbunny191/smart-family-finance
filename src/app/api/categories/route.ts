import { asc, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { categories } from '@/db/schema';
import { getRequestContext, serverErrorResponse, unauthorizedResponse } from '@/lib/api-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { db } = await getRequestContext(request);
    const rows = await db.select().from(categories).where(isNull(categories.deletedAt)).orderBy(asc(categories.type), asc(categories.name));
    return NextResponse.json(rows);
  } catch (error) {
    return error instanceof Error && error.message === 'UNAUTHORIZED' ? unauthorizedResponse() : serverErrorResponse();
  }
}