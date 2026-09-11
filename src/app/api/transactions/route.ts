import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { accounts, categories, persons, properties, transactions } from '@/db/schema';
import { getRequestContext, handleApiError } from '@/lib/api-auth';
import { transactionInputSchema, validationError } from '@/lib/validation';
import { alias } from 'drizzle-orm/sqlite-core';

export const runtime = 'nodejs';

const sourceAcc = alias(accounts, 'source_account');
const destAcc = alias(accounts, 'destination_account');

export async function GET(request: NextRequest) {
  try {
    const { db } = await getRequestContext(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const businessStatus = searchParams.get('businessStatus');
    const categoryId = searchParams.get('categoryId');
    const filters = [isNull(transactions.deletedAt)];
    if (type === 'income' || type === 'expense' || type === 'transfer') filters.push(eq(transactions.type, type));
    if (businessStatus === 'pending' || businessStatus === 'received') filters.push(eq(transactions.businessStatus, businessStatus));
    if (categoryId) filters.push(eq(transactions.categoryId, categoryId));
    const rows = await db
      .select({
        id: transactions.id,
        type: transactions.type,
        amount: transactions.amount,
        date: transactions.date,
        title: transactions.title,
        propertyId: transactions.propertyId,
        propertyName: properties.name,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        businessStatus: transactions.businessStatus,
        sourceAccountId: transactions.sourceAccountId,
        sourceAccountName: sourceAcc.name,
        sourceAccountBank: sourceAcc.bankName,
        sourceAccountNumber: sourceAcc.accountNumber,
        destinationAccountId: transactions.destinationAccountId,
        destinationAccountName: destAcc.name,
        destinationAccountBank: destAcc.bankName,
        destinationAccountNumber: destAcc.accountNumber,
        note: transactions.note,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(properties, eq(transactions.propertyId, properties.id))
      .leftJoin(sourceAcc, eq(transactions.sourceAccountId, sourceAcc.id))
      .leftJoin(destAcc, eq(transactions.destinationAccountId, destAcc.id))
      .where(and(...filters))
      .orderBy(desc(transactions.date), desc(transactions.createdAt));
    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error);
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
    console.log('[POST /api/transactions] Input:', parsed.data);

    if (input.propertyId) {
      const property = await db
        .select({ id: properties.id })
        .from(properties)
        .where(and(eq(properties.id, input.propertyId), isNull(properties.deletedAt)))
        .limit(1);
      if (!property[0]) return NextResponse.json({ error: 'ไม่พบทรัพย์สินที่เลือก' }, { status: 400 });
    }

    if (input.categoryId) {
      const category = await db.select({ type: categories.type }).from(categories).where(and(eq(categories.id, input.categoryId), isNull(categories.deletedAt))).limit(1);
      if (!category[0] || category[0].type !== input.type) {
        return NextResponse.json({ error: 'หมวดหมู่ไม่ตรงกับประเภทรายการ' }, { status: 400 });
      }
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
      propertyId: input.propertyId || null,
      categoryId: input.categoryId || null,
      sourceAccountId: input.sourceAccountId || null,
      destinationAccountId: input.destinationAccountId || null,
      status: (input.businessStatus === 'pending' ? 'pending' : 'completed') as 'pending' | 'completed',
      businessStatus: input.businessStatus || null,
      note: input.note || null,
      createdByUserId: session.user.id,
      recurringScheduleId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    console.log('[POST /api/transactions] Transaction:', transaction);

    await db.batch([
      db.insert(transactions).values(transaction),
      ...balanceStatements(db, input.type, input.amount, input.sourceAccountId, input.destinationAccountId, input.businessStatus),
    ]);
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error(
      '[POST /api/transactions] ERROR',
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error
    );
    return handleApiError(error);
  }
}

function balanceStatements(
  db: Awaited<ReturnType<typeof getRequestContext>>['db'],
  type: 'income' | 'expense' | 'transfer',
  amount: number,
  sourceAccountId: string | null | undefined,
  destinationAccountId: string | null | undefined,
  businessStatus?: string | null
) {
  const statements = [];
  
  // Only update balance when businessStatus is NOT 'pending'
  const shouldUpdateBalance = businessStatus !== 'pending';
  
  if (shouldUpdateBalance) {
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
  }
  return statements;
}