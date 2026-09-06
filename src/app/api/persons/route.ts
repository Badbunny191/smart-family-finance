import { desc, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { persons } from '@/db/schema';
import { getRequestContext, serverErrorResponse, unauthorizedResponse } from '@/lib/api-auth';
import { personInputSchema, validationError } from '@/lib/validation';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { db } = await getRequestContext(request);
    const rows = await db.select().from(persons).where(isNull(persons.deletedAt)).orderBy(desc(persons.createdAt));
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
    const parsed = personInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(validationError(parsed.error), { status: 400 });
    }

    const now = new Date();
    const person = {
      id: crypto.randomUUID(),
      ...parsed.data,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(persons).values(person);
    return NextResponse.json(person, { status: 201 });
  } catch (error) {
    return error instanceof Error && error.message === 'UNAUTHORIZED'
      ? unauthorizedResponse()
      : serverErrorResponse();
  }
}