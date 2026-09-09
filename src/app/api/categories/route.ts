import { asc, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { categories } from '@/db/schema';
import { categoryInputSchema, validationError } from '@/lib/validation';
import { getRequestContext, handleApiError } from '@/lib/api-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { db } = await getRequestContext(request);
    const rows = await db.select().from(categories).where(isNull(categories.deletedAt)).orderBy(asc(categories.type), asc(categories.name));
    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db } = await getRequestContext(request);
    const parsed = categoryInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(validationError(parsed.error), { status: 400 });
    }

    const now = new Date();
    const category = { id: crypto.randomUUID(), ...parsed.data, createdAt: now, updatedAt: now };
    console.log('[POST /api/categories] Inserting:', JSON.stringify(category));
    try {
      await db.insert(categories).values(category);
    } catch (dbError) {
      console.error('[POST /api/categories] DB error:', dbError);
      throw dbError;
    }
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('[POST /api/categories] Final catch:', error);
    return handleApiError(error);
  }
}