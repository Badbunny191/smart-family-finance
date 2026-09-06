import { and, desc, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { persons, properties } from '@/db/schema';
import { getRequestContext, serverErrorResponse, unauthorizedResponse } from '@/lib/api-auth';
import { propertyInputSchema, validationError } from '@/lib/validation';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { db } = await getRequestContext(request);
    const rows = await db
      .select({
        id: properties.id,
        name: properties.name,
        ownerPersonId: properties.ownerPersonId,
        ownerName: persons.name,
        status: properties.status,
        createdAt: properties.createdAt,
        updatedAt: properties.updatedAt,
      })
      .from(properties)
      .innerJoin(persons, eq(properties.ownerPersonId, persons.id))
      .where(isNull(properties.deletedAt))
      .orderBy(desc(properties.createdAt));
    return NextResponse.json(rows);
  } catch (error) {
    return error instanceof Error && error.message === 'UNAUTHORIZED'
      ? unauthorizedResponse()
      : serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db } = await getRequestContext(request);
    const parsed = propertyInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(validationError(parsed.error), { status: 400 });
    }

    const owner = await db
      .select({ id: persons.id })
      .from(persons)
      .where(and(andActivePerson(persons.id, parsed.data.ownerPersonId), isNull(persons.deletedAt)))
      .limit(1);
    if (!owner[0]) {
      return NextResponse.json({ error: 'ไม่พบบุคคลเจ้าของที่เลือก' }, { status: 400 });
    }

    const now = new Date();
    const property = { id: crypto.randomUUID(), ...parsed.data, createdAt: now, updatedAt: now };
    await db.insert(properties).values(property);
    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    return error instanceof Error && error.message === 'UNAUTHORIZED'
      ? unauthorizedResponse()
      : serverErrorResponse();
  }
}

function andActivePerson(column: typeof persons.id, value: string) {
  return eq(column, value);
}