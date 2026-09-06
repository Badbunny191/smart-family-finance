import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { persons, properties } from '@/db/schema';
import { getRequestContext, serverErrorResponse, unauthorizedResponse } from '@/lib/api-auth';
import { propertyInputSchema, validationError } from '@/lib/validation';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(request);
    const { id } = await params;
    const parsed = propertyInputSchema.partial().safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(validationError(parsed.error), { status: 400 });
    }
    if (parsed.data.ownerPersonId) {
      const owner = await db
        .select({ id: persons.id })
        .from(persons)
        .where(and(eq(persons.id, parsed.data.ownerPersonId), isNull(persons.deletedAt)))
        .limit(1);
      if (!owner[0]) {
        return NextResponse.json({ error: 'ไม่พบบุคคลเจ้าของที่เลือก' }, { status: 400 });
      }
    }

    const updated = await db
      .update(properties)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(properties.id, id), isNull(properties.deletedAt)))
      .returning();
    return updated[0]
      ? NextResponse.json(updated[0])
      : NextResponse.json({ error: 'ไม่พบทรัพย์สิน' }, { status: 404 });
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
      .update(properties)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(properties.id, id), isNull(properties.deletedAt)))
      .returning({ id: properties.id });
    return deleted[0]
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: 'ไม่พบทรัพย์สิน' }, { status: 404 });
  } catch (error) {
    return error instanceof Error && error.message === 'UNAUTHORIZED'
      ? unauthorizedResponse()
      : serverErrorResponse();
  }
}