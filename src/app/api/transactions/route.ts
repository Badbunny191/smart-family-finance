import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { accounts, persons, properties, transactions } from '@/db/schema';
import { getRequestContext, serverErrorResponse, unauthorizedResponse } from '@/lib/api-auth';
import { transactionInputSchema, validationError } from '@/lib/validation';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { db } = await getRequestContext(request);
    const rows = await db
      .select()
      .from(transactions)
      .where(isNull(transactions.deletedAt))
      .orderBy(desc(transactions.date), desc(transactions.createdAt));
    return NextResponse.json(rows);
  } catch (error) {
    return error instanceof Error && error.message === 'UNAUTHORIZED'
      ? unauthorizedResponse()
      : serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db, session } = await getRequestContext(request);
    const parsed = transactionInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(validationError(parsed.error), { status: 400 });
    }

    const input = parsed.data;
    const personIds = [input.ownerPersonId, input.payerPersonId];
    const people = await db
      .select({ id: persons.id })
      .from(persons)
      .where(and(inArray(persons.id, personIds), isNull(persons.deletedAt)));
    if (people.length !== new Set(personIds).size) {
      return NextResponse.json({ error: 'ไม่พบบุคคลที่เลือก' }, { status: 400 });
    }

    if (input.propertyId) {
      const property = await db
        .select({ id: properties.id })
        .from(properties)
        .where(and(eq(properties.id, input.propertyId), isNull(properties.deletedAt)))
        .limit(1);
      if (!property[0]) return NextResponse.json({ error: 'ไม่พบทรัพย์สินที่เลือก' }, { status: 400 });
    }

    const accountIds = [input.sourceAccountId, input.destinationAccountId].filter(
      (id): id is string => Boolean(id)
    );
    const accountRows = await db
      .select()
      .from(accounts)
      .where(and(inArray(accounts.id, accountIds), isNull(accounts.deletedAt)));
    if (accountRows.length !== new Set(accountIds).size) {
      return NextResponse.json({ error: 'ไม่พบบัญชีที่เลือก' }, { status: 400 });
    }

    const source = input.sourceAccountId ? accountRows.find((account) => account.id === input.sourceAccountId) : null;
    if (source && (input.type === 'expense' || input.type === 'transfer') && source.currentBalance < input.amount) {
      return NextResponse.json({ error: 'ยอดเงินในบัญชีต้นทางไม่เพียงพอ' }, { status: 400 });
    }

    const now = new Date();
    const transaction = {
      id: crypto.randomUUID(),
      type: input.type,
      amount: input.amount,
      date: input.date,
      title: input.title,
      ownerPersonId: input.ownerPersonId,
      payerPersonId: input.payerPersonId,
      propertyId: input.propertyId || null,
      categoryId: null,
      sourceAccountId: input.sourceAccountId || null,
      destinationAccountId: input.destinationAccountId || null,
      status: 'completed' as const,
      note: input.note || null,
      createdByUserId: session.user.id,
      recurringScheduleId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await db.batch([
      db.insert(transactions).values(transaction),
      ...balanceStatements(db, input.type, input.amount, input.sourceAccountId, input.destinationAccountId),
    ]);
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return error instanceof Error && error.message === 'UNAUTHORIZED'
      ? unauthorizedResponse()
      : serverErrorResponse();
  }
}

function balanceStatements(
  db: Awaited<ReturnType<typeof getRequestContext>>['db'],
  type: 'income' | 'expense' | 'transfer',
  amount: number,
  sourceAccountId: string | null | undefined,
  destinationAccountId: string | null | undefined
) {
  const statements = [];
  if ((type === 'expense' || type === 'transfer') && sourceAccountId) {
    statements.push(
      db.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} - ${amount}`, updatedAt: new Date() }).where(eq(accounts.id, sourceAccountId))
    );
  }
  if ((type === 'income' || type === 'transfer') && destinationAccountId) {
    statements.push(
      db.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} + ${amount}`, updatedAt: new Date() }).where(eq(accounts.id, destinationAccountId))
    );
  }
  return statements;
}