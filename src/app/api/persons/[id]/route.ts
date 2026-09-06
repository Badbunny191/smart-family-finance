import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { persons } from '@/db/schema';
import { getRequestContext, serverErrorResponse, unauthorizedResponse } from '@/lib/api-auth';
import { personInputSchema, validationError } from '@/lib/validation';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(request);
    const { id } = await params;
    const parsed = personInputSchema.partial().safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(validationError(parsed.error), { status: 400 });
    }

    const updated = await db
      .update(persons)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(persons.id, id), isNull(persons.deletedAt)))
      .returning();
    return updated[0]
      ? NextResponse.json(updated[0])
      : NextResponse.json({ error: 'ไม่พบบุคคล' }, { status: 404 });
  } catch (error) {
    return error instanceof Error && error.message === 'UNAUTHORIZED'
      ? unauthorizedResponse()
      : serverErrorResponse();
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(request);
    const { id } = await params;
    const deleted = await db
      .update(persons)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(persons.id, id), isNull(persons.deletedAt)))
      .returning({ id: persons.id });
    return deleted[0]
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: 'ไม่พบบุคคล' }, { status: 404 });
  } catch (error) {
    return error instanceof Error && error.message === 'UNAUTHORIZED'
      ? unauthorizedResponse()
      : serverErrorResponse();
  }
}