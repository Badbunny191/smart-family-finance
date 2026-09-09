import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { accounts, persons, properties } from '@/db/schema';
import { getRequestContext, handleApiError } from '@/lib/api-auth';
import { accountInputSchema, validationError } from '@/lib/validation';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(request);
    const { id } = await params;
    const parsed = accountInputSchema.partial().safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(validationError(parsed.error), { status: 400 });
    }
    if (parsed.data.personId || parsed.data.propertyId !== undefined) {
      const referenceError = await validateReferences(
        db,
        parsed.data.personId || (await getAccountPersonId(db, id)),
        parsed.data.propertyId
      );
      if (referenceError) {
        return NextResponse.json({ error: referenceError }, { status: 400 });
      }
    }

    const updated = await db
      .update(accounts)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(accounts.id, id), isNull(accounts.deletedAt)))
      .returning();
    return updated[0]
      ? NextResponse.json(updated[0])
      : NextResponse.json({ error: 'ไม่พบบัญชี' }, { status: 404 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(request);
    const { id } = await params;
    const deleted = await db
      .update(accounts)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(accounts.id, id), isNull(accounts.deletedAt)))
      .returning({ id: accounts.id });
    return deleted[0]
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: 'ไม่พบบัญชี' }, { status: 404 });
  } catch (error) {
    return handleApiError(error);
  }
}

async function getAccountPersonId(db: Awaited<ReturnType<typeof getRequestContext>>['db'], id: string) {
  const row = await db
    .select({ personId: accounts.personId })
    .from(accounts)
    .where(and(eq(accounts.id, id), isNull(accounts.deletedAt)))
    .limit(1);
  return row[0]?.personId || '';
}

async function validateReferences(
  db: Awaited<ReturnType<typeof getRequestContext>>['db'],
  personId: string,
  propertyId?: string | null
) {
  const person = await db
    .select({ id: persons.id })
    .from(persons)
    .where(and(eq(persons.id, personId), isNull(persons.deletedAt)))
    .limit(1);
  if (!person[0]) return 'ไม่พบบุคคลที่เลือก';

  if (propertyId) {
    const property = await db
      .select({ id: properties.id })
      .from(properties)
      .where(and(eq(properties.id, propertyId), isNull(properties.deletedAt)))
      .limit(1);
    if (!property[0]) return 'ไม่พบทรัพย์สินที่เลือก';
  }
  return null;
}