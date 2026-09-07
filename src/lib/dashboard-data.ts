import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import { accounts, persons, properties, transactions } from '@/db/schema';

export type DashboardData = {
  summary: { totalAssets: number; totalCash: number; monthlyIncome: number; monthlyExpense: number; netBalance: number; pendingBusinessTransfer: number };
  recentTransactions: { id: string; type: 'income' | 'expense' | 'transfer'; amount: number; date: string; title: string; sourceAccountName: string | null; destinationAccountName: string | null }[];
  accountSummary: { id: string; name: string; accountType: 'bank' | 'cash'; currentBalance: number }[];
  propertySummary: { id: string; name: string; ownerName: string; status: 'active' | 'inactive' }[];
};

export async function getDashboardData(db: AppDatabase): Promise<DashboardData> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const monthFilter = (type: 'income' | 'expense') => and(eq(transactions.type, type), eq(transactions.status, 'completed'), isNull(transactions.deletedAt), gte(transactions.date, monthStart), lt(transactions.date, nextMonthStart));

  const [balanceRow, incomeRow, expenseRow, pendingTransferRow, recentRows, accountRows, propertyRows] = await Promise.all([
    db.select({ totalAssets: sql<number>`coalesce(sum(${accounts.currentBalance}), 0)`, totalCash: sql<number>`coalesce(sum(case when ${accounts.accountType} = 'cash' then ${accounts.currentBalance} else 0 end), 0)` }).from(accounts).where(isNull(accounts.deletedAt)),
    db.select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)` }).from(transactions).where(monthFilter('income')),
    db.select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)` }).from(transactions).where(monthFilter('expense')),
    db.select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)` }).from(transactions).where(and(eq(transactions.type, 'income'), eq(transactions.businessStatus, 'customer_paid'), eq(transactions.status, 'completed'), isNull(transactions.deletedAt))),
    db.select().from(transactions).where(and(eq(transactions.status, 'completed'), isNull(transactions.deletedAt))).orderBy(desc(transactions.date), desc(transactions.createdAt)).limit(10),
    db.select({ id: accounts.id, name: accounts.name, accountType: accounts.accountType, currentBalance: accounts.currentBalance }).from(accounts).where(isNull(accounts.deletedAt)).orderBy(desc(accounts.currentBalance)),
    db.select({ id: properties.id, name: properties.name, ownerName: persons.name, status: properties.status }).from(properties).innerJoin(persons, eq(properties.ownerPersonId, persons.id)).where(isNull(properties.deletedAt)).orderBy(desc(properties.createdAt)),
  ]);

  const accountIds = recentRows.flatMap((transaction) => [transaction.sourceAccountId, transaction.destinationAccountId]).filter((id): id is string => Boolean(id));
  const relatedAccounts = accountIds.length ? await db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(inArray(accounts.id, accountIds)) : [];
  const accountNames = new Map(relatedAccounts.map((account) => [account.id, account.name]));
  const totalAssets = Number(balanceRow[0]?.totalAssets || 0);
  const totalCash = Number(balanceRow[0]?.totalCash || 0);
  const monthlyIncome = Number(incomeRow[0]?.total || 0);
  const monthlyExpense = Number(expenseRow[0]?.total || 0);
  const pendingBusinessTransfer = Number(pendingTransferRow[0]?.total || 0);

  return {
    summary: { totalAssets, totalCash, monthlyIncome, monthlyExpense, netBalance: monthlyIncome - monthlyExpense, pendingBusinessTransfer },
    recentTransactions: recentRows.map((transaction) => ({ id: transaction.id, type: transaction.type, amount: transaction.amount, date: transaction.date.toISOString(), title: transaction.title, sourceAccountName: transaction.sourceAccountId ? accountNames.get(transaction.sourceAccountId) || null : null, destinationAccountName: transaction.destinationAccountId ? accountNames.get(transaction.destinationAccountId) || null : null })),
    accountSummary: accountRows,
    propertySummary: propertyRows,
  };
}