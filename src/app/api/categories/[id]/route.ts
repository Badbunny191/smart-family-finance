import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { categories } from '@/db/schema';
import { categoryInputSchema, validationError } from '@/lib/validation';
import { getRequestContext, serverErrorResponse, unauthorizedResponse } from '@/lib/api-auth';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(_request);
    const { id } = await params;
    const rows = await db.select().from(categories).where(and(eq(categories.id, id), isNull(categories.deletedAt))).limit(1);
    return rows[0] ? NextResponse.json(rows[0]) : NextResponse.json({ error: 'ไม่พบหมวดหมู่' }, { status: 404 });
  } catch (error) {
    return error instanceof Error && error.message === 'UNAUTHORIZED' ? unauthorizedResponse() : serverErrorResponse();
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(request);
    const { id } = await params;
    const parsed = categoryInputSchema.partial().safeParse(await request.json());
    if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 });

    const updated = await db
      .update(categories)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
      .returning();

    return updated[0] ? NextResponse.json(updated[0]) : NextResponse.json({ error: 'ไม่พบหมวดหมู่' }, { status: 404 });
  } catch (error) {
    return error instanceof Error && error.message === 'UNAUTHORIZED' ? unauthorizedResponse() : serverErrorResponse();
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(request);
    const { id } = await params;
    const deleted = await db
      .update(categories)
      .set({ deletedAt: new Date(), updatedAt: new Date(), isActive: false })
      .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
      .returning({ id: categories.id });

    return deleted[0] ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'ไม่พบหมวดหมู่' }, { status: 404 });
  } catch (error) {
    return error instanceof Error && error.message === 'UNAUTHORIZED' ? unauthorizedResponse() : serverErrorResponse();
  }
}
