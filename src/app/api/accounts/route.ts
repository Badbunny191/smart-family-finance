import { and, desc, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { accounts, persons, properties } from '@/db/schema';
import { getRequestContext, serverErrorResponse, unauthorizedResponse } from '@/lib/api-auth';
import { accountInputSchema, validationError } from '@/lib/validation';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { db } = await getRequestContext(request);
    const rows = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        accountAlias: accounts.accountAlias,
        bankName: accounts.bankName,
        accountNumber: accounts.accountNumber,
        personId: accounts.personId,
        personName: persons.name,
        propertyId: accounts.propertyId,
        propertyName: properties.name,
        accountType: accounts.accountType,
        openingBalance: accounts.openingBalance,
        currentBalance: accounts.currentBalance,
        createdAt: accounts.createdAt,
        updatedAt: accounts.updatedAt,
      })
      .from(accounts)
      .innerJoin(persons, eq(accounts.personId, persons.id))
      .leftJoin(properties, eq(accounts.propertyId, properties.id))
      .where(isNull(accounts.deletedAt))
      .orderBy(desc(accounts.createdAt));
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
    const parsed = accountInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(validationError(parsed.error), { status: 400 });
    }
    const referenceError = await validateReferences(db, parsed.data.personId, parsed.data.propertyId);
    if (referenceError) {
      return NextResponse.json({ error: referenceError }, { status: 400 });
    }

    const now = new Date();
    const account = { id: crypto.randomUUID(), ...parsed.data, createdAt: now, updatedAt: now };
    await db.insert(accounts).values(account);
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return error instanceof Error && error.message === 'UNAUTHORIZED'
      ? unauthorizedResponse()
      : serverErrorResponse();
  }
}

async function validateReferences(
  db: Awaited<ReturnType<typeof getRequestContext>>['db'],
  personId: string,
  propertyId?: string | null
) {
  const person = await db
    .select({ id: persons.id })
    .from(persons)
    .where(andActive(persons.id, personId))
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

function andActive(column: typeof persons.id, value: string) {
  return eq(column, value);
}